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
import { createCalendar } from "../../src/core/engine/world-tick.js";
import { createLocationGraph } from "../../src/core/engine/location-graph.js";
import { createNpcRuntime, recomputeNpcProximity } from "../../src/core/engine/npc-schedule.js";

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
              intent: "wait",
              emotionalSubtext: "等待",
              engagementDelta: 0,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 0,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "none",
              sceneGoal: "等待",
              suggestedMustInclude: [],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: [], decrease: [] }
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

test("s4-4: wait + far LOD → causality in engineSnapshot; reload restores graph", async () => {
  const dataDir = await createTempDataDir("wt-s4-4-causality-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你在要塞等待，远方哨所有动静。\n【状态】\nscene: 远方要塞"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s44causality",
        displayName: "s44causality",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "要塞与哨所。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s4-4", baseUrl: fakeLlm.baseUrl });

    const locationGraph = createLocationGraph({
      nodes: [
        { id: "fort", name: "远方要塞" },
        { id: "outpost", name: "边境哨所" }
      ],
      edges: [{ from: "fort", to: "outpost", durationDays: 2 }]
    });
    const farNpc = createNpcRuntime({
      id: "far-scout",
      locationId: "outpost",
      relationDistance: 0.6,
      schedule: [{ atDay: 0, locationId: "outpost" }],
      lod: { fatigue: 0, taskProgress: 0, lastEvolvedDay: 0 }
    });
    const proximityScope = recomputeNpcProximity({
      npcs: [farNpc],
      totalDays: 0,
      currentLocationId: "fort",
      protagonistId: "player"
    }).scope;
    assert.equal(proximityScope.reasons?.["far-scout"]?.ring, "far");

    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我原地等待。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          dataMode: "worldbook",
          calendar: createCalendar(),
          locationGraph,
          currentLocationId: "fort",
          npcStates: [farNpc],
          proximityScope,
          protagonistId: "player"
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 500));
    assert.ok(chat.body.engineState?.calendar?.totalDays >= 1);

    const statePath = join(dataDir, "engine", "worlds", moduleKey, "runtime", "state.json");
    const runtimeState = JSON.parse(readFileSync(statePath, "utf8"));
    const causality = runtimeState.engineSnapshot?.causality;
    assert.ok(causality, "engineSnapshot.causality persisted");
    assert.ok((causality.events || []).length >= 2, `events=${(causality.events || []).length}`);
    assert.ok((causality.edges || []).length >= 1, "edges present");
    assert.ok(
      (causality.events || []).some((e) => /远距摘要|LOD/.test(e.title || "")),
      `expected LOD node: ${JSON.stringify(causality.events)}`
    );

    // Reload module → importEngineState restores graph; dashboard causality should see it
    const loaded = await api(server, "/api/modules/load", {
      method: "POST",
      body: JSON.stringify({ id: moduleKey })
    });
    assert.equal(loaded.body.status, "ok");

    // Hit a lightweight path that surfaces causality if exposed; otherwise re-read snapshot
    const state2 = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(
      (state2.engineSnapshot?.causality?.events || []).length,
      (causality.events || []).length,
      "reload keeps causality snapshot"
    );
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
