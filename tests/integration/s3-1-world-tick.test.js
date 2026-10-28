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
import { createCalendar } from "../../src/core/engine/world-tick.js";

async function startCaptureLlm({ narrativeBody }) {
  const port = randomPort();
  const captured = [];
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString("utf8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        captured.push(parsed);
        const wantsJson = parsed.response_format?.type === "json_object";
        const content = wantsJson
          ? JSON.stringify({
              intent: "wait",
              emotionalSubtext: "等候",
              engagementDelta: 0,
              tensionDelta: -1,
              fatigueDelta: 0,
              curiosityDelta: 0,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "none",
              sceneGoal: "时间流逝",
              suggestedMustInclude: [],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: [], decrease: ["tension"] }
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
    captured,
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

test("s3-1: 原地等待 → /api/llm/chat advances structured calendar by Δt (one period)", async () => {
  const dataDir = await createTempDataDir("wt-s3-1-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你原地等候，日影挪了一寸。\n【状态】\nscene: 广场"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s31tick",
        displayName: "s31tick",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "广场与日晷。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-1", baseUrl: fakeLlm.baseUrl });

    const initialCalendar = createCalendar();
    assert.equal(initialCalendar.totalDays, 0);

    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我原地等待。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          dataMode: "worldbook",
          emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
          calendar: initialCalendar
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 400));

    const cal = chat.body.engineState?.calendar;
    assert.ok(cal, "engineState.calendar should be present after wait tick");
    assert.equal(cal.totalDays, 1, `expected totalDays +1 period, got ${JSON.stringify(cal)}`);
    assert.equal(cal.day, 2);
    assert.ok(chat.body.engineState?.worldPanel?.currentTime?.dayNumber === 1
      || chat.body.engineState?.worldPanel?.currentTime?.display,
      "worldPanel clock should advance with calendar");
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("s3-1: non-wait turn does not advance calendar", async () => {
  const dataDir = await createTempDataDir("wt-s3-1b-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你检查日晷刻度。\n【状态】\nscene: 广场"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s31idle",
        displayName: "s31idle",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "广场。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-1b", baseUrl: fakeLlm.baseUrl });

    const initialCalendar = createCalendar();
    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我检查日晷的刻度。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          dataMode: "worldbook",
          emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
          calendar: initialCalendar
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 400));
    const cal = chat.body.engineState?.calendar;
    assert.ok(cal);
    assert.equal(cal.totalDays, 0, "non-wait must not advance calendar");
    assert.equal(cal.day, 1);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
