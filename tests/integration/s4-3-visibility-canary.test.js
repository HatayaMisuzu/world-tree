import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  randomPort,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";
import { makeCanaryToken, countCanaryHits } from "../../src/core/v2-ready/visibility-policy.js";

async function startCaptureLlm({ narrativeBody, emitCanary = "" }) {
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
              intent: "action",
              emotionalSubtext: "调查",
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
            })
          : (emitCanary ? `${narrativeBody}\n${emitCanary}` : narrativeBody);
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

function writerPackets(captured) {
  return captured.filter((req) => req.response_format?.type !== "json_object");
}

function packetText(req) {
  const msgs = req.messages || [];
  return msgs.map((m) => String(m.content || "")).join("\n");
}

test("S4-3 canary: stub-intercepted Writer request body hit count is 0 for gm_only secret", async () => {
  const canary = makeCanaryToken("s43", "reqbody");
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n灯塔指引船只靠岸。\n【状态】\nscene: 灯塔"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s43canary",
        displayName: "s43canary",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "灯塔城邦。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    const worldId = String(moduleKey).replace(/^world:/, "");
    const sharedDir = join(dataDir, "engine", "worlds", worldId, "shared");
    await mkdir(sharedDir, { recursive: true });
    await writeFile(join(sharedDir, "worldbook.json"), JSON.stringify({
      entries: [
        {
          id: "public-lighthouse",
          title: "公开灯塔",
          keys: ["灯塔"],
          content: "PLAYER_SAFE_LORE_TOKEN",
          visibility: "player_visible",
          priority: 100,
          enabled: true
        },
        {
          id: "gm-secret-canary",
          title: "GM机密金丝雀",
          keys: ["灯塔"],
          content: `GM_SECRET_WRAP ${canary}`,
          visibility: "gm_only",
          priority: 200,
          enabled: true
        },
        {
          id: "unknown-secret-note",
          title: "非标准字段秘密",
          keys: ["灯塔"],
          content: `NOTE_FIELD_SECRET ${canary}_NOTE`,
          visibility: "gm_only",
          note: `should_not_matter ${canary}`,
          priority: 180,
          enabled: true
        }
      ]
    }), "utf8");
    await saveConnection(server, { id: "fake-s43-canary", baseUrl: fakeLlm.baseUrl });

    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我靠近灯塔仔细观察结构。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: { dataMode: "worldbook", emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 } },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 400));

    const writers = writerPackets(fakeLlm.captured);
    assert.ok(writers.length >= 1, "expected at least one Writer LLM call");
    const body = writers.map(packetText).join("\n");
    assert.match(body, /PLAYER_SAFE_LORE_TOKEN/);
    assert.equal(countCanaryHits(body, [canary, `${canary}_NOTE`]), 0, "canary must not appear in Writer request body");
    assert.equal(body.includes("GM机密金丝雀"), false);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
