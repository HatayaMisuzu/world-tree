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

async function startNarrativeLlm() {
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
              emotionalSubtext: "玩家想确认重试后的世界是否继续响应",
              engagementDelta: 1,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "light",
              sceneGoal: "恢复叙事",
              suggestedMustInclude: ["灯塔"],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: ["curiosity"], decrease: [] }
            })
          : "【叙事】\n灯塔重新亮起，旧错误仍留在记录里，而故事继续向前。\n【状态】\nscene: 灯塔";
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

async function readChat(dataDir, moduleId) {
  const text = await readFile(join(dataDir, "engine", "worlds", moduleId, "runtime", "chat.jsonl"), "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("LLM failure persists a failed turn and retry appends recovered assistant", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startNarrativeLlm();

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: `重试测试_${Date.now()}`,
        displayName: "重试测试",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "灯塔城邦，所有失败都必须留下记录。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;

    await saveConnection(server, { id: "dead-port", baseUrl: "http://127.0.0.1:9/v1" });
    const failed = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "检查灯塔",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
        messages: []
      })
    });
    assert.equal(failed.body.status, "error");
    assert.equal(failed.body.code, "LLM_UNREACHABLE");
    assert.ok(failed.body.persistedIds.failedTurnId);

    let records = await readChat(dataDir, moduleKey);
    assert.equal(records.filter((record) => record.role === "user").length, 1);
    assert.equal(records.filter((record) => record.role === "error").length, 1);
    assert.equal(records.some((record) => record.turnStatus === "failed"), true);

    await saveConnection(server, { id: "fake-success", baseUrl: fakeLlm.baseUrl });
    const retry = await api(server, "/api/llm/chat/retry", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        failedTurnId: failed.body.persistedIds.failedTurnId,
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
        messages: []
      })
    });
    assert.equal(retry.body.status, "ok");
    assert.match(retry.body.narrative, /灯塔重新亮起/);

    records = await readChat(dataDir, moduleKey);
    const oldError = records.find((record) => record.role === "error" && record.failedTurnId === failed.body.persistedIds.failedTurnId);
    const recovered = records.find((record) => record.role === "assistant" && record.recoveredFromFailedTurnId === failed.body.persistedIds.failedTurnId);
    assert.ok(oldError, "old error record should remain append-only");
    assert.ok(recovered, "retry success should append recovered assistant");
    assert.equal(recovered.supersedesErrorId, oldError.id);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
