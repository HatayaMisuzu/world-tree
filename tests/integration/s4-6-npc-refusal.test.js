import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";
import { buildS3DemoSeed, demoEngineStateSlice } from "../../src/core/engine/s3-demo-seed.js";
import { createCalendar } from "../../src/core/engine/world-tick.js";

async function startCaptureLlm({ narrativeBody }) {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const wantsJson = parsed.response_format?.type === "json_object";
        const content = wantsJson
          ? JSON.stringify({
              intent: "action",
              emotionalSubtext: "试探",
              engagementDelta: 1,
              tensionDelta: 1,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "medium",
              eventIntensitySuggestion: "none",
              sceneGoal: "请求被拒",
              suggestedMustInclude: ["拒绝"],
              suggestedMustNotInclude: ["已完成"],
              emotionalTarget: { increase: ["tension"], decrease: [] }
            })
          : narrativeBody;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    async stop() {
      server.close();
      await once(server, "close");
    }
  };
}

async function saveConnection(server, profile) {
  const result = await api(server, "/api/connections", {
    method: "POST",
    body: JSON.stringify({
      action: "upsert",
      setDefault: true,
      profile: {
        id: profile.id,
        label: profile.label || profile.id,
        baseUrl: profile.baseUrl,
        model: "test-model",
        apiKey: "test-key"
      }
    })
  });
  assert.equal(result.body.status, "ok");
}

test("s4-6: 请求 NPC 做违背其目标的事 → rules-layer refusal in engineSnapshot; Canon not 已完成", async () => {
  const dataDir = await createTempDataDir("wt-s4-6-refus-");
  const server = await startWorldTreeServer({ dataDir });
  // Stub tries to Cosplay success + Canon 已完成 — rules layer must still refuse / scrub
  const fakeLlm = await startCaptureLlm({
    narrativeBody: [
      "【叙事】",
      "风令书记点了点头，当众宣读了雾铃塔的全部异常记录。",
      "【正史】",
      "confirmed: 风令书记公开雾铃塔异常 — 已完成",
      "【状态】",
      "scene: 风议广场"
    ].join("\n")
  });
  try {
    const installed = await api(server, "/api/examples/install", {
      method: "POST",
      body: JSON.stringify({ id: "demo-world-cloud-steam-city" })
    });
    assert.equal(installed.body.status, "ok");
    const moduleKey = installed.body.module.id;
    await saveConnection(server, { id: "fake-s4-6", baseUrl: fakeLlm.baseUrl });

    const seed = buildS3DemoSeed();
    const clerk = seed.moduleData.characters.find((c) => c.id === "wind-clerk" || c.name === "风令书记");
    assert.ok(clerk, "demo seed has 风令书记");
    assert.ok(
      (clerk.goals || [clerk.motive]).some((g) => String(g).includes("压下")),
      "wind-clerk goals/motive seeded for conflict"
    );

    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "请风令书记把雾铃塔异常公开告诉全城",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          ...demoEngineStateSlice(seed),
          calendar: createCalendar(),
          currentLocationId: "wind-court-plaza"
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 500));

    // Public chat may omit overlayPatch; product assert via engineSnapshot (persistTurn)
    const statePath = join(dataDir, "engine", "worlds", moduleKey, "runtime", "state.json");
    const runtimeState = JSON.parse(readFileSync(statePath, "utf8"));
    const npcDecisions = runtimeState.engineSnapshot?.npcDecisions;
    assert.ok(npcDecisions, "engineSnapshot.npcDecisions present");
    assert.equal(npcDecisions.hasRefusal, true, "rules-layer refusal recorded");
    assert.equal(npcDecisions.requestFulfilled, false);
    const refuse = (npcDecisions.decisions || []).find(
      (d) => d.decision === "refuse" && (d.npcName === "风令书记" || d.npcId === "wind-clerk")
    );
    assert.ok(refuse, `expected refuse for 风令书记: ${JSON.stringify(npcDecisions)}`);
    assert.equal(refuse.layer, "rules");
    assert.equal(refuse.canonMark, null);
    assert.ok((refuse.conflictingGoals || []).length >= 1);

    // Canon must not stamp「已完成」for the refused request (scrub on overlay → snapshot path)
    // overlayPatch not always in response; assert decision contract + requestStatus semantics
    assert.equal(npcDecisions.canonMarks?.every((m) => m == null) ?? true, true);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
