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
import { createLocationGraph } from "../../src/core/engine/location-graph.js";
import { createNpcRuntime, recomputeNpcProximity } from "../../src/core/engine/npc-schedule.js";

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
              intent: "travel",
              emotionalSubtext: "赶路",
              engagementDelta: 0,
              tensionDelta: 0,
              fatigueDelta: 1,
              curiosityDelta: 0,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "none",
              sceneGoal: "旅行",
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

function s3Fixture() {
  const locationGraph = createLocationGraph({
    nodes: [
      { id: "plaza", name: "广场" },
      { id: "fort", name: "远方要塞" },
      { id: "outpost", name: "边境哨所" }
    ],
    edges: [
      { from: "plaza", to: "fort", durationDays: 3 },
      { from: "fort", to: "outpost", durationDays: 2 }
    ]
  });
  const npc = createNpcRuntime({
    id: "scout-lin",
    name: "斥候林",
    locationId: "fort",
    relationDistance: 0.3,
    schedule: [
      { atDay: 0, locationId: "fort" },
      { atDay: 4, locationId: "outpost" }
    ]
  });
  const initialScope = recomputeNpcProximity({
    npcs: [npc],
    totalDays: 0,
    currentLocationId: "plaza",
    protagonistId: "player"
  }).scope;
  return { locationGraph, npcStates: [npc], proximityScope: initialScope };
}

test("s3-2: travel to distant location advances calendar by edge durationDays", async () => {
  const dataDir = await createTempDataDir("wt-s3-2-travel-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你启程前往远方要塞，路上过了三日。\n【状态】\nscene: 远方要塞"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s32travel",
        displayName: "s32travel",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "广场通往远方要塞。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-2-travel", baseUrl: fakeLlm.baseUrl });

    const { locationGraph, npcStates, proximityScope } = s3Fixture();
    const initialCalendar = createCalendar();

    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我前往远方要塞。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          dataMode: "worldbook",
          emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
          calendar: initialCalendar,
          locationGraph,
          currentLocationId: "plaza",
          npcStates,
          proximityScope,
          protagonistId: "player"
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 400));

    const cal = chat.body.engineState?.calendar;
    assert.ok(cal, "engineState.calendar should be present after travel tick");
    assert.equal(cal.totalDays, 3, `expected travel Δt = 3 days, got ${JSON.stringify(cal)}`);
    assert.equal(chat.body.engineState?.currentLocationId, "fort");
    assert.equal(chat.body.engineState?.npcStates?.[0]?.locationId, "fort");
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("s3-2: NPC enters core/near on travel co-location then exits to far/dormant via schedule", async () => {
  const dataDir = await createTempDataDir("wt-s3-2-ring-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你抵达要塞，见到了斥候。\n【状态】\nscene: 远方要塞"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s32ring",
        displayName: "s32ring",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "广场、要塞与哨所。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-2-ring", baseUrl: fakeLlm.baseUrl });

    const { locationGraph, npcStates, proximityScope } = s3Fixture();
    const startRing = proximityScope.reasons["scout-lin"]?.ring;
    assert.ok(startRing === "far" || startRing === "dormant", `precondition far/dormant, got ${startRing}`);

    // Turn 1: travel to fort → co-locate with NPC → enter core/near
    const chat1 = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我前往远方要塞。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          dataMode: "worldbook",
          emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
          calendar: createCalendar(),
          locationGraph,
          currentLocationId: "plaza",
          npcStates,
          proximityScope,
          protagonistId: "player"
        },
        messages: []
      })
    });
    assert.equal(chat1.body.status, "ok", JSON.stringify(chat1.body).slice(0, 400));
    const es1 = chat1.body.engineState;
    assert.equal(es1.currentLocationId, "fort");
    assert.equal(es1.calendar.totalDays, 3);
    const ringAfterTravel = es1.proximityScope?.reasons?.["scout-lin"]?.ring;
    assert.ok(
      ringAfterTravel === "core" || ringAfterTravel === "near",
      `expected enter core/near after travel, got ${ringAfterTravel}`
    );
    assert.notEqual(ringAfterTravel, startRing);
    const changes1 = es1.proximityRingChanges || [];
    assert.ok(
      changes1.some((c) => c.id === "scout-lin" && (c.to === "core" || c.to === "near")),
      `expected enter change in engineState.proximityRingChanges, got ${JSON.stringify(changes1)}`
    );

    // Turn 2: wait → totalDays 4 → NPC schedule moves to outpost → exit far/dormant
    const chat2 = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我原地等待。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          ...es1,
          dataMode: "worldbook",
          emotionState: es1.emotionState || { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
        },
        messages: []
      })
    });
    assert.equal(chat2.body.status, "ok", JSON.stringify(chat2.body).slice(0, 400));
    const es2 = chat2.body.engineState;
    assert.equal(es2.calendar.totalDays, 4);
    assert.equal(es2.npcStates?.find((n) => n.id === "scout-lin")?.locationId, "outpost");
    const ringAfterWait = es2.proximityScope?.reasons?.["scout-lin"]?.ring;
    assert.ok(
      ringAfterWait === "far" || ringAfterWait === "dormant",
      `expected exit far/dormant after schedule move, got ${ringAfterWait}`
    );
    const changes2 = es2.proximityRingChanges || [];
    assert.ok(
      changes2.some((c) => c.id === "scout-lin" && (c.from === "core" || c.from === "near") && (c.to === "far" || c.to === "dormant")),
      `expected exit change in engineState.proximityRingChanges, got ${JSON.stringify(changes2)}`
    );
    assert.notEqual(ringAfterWait, ringAfterTravel);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
