import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function startInstrumentedLlm() {
  const port = randomPort();
  const stats = {
    writerPrompts: [],
    activeWriters: 0,
    maxActiveWriters: 0
  };
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf8"); });
      req.on("end", async () => {
        const parsed = JSON.parse(body || "{}");
        const wantsJson = parsed.response_format?.type === "json_object";
        if (wantsJson) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify({
            intent: "action",
            emotionalSubtext: "玩家推进当前世界",
            engagementDelta: 1,
            tensionDelta: 0,
            fatigueDelta: 0,
            curiosityDelta: 1,
            pacingSuggestion: "hold",
            pressureSuggestion: "low",
            eventIntensitySuggestion: "light",
            sceneGoal: "推进",
            suggestedMustInclude: [],
            suggestedMustNotInclude: [],
            emotionalTarget: { increase: ["curiosity"], decrease: [] }
          }) } }] }));
          return;
        }

        const writerPrompt = parsed.messages?.at(-1)?.content || "";
        stats.writerPrompts.push(writerPrompt);
        stats.activeWriters++;
        stats.maxActiveWriters = Math.max(stats.maxActiveWriters, stats.activeWriters);
        await new Promise((resolve) => setTimeout(resolve, 120));
        stats.activeWriters--;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: "【叙事】\n当前世界回应玩家，场景保持清晰。\n【状态建议】\nscene: test"
            }
          }]
        }));
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
    stats,
    resetStats() {
      stats.writerPrompts = [];
      stats.activeWriters = 0;
      stats.maxActiveWriters = 0;
    },
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

async function createWorld(server, label, sourceText) {
  const created = await api(server, "/api/modules/create", {
    method: "POST",
    body: JSON.stringify({
      name: `${label}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      displayName: label,
      mode: "world-rpg",
      dataMode: "worldbook",
      sourceText,
      sourceType: "test"
    })
  });
  assert.equal(created.body.status, "ok");
  return created.body.module.id;
}

function chatBody(moduleKey, input) {
  return {
    moduleKey,
    input,
    modeId: "world-rpg",
    dataMode: "worldbook",
    engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
    messages: []
  };
}

test("WorldSession isolates A/B prompts and serializes same-world turns", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startInstrumentedLlm();

  try {
    await saveConnection(server, { id: "world-session-test", baseUrl: fakeLlm.baseUrl });
    const worldA = await createWorld(server, "A_ONLY_CRYSTAL", "A_ONLY_CRYSTAL lives under the red bridge.");
    const worldB = await createWorld(server, "B_ONLY_ORCHARD", "B_ONLY_ORCHARD grows behind the silver gate.");

    const [resA, resB] = await Promise.all([
      api(server, "/api/llm/chat", { method: "POST", body: JSON.stringify(chatBody(worldA, "look at A_ONLY_CRYSTAL")) }),
      api(server, "/api/llm/chat", { method: "POST", body: JSON.stringify(chatBody(worldB, "look at B_ONLY_ORCHARD")) })
    ]);
    assert.equal(resA.body.status, "ok");
    assert.equal(resB.body.status, "ok");
    assert.ok(fakeLlm.stats.maxActiveWriters >= 2, "different worlds should be allowed to run provider calls in parallel");

    const promptA = fakeLlm.stats.writerPrompts.find(prompt => prompt.includes("A_ONLY_CRYSTAL"));
    const promptB = fakeLlm.stats.writerPrompts.find(prompt => prompt.includes("B_ONLY_ORCHARD"));
    assert.ok(promptA, "world A writer packet should include A source fact");
    assert.ok(promptB, "world B writer packet should include B source fact");
    assert.equal(promptA.includes("B_ONLY_ORCHARD"), false);
    assert.equal(promptB.includes("A_ONLY_CRYSTAL"), false);

    fakeLlm.resetStats();
    const [same1, same2] = await Promise.all([
      api(server, "/api/llm/chat", { method: "POST", body: JSON.stringify(chatBody(worldA, "same world request 1")) }),
      api(server, "/api/llm/chat", { method: "POST", body: JSON.stringify(chatBody(worldA, "same world request 2")) })
    ]);
    assert.equal(same1.body.status, "ok");
    assert.equal(same2.body.status, "ok");
    assert.equal(fakeLlm.stats.maxActiveWriters, 1, "same world provider calls should be serialized by the turn queue");
    assert.deepEqual([same1.body.turnCount, same2.body.turnCount].sort((a, b) => a - b), [2, 3]);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
