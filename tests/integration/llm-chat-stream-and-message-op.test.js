import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function startStreamingLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        if (parsed.stream) {
          const text = "【叙事】\n雾铃塔的钟声沿着云桥亮起，玩家的脚步被温柔地接住。\n【状态建议】\nscene: 云桥";
          res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
          for (const part of ["【叙事】\n雾铃", "塔的钟声沿着云桥", "亮起，玩家的脚步被温柔地接住。", "\n【状态建议】\nscene: 云桥"]) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
          }
          res.end("data: [DONE]\n\n");
          return;
        }
        const wantsJson = parsed.response_format?.type === "json_object";
        const content = wantsJson
          ? JSON.stringify({
              intent: "action",
              emotionalSubtext: "玩家希望推进云桥上的第一幕",
              engagementDelta: 1,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "light",
              sceneGoal: "推进云桥",
              suggestedMustInclude: ["雾铃塔"],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: ["curiosity"], decrease: [] }
            })
          : "【叙事】\n雾铃塔的钟声沿着云桥亮起，玩家的脚步被温柔地接住。";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }));
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

async function collectSse(server, path, body) {
  const response = await fetch(`${server.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  const events = [];
  for (const frame of text.split(/\r?\n\r?\n/).filter(Boolean)) {
    let event = "message";
    const data = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) events.push({ event, data: JSON.parse(data.join("\n")) });
  }
  return events;
}

async function readChat(dataDir, moduleId) {
  const text = await readFile(join(dataDir, "engine", "worlds", moduleId, "runtime", "chat.jsonl"), "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("chat stream endpoint emits SSE deltas, persists done turn, and message-op supersedes legacy route", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startStreamingLlm();

  try {
    await saveConnection(server, { id: "streaming-test", baseUrl: fakeLlm.baseUrl });
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: `流式测试_${Date.now()}`,
        displayName: "流式测试",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "雾铃塔悬在云桥尽头，是第一幕必须出现的地点。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;

    const events = await collectSse(server, "/api/llm/chat/stream", {
      moduleKey,
      input: "走向雾铃塔",
      modeId: "world-rpg",
      dataMode: "worldbook",
      pipelineProfileId: "balanced",
      engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
      messages: []
    });
    assert.ok(events.some(item => item.event === "stage"));
    assert.match(events.filter(item => item.event === "delta").map(item => item.data.content).join(""), /雾铃塔/);
    const done = events.find(item => item.event === "done")?.data;
    assert.equal(done.status, "ok");
    assert.equal(done.pipelineProfile.id, "balanced");
    assert.match(done.narrative, /雾铃塔的钟声/);
    assert.equal(done.narrative.includes("状态建议"), false);
    assert.equal(done.usage.turn.totalTokens >= 18, true);
    const usagePath = join(dataDir, "engine", "worlds", moduleKey, "runtime", "usage.jsonl");
    assert.equal(existsSync(usagePath), true);
    assert.match(await readFile(usagePath, "utf8"), /"totalTokens":18/);

    let records = await readChat(dataDir, moduleKey);
    const assistant = records.find(record => record.role === "assistant");
    assert.ok(assistant?.id);

    const edited = await api(server, "/api/chat/message-op", {
      method: "POST",
      body: JSON.stringify({ moduleKey, messageId: assistant.id, action: "edit", content: "已编辑的流式回复" })
    });
    assert.equal(edited.body.status, "ok");
    assert.equal(edited.body.message.content, "已编辑的流式回复");

    const legacy = await api(server, "/api/chat/message", {
      method: "POST",
      body: JSON.stringify({ moduleKey, messageId: assistant.id, action: "favorite", favorite: true })
    });
    assert.equal(legacy.body.status, "ok");
    assert.equal(legacy.response.headers.get("deprecation"), "true");
    records = await readChat(dataDir, moduleKey);
    assert.equal(records.find(record => record.id === assistant.id)?.favorite, true);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
