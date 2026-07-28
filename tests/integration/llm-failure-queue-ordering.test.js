import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function startOrderedLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const wantsJson = parsed.response_format?.type === "json_object";
      const content = wantsJson
        ? JSON.stringify({
            intent: "action",
            emotionalSubtext: "验证失败回合与下一回合的严格顺序",
            engagementDelta: 0,
            tensionDelta: 0,
            fatigueDelta: 0,
            curiosityDelta: 1,
            pacingSuggestion: "hold",
            pressureSuggestion: "low",
            eventIntensitySuggestion: "light",
            sceneGoal: "确认队列顺序",
            suggestedMustInclude: ["SECOND_SUCCEEDS"],
            suggestedMustNotInclude: [],
            emotionalTarget: { increase: ["curiosity"], decrease: [] }
          })
        : "【叙事】\nSECOND_SUCCEEDS 在失败记录完整落盘后继续。\n【状态】\nscene: queue";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
    });
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

async function startFailingLlm() {
  const port = randomPort();
  const server = createServer((req) => {
    req.resume();
    setTimeout(() => req.socket.destroy(), 80);
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

async function readChat(dataDir, moduleId) {
  const text = await readFile(join(dataDir, "engine", "worlds", moduleId, "runtime", "chat.jsonl"), "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test("a concurrent retry waits for failed-turn persistence in the same world session queue", async () => {
  const dataDir = await createTempDataDir();
  const worldTree = await startWorldTreeServer({ dataDir });
  const llm = await startOrderedLlm();
  const failingLlm = await startFailingLlm();
  try {
    const connection = await api(worldTree, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: { id: "ordered", label: "ordered", baseUrl: failingLlm.baseUrl, model: "test", apiKey: "test-key" }
      })
    });
    assert.equal(connection.body.status, "ok");
    const created = await api(worldTree, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: `queue_${Date.now()}`,
        displayName: "Queue",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "Queue ordering test.",
        sourceType: "test"
      })
    });
    const moduleKey = created.body.module.id;
    const request = (input) => api(worldTree, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input,
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
        messages: []
      })
    });

    const firstPromise = request("FIRST_MUST_FAIL");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const switched = await api(worldTree, "/api/connections", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert",
        setDefault: true,
        profile: { id: "ordered", label: "ordered", baseUrl: llm.baseUrl, model: "test", apiKey: "test-key" }
      })
    });
    assert.equal(switched.body.status, "ok");
    const secondPromise = request("SECOND_SUCCEEDS");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    assert.equal(first.body.status, "error");
    assert.equal(second.body.status, "ok");

    const records = await readChat(dataDir, moduleKey);
    assert.deepEqual(records.map((record) => record.role), ["user", "error", "user", "assistant"]);
    assert.equal(records[0].content, "FIRST_MUST_FAIL");
    assert.equal(records[1].failedTurnId, records[0].failedTurnId);
    assert.equal(records[2].content, "SECOND_SUCCEEDS");
    assert.equal(records[3].round, 1);
    assert.equal(records.filter((record) => record.role === "error").length, 1);
  } finally {
    await worldTree.stop();
    await llm.stop();
    await failingLlm.stop();
    await removeTempDir(dataDir);
  }
});
