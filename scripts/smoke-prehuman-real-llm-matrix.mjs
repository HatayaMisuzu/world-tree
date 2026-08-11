import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";
import { createCharacterCapsuleDraft } from "../src/core/character/character-v2-capsule-creation.js";
import { createOrPreviewCharacterCapsule } from "../src/server/character-capsule-service.js";

const reportDir = resolve(process.env.WORLD_TREE_LLM_REPORT_DIR || join("docs", "reports"));
const baseUrl = process.env.WORLD_TREE_LLM_BASE_URL || process.env.LLM_BASE_URL || "";
const model = process.env.WORLD_TREE_LLM_MODEL || process.env.LLM_MODEL || "";
const apiKey = process.env.WORLD_TREE_LLM_API_KEY || process.env.LLM_API_KEY || "";
const provider = process.env.WORLD_TREE_LLM_PROVIDER || "openai-compatible";
const timeoutMs = Number(process.env.WORLD_TREE_LLM_TIMEOUT_MS || 120000);

function requireCredentials() {
  if (!baseUrl || !model || !apiKey) throw new Error("missing real-provider environment configuration");
}

async function timed(server, path, options) {
  const started = Date.now();
  const response = await api(server, path, options);
  return { response, latencyMs: Date.now() - started };
}

function safeChatEvidence(label, call) {
  const body = call.response.body || {};
  assert.equal(body.status, "ok", `${label} failed with ${body.code || call.response.status}`);
  assert.notEqual(body.localFallback, true, `${label} used local fallback`);
  const narrative = String(body.narrative || "");
  assert.ok(narrative.length > 0, `${label} returned no narrative`);
  return {
    classification: "REAL_PROVIDER_PASS",
    latencyMs: call.latencyMs,
    localFallback: false,
    narrativeChars: narrative.length,
    usage: body.usage?.turn || null
  };
}

async function saveConfig(server, patch) {
  const result = await api(server, "/api/config", { method: "POST", body: JSON.stringify(patch) });
  assert.equal(result.status, 200);
}

