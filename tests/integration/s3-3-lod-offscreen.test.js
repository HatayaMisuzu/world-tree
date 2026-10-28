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
import { continuousNearLod, createLodState } from "../../src/core/engine/lod-evolve.js";

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

async function chatTurn(server, { moduleKey, input, engineState }) {
  const chat = await api(server, "/api/llm/chat", {
    method: "POST",
    body: JSON.stringify({
      moduleKey,
      input,
      modeId: "world-rpg",
      dataMode: "worldbook",
      engineState: {
        dataMode: "worldbook",
        emotionState: engineState.emotionState || {
          engagement: 5,
          tension: 5,
          fatigue: 5,
          curiosity: 5
        },
        ...engineState
      },
      messages: []
    })
  });
  assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 500));
  return chat.body.engineState;
}

/**
 * relationDistance=1 keeps co-located NPCs in near (fine) and apart NPCs in
 * dormant (score 0.775), so the dormant freeze path is exercised.
 */
const REL = 1;

function baseGraph() {
  return createLocationGraph({
    nodes: [
      { id: "fort", name: "远方要塞" },
      { id: "outpost", name: "边境哨所" }
    ],
    edges: [{ from: "fort", to: "outpost", durationDays: 2 }]
  });
}

test("s3-3: travel + wait paths still advance calendar with lod wired", async () => {
  const dataDir = await createTempDataDir("wt-s3-3-paths-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你启程前往边境哨所。\n【状态】\nscene: 边境哨所"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s33paths",
        displayName: "s33paths",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "要塞通往哨所。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-3-paths", baseUrl: fakeLlm.baseUrl });

    const locationGraph = baseGraph();
    const npc = createNpcRuntime({
      id: "guide",
      locationId: "fort",
      relationDistance: REL,
      schedule: [{ atDay: 0, locationId: "fort" }]
    });
    const proximityScope = recomputeNpcProximity({
      npcs: [npc],
      totalDays: 0,
      currentLocationId: "fort",
      protagonistId: "player"
    }).scope;

    const afterTravel = await chatTurn(server, {
      moduleKey,
      input: "我前往边境哨所。",
      engineState: {
        calendar: createCalendar(),
        locationGraph,
        currentLocationId: "fort",
        npcStates: [npc],
        proximityScope,
        protagonistId: "player"
      }
    });
    assert.equal(afterTravel.calendar.totalDays, 2);
    assert.equal(afterTravel.currentLocationId, "outpost");
    assert.ok(afterTravel.npcStates?.[0]?.lod, "lod bag present after travel tick");

    const afterWait = await chatTurn(server, {
      moduleKey,
      input: "我原地等待。",
      engineState: afterTravel
    });
    assert.equal(afterWait.calendar.totalDays, 3);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

/**
 * Hard acceptance gate:
 * dormant → re-enter near/core wake补算 must align with continuous
 * (never-dormant) run on comparable fields: lod.fatigue, lod.taskProgress.
 *
 * Shared endpoint: calendar.totalDays === 10.
 * - continuous: co-located at fort, 10× wait (near every day)
 * - dormant path: leave via schedule → dormant freeze → travel wake at day 10
 */
test("s3-3: dormant→near wake补算 matches continuous near on comparable lod fields", async () => {
  const dataDir = await createTempDataDir("wt-s3-3-lod-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n时间流逝，尘土落定。\n【状态】\nscene: 远方要塞"
  });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "s33lod",
        displayName: "s33lod",
        mode: "world-rpg",
        dataMode: "worldbook",
        sourceText: "要塞与哨所。",
        sourceType: "test"
      })
    });
    assert.equal(create.body.status, "ok");
    const moduleKey = create.body.module.id;
    await saveConnection(server, { id: "fake-s3-3-lod", baseUrl: fakeLlm.baseUrl });

    const locationGraph = baseGraph();
    const continuousExpected = continuousNearLod(createLodState({ lastEvolvedDay: 0 }), 10);

    // ----- Continuous never-dormant twin -----
    const contNpc = createNpcRuntime({
      id: "scout-cont",
      name: "连续斥候",
      locationId: "fort",
      relationDistance: REL,
      schedule: [{ atDay: 0, locationId: "fort" }]
    });
    let contState = {
      calendar: createCalendar(),
      locationGraph,
      currentLocationId: "fort",
      npcStates: [contNpc],
      proximityScope: recomputeNpcProximity({
        npcs: [contNpc],
        totalDays: 0,
        currentLocationId: "fort",
        protagonistId: "player"
      }).scope,
      protagonistId: "player"
    };
    for (let i = 0; i < 10; i++) {
      contState = await chatTurn(server, {
        moduleKey,
        input: "我原地等待。",
        engineState: contState
      });
    }
    assert.equal(contState.calendar.totalDays, 10);
    const contLod = contState.npcStates.find((n) => n.id === "scout-cont")?.lod;
    assert.ok(contLod, "continuous twin needs lod");
    assert.equal(contLod.fatigue, continuousExpected.fatigue);
    assert.equal(contLod.taskProgress, continuousExpected.taskProgress);
    const contRing = contState.proximityScope?.reasons?.["scout-cont"]?.ring;
    assert.ok(contRing === "core" || contRing === "near", `continuous ring=${contRing}`);

    // ----- Dormant → wake path -----
    // day 0–1 near at fort; day 2 schedule → outpost (dormant); wait to day 8;
    // travel fort→outpost (+2 days) → day 10 wake co-located.
    const dormNpc = createNpcRuntime({
      id: "scout-dorm",
      name: "沉睡斥候",
      locationId: "fort",
      relationDistance: REL,
      schedule: [
        { atDay: 0, locationId: "fort" },
        { atDay: 2, locationId: "outpost" }
      ]
    });
    let dormState = {
      calendar: createCalendar(),
      locationGraph,
      currentLocationId: "fort",
      npcStates: [dormNpc],
      proximityScope: recomputeNpcProximity({
        npcs: [dormNpc],
        totalDays: 0,
        currentLocationId: "fort",
        protagonistId: "player"
      }).scope,
      protagonistId: "player"
    };

    for (let i = 0; i < 8; i++) {
      dormState = await chatTurn(server, {
        moduleKey,
        input: "我原地等待。",
        engineState: dormState
      });
    }
    assert.equal(dormState.calendar.totalDays, 8);
    assert.equal(dormState.npcStates.find((n) => n.id === "scout-dorm")?.locationId, "outpost");
    const midRing = dormState.proximityScope?.reasons?.["scout-dorm"]?.ring;
    assert.equal(midRing, "dormant", `expected dormant while apart, got ${midRing}`);
    const midLod = dormState.npcStates.find((n) => n.id === "scout-dorm")?.lod;
    assert.ok(midLod);
    assert.equal(midLod.lastEvolvedDay, 2, `freeze at leave day, got ${midLod.lastEvolvedDay}`);
    assert.equal(midLod.fatigue, 2);
    assert.equal(midLod.taskProgress, 2);

    const afterWake = await chatTurn(server, {
      moduleKey,
      input: "我前往边境哨所。",
      engineState: dormState
    });
    assert.equal(afterWake.calendar.totalDays, 10);
    assert.equal(afterWake.currentLocationId, "outpost");
    const wakeRing = afterWake.proximityScope?.reasons?.["scout-dorm"]?.ring;
    assert.ok(wakeRing === "core" || wakeRing === "near", `wake ring=${wakeRing}`);
    const wakeLod = afterWake.npcStates.find((n) => n.id === "scout-dorm")?.lod;
    assert.ok(wakeLod);
    assert.equal(wakeLod.lastEvolvedDay, 10);

    // Comparable fields vs continuous twin / closed form
    assert.equal(wakeLod.fatigue, contLod.fatigue);
    assert.equal(wakeLod.taskProgress, contLod.taskProgress);
    assert.equal(wakeLod.fatigue, continuousExpected.fatigue);
    assert.equal(wakeLod.taskProgress, continuousExpected.taskProgress);

    const reports = afterWake.lodReports || [];
    assert.ok(
      reports.some((r) => r.id === "scout-dorm" && r.wake === true && r.mode === "catchup"),
      `expected wake catchup report, got ${JSON.stringify(reports)}`
    );
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