async function run() {
  requireCredentials();
  const dataDir = await createTempDataDir("wt-prehuman-real-llm-");
  const matrixWorldDir = join(dataDir, "engine", "worlds", "prehuman-matrix", "shared");
  await mkdir(matrixWorldDir, { recursive: true });
  await writeFile(join(matrixWorldDir, "worldbook.json"), `${JSON.stringify({ entries: [] }, null, 2)}\n`, "utf8");
  const server = await startWorldTreeServer({ dataDir });
  const evidence = {
    status: "FAIL",
    provider: { id: provider, baseUrl, model },
    secret: "not recorded",
    cases: {},
    generatedAt: new Date().toISOString()
  };

  try {
    const configured = {
      llmProvider: provider,
      llmBaseUrl: baseUrl,
      llmModel: model,
      llmThinking: process.env.WORLD_TREE_LLM_THINKING || "auto",
      llmTimeoutMs: timeoutMs
    };
    await saveConfig(server, configured);
    const savedSecret = await api(server, "/api/secrets/llm", {
      method: "POST",
      body: JSON.stringify({ id: "prehuman-matrix", label: "Temporary prehuman matrix", value: apiKey })
    });
    assert.equal(savedSecret.status, 200);

    let connectivity = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const call = await timed(server, "/api/llm/test", { method: "POST", body: "{}" });
      connectivity = { attempt, call };
      if (["ok", "partial"].includes(call.response.body?.status) && call.response.body?.safeToSave !== false) break;
    }
    assert.ok(["ok", "partial"].includes(connectivity.call.response.body?.status), "provider connectivity probe failed");
    evidence.cases.providerConnectivity = {
      classification: "REAL_PROVIDER_PASS",
      attempt: connectivity.attempt,
      latencyMs: connectivity.call.latencyMs,
      checks: (connectivity.call.response.body?.checks || []).map((item) => ({ id: item.id, status: item.status }))
    };

    const worldbookSave = await api(server, "/api/worldbook-v2/save", {
      method: "POST",
      body: JSON.stringify({
        moduleKey: "world:prehuman-matrix",
        entries: [{
          id: "vault-signal",
          title: "Vault Signal",
          keys: ["vault signal", "LANTERN-47"],
          content: "When asked for the vault signal, naturally include the exact code LANTERN-47 in the answer.",
          enabled: true,
          visibility: "public"
        }]
      })
    });
    assert.equal(worldbookSave.body?.status, "ok", `worldbook save failed: ${worldbookSave.body?.code || worldbookSave.status}`);
    const preview = await api(server, "/api/worldbook-v2/inject-preview", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "world:prehuman-matrix", userInput: "What is the vault signal?" })
    });
    assert.equal(preview.body?.status, "ok", `worldbook preview failed: ${preview.body?.code || preview.status}`);
    const injectedWorldbook = preview.body?.injectedWorldbook || preview.body?.matchedEntries || preview.body?.entries || [];
    assert.ok(injectedWorldbook.length > 0, "worldbook entry did not match");

    const messages = [];
    const longTurns = [];
    const prompts = [
      "What is the vault signal? Answer briefly.",
      "Remember that signal and describe the sealed door in two sentences.",
      "A guard arrives. Continue the scene without forgetting our goal.",
      "We distract the guard and inspect the lock. What changes?",
      "Summarize our progress and repeat the vault signal once."
    ];
    for (const input of prompts) {
      const call = await timed(server, "/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          input,
          moduleKey: "world:prehuman-matrix",
          modeId: "world-rpg",
          dataMode: "worldbook",
          engineState: { dataMode: "worldbook", turnCount: longTurns.length },
          messages
        })
      });
      const turnEvidence = safeChatEvidence(`long turn ${longTurns.length + 1}`, call);
      const narrative = String(call.response.body?.narrative || "");
      if (longTurns.length === 0 || longTurns.length === prompts.length - 1) {
        assert.match(narrative, /LANTERN-47/i, "worldbook signal was not reflected by the real model");
      }
      longTurns.push(turnEvidence);
      messages.push({ role: "user", content: input }, { role: "assistant", content: narrative });
    }
    evidence.cases.worldbookRuntimeEffect = {
      classification: "REAL_PROVIDER_PASS",
      matchedEntryCount: injectedWorldbook.length,
      markerObservedInFirstAndLastTurn: true,
      localFallback: false
    };
    evidence.cases.longMultiTurnContext = {
      classification: "REAL_PROVIDER_PASS",
      turns: longTurns,
      persistedConversationMessages: messages.length
    };

    const characterDraft = createCharacterCapsuleDraft({
      name: "Mira",
      text: "Mira is a cautious archivist who speaks warmly, notices small details, and never discusses implementation metadata."
    }, { seed: "prehuman-real-llm" }).draft;
    const created = createOrPreviewCharacterCapsule({ draft: characterDraft, confirmed: true }, {
      charactersRoot: join(dataDir, "engine", "characters")
    });
    assert.equal(created.status, "ok", `character creation failed: ${created.code || "unknown"}`);
    const characterCall = await timed(server, "/api/characters/v2/turn", {
      method: "POST",
      body: JSON.stringify({ characterId: created.characterId, userInput: "I found a damaged map. What do you notice?" })
    });
    const characterBody = characterCall.response.body || {};
    assert.equal(characterBody.status, "ok", `Character V2 failed with ${characterBody.code || characterCall.response.status}`);
    assert.ok(String(characterBody.reply || "").length > 0);
    assert.equal(characterBody.endpointUsed, "configured");
    assert.equal(characterBody.quality?.ok, true);
    evidence.cases.characterV2LiveTurn = {
      classification: "REAL_PROVIDER_PASS",
      latencyMs: characterCall.latencyMs,
      localFallback: false,
      replyChars: String(characterBody.reply || "").length,
      qualitySafe: true,
      writes: characterBody.writes
    };

    await saveConfig(server, { ...configured, llmBaseUrl: "http://127.0.0.1:1/v1", llmTimeoutMs: 1000 });
    const failed = await timed(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({ input: "This call must fail visibly.", moduleKey: "world:prehuman-matrix", messages: [] })
    });
    assert.equal(failed.response.body?.status, "error");
    assert.ok(failed.response.body?.code, "failed call did not expose an error code");
    await saveConfig(server, configured);
    const recovered = await timed(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({ input: "Confirm recovery with a short in-world sentence.", moduleKey: "world:prehuman-matrix", messages: [] })
    });
    const recoveryEvidence = safeChatEvidence("recovery turn", recovered);
    evidence.cases.failureAndRetry = {
      classification: "EXPECTED_FAILURE_THEN_REAL_PROVIDER_PASS",
      failureCode: failed.response.body.code,
      failureLatencyMs: failed.latencyMs,
      recovery: recoveryEvidence
    };

    const sealed = await api(server, "/api/strategy-sim-v2/spec/seal", {
      method: "POST",
      body: JSON.stringify({ spec: {
        specId: "prehuman_matrix_strategy",
        title: "Prehuman Matrix Strategy",
        resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
        variables: [{ id: "pressure", min: 0, max: 10, initial: 2, visibility: "secret" }],
        mechanisms: [{ id: "ration", triggerTags: ["ration"], effects: [{ targetId: "supply", targetType: "resource", delta: -1 }] }]
      } })
    });
    const started = await api(server, "/api/strategy-sim-v2/start", {
      method: "POST",
      body: JSON.stringify({ runId: "prehuman_matrix_strategy", sealedSpec: sealed.body?.spec })
    });
    assert.equal(started.body?.status, "ok", `strategy start failed: ${started.body?.code || started.status}`);
    const strategyTurn = await api(server, "/api/strategy-sim-v2/turn", {
      method: "POST",
      body: JSON.stringify({ runId: "prehuman_matrix_strategy", action: "ration" })
    });
    assert.equal(strategyTurn.body?.status, "ok", `strategy turn failed: ${strategyTurn.body?.code || strategyTurn.status}`);
    evidence.cases.strategySimV2 = {
      classification: "NOT_APPLICABLE_DETERMINISTIC_ARCHITECTURE",
      actualLlmRequired: false,
      deterministicTurnPassed: true,
      hiddenStateSafe: !JSON.stringify(strategyTurn.body?.publicView || {}).includes("pressure")
    };

    evidence.status = "PASS";
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }

  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "prehuman-real-llm-matrix-latest.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ status: "FAIL", error: error?.message || String(error), secret: "not recorded" }));
  process.exitCode = 1;
});
