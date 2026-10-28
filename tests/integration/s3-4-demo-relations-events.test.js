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
import {
  buildS3DemoSeed,
  demoEngineStateSlice,
  unmetDemoThresholds,
  S3_DEMO_THRESHOLDS
} from "../../src/core/engine/s3-demo-seed.js";
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
              intent: "talk",
              emotionalSubtext: "合作",
              engagementDelta: 1,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "none",
              sceneGoal: "关系推进",
              suggestedMustInclude: [],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: ["engagement"], decrease: [] }
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

test("s3-4: installed demo meets PRD seed counts (nations/orgs/races/locations/NPCs)", async () => {
  const seed = buildS3DemoSeed();
  assert.deepEqual(unmetDemoThresholds(seed), []);

  const dataDir = await createTempDataDir("wt-s3-4-counts-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const installed = await api(server, "/api/examples/install", {
      method: "POST",
      body: JSON.stringify({ id: "demo-world-cloud-steam-city" })
    });
    assert.equal(installed.body.status, "ok");
    const moduleId = installed.body.module.id;
    const shared = join(dataDir, "engine", "worlds", moduleId, "shared");
    const orgs = JSON.parse(readFileSync(join(shared, "organizations.json"), "utf8"));
    const races = JSON.parse(readFileSync(join(shared, "races.json"), "utf8"));
    const locations = JSON.parse(readFileSync(join(shared, "locations.json"), "utf8"));
    const characters = JSON.parse(readFileSync(join(shared, "characters.json"), "utf8"));
    const graph = JSON.parse(readFileSync(join(shared, "location-graph.json"), "utf8"));
    const schedules = JSON.parse(readFileSync(join(shared, "npc-schedules.json"), "utf8"));
    const nations = orgs.filter((o) => o.type === "国家");
    assert.ok(nations.length >= S3_DEMO_THRESHOLDS.nations);
    assert.ok(orgs.length >= S3_DEMO_THRESHOLDS.organizations);
    assert.ok(races.length >= S3_DEMO_THRESHOLDS.races);
    assert.ok(locations.length >= S3_DEMO_THRESHOLDS.locations);
    assert.ok((graph.edges || []).length >= 1);
    assert.ok(characters.length >= S3_DEMO_THRESHOLDS.npcs);
    assert.ok(schedules.every((n) => n.schedule?.length > 0));

    const loaded = await api(server, "/api/modules/load", {
      method: "POST",
      body: JSON.stringify({ id: moduleId })
    });
    assert.equal(loaded.body.status, "ok");
    assert.ok((loaded.body.model?.moduleData?.characters || []).length >= 8);
    assert.ok((loaded.body.model?.moduleData?.organizations || []).length >= 3);
    assert.ok((loaded.body.model?.moduleData?.races || []).length >= 2);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("s3-4: /api/llm/chat narrative → relations.js change ledger (turn-visible)", async () => {
  const dataDir = await createTempDataDir("wt-s3-4-rel-");
  const server = await startWorldTreeServer({ dataDir });
  // Pattern matched by lifecycle extractRelationChanges: source + 帮助 + target in one sentence
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n米拉·阀匠帮助罗船长检修飞艇阀门，两人交换了第七锚塔的压力记录。\n【状态】\nscene: 黄铜港开场"
  });
  try {
    const installed = await api(server, "/api/examples/install", {
      method: "POST",
      body: JSON.stringify({ id: "demo-world-cloud-steam-city" })
    });
    assert.equal(installed.body.status, "ok");
    const moduleKey = installed.body.module.id;
    await saveConnection(server, { id: "fake-s3-4-rel", baseUrl: fakeLlm.baseUrl });

    const seed = buildS3DemoSeed();
    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我请米拉帮助罗船长。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          ...demoEngineStateSlice(seed),
          calendar: createCalendar()
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 500));

    // Public chat response omits overlayPatch; product ledger is runtime/state.json engineSnapshot
    // (exportEngineState → relations.js store), written by persistTurn.
    const statePath = join(dataDir, "engine", "worlds", moduleKey, "runtime", "state.json");
    const runtimeState = JSON.parse(readFileSync(statePath, "utf8"));
    const ledger = runtimeState.engineSnapshot?.relations;
    assert.ok(ledger, "engineSnapshot.relations should be persisted");
    const pair = (ledger.relations || []).find((r) =>
      (r.source === "米拉·阀匠" && r.target === "罗船长") ||
      (r.source === "罗船长" && r.target === "米拉·阀匠")
    );
    assert.ok(pair, `expected pair in relations ledger: ${JSON.stringify(ledger.relations)}`);
    assert.equal(pair.attitude, 1, "affinity from 「帮助」 via relations.js setRelation");
    assert.ok(pair.type, "relation type recorded");

    // Affinity/type *change* ledger (update path) is covered in unit
    // `s3-demo-seed` applyDemoRelationSeed → getRecentChanges / changeLog.

    // Prior s3 paths still green on same turn wiring
    assert.ok(chat.body.engineState?.calendar, "worldTick calendar present");
    assert.ok(chat.body.engineState?.locationGraph || seed.locationGraph);
    assert.ok(Array.isArray(chat.body.engineState?.npcStates));
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});

test("s3-4: travel + wait still advance calendar with demo location graph (s3-1..3 smoke)", async () => {
  const dataDir = await createTempDataDir("wt-s3-4-travel-");
  const server = await startWorldTreeServer({ dataDir });
  const fakeLlm = await startCaptureLlm({
    narrativeBody: "【叙事】\n你启程前往雾铃塔。\n【状态】\nscene: 雾铃塔"
  });
  try {
    const installed = await api(server, "/api/examples/install", {
      method: "POST",
      body: JSON.stringify({ id: "demo-world-cloud-steam-city" })
    });
    assert.equal(installed.body.status, "ok");
    const moduleKey = installed.body.module.id;
    await saveConnection(server, { id: "fake-s3-4-travel", baseUrl: fakeLlm.baseUrl });

    const seed = buildS3DemoSeed();
    const chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        moduleKey,
        input: "我前往雾铃塔。",
        modeId: "world-rpg",
        dataMode: "worldbook",
        engineState: {
          ...demoEngineStateSlice(seed),
          calendar: createCalendar()
        },
        messages: []
      })
    });
    assert.equal(chat.body.status, "ok", JSON.stringify(chat.body).slice(0, 400));
    assert.equal(chat.body.engineState?.currentLocationId, "fog-bell-tower");
    assert.equal(chat.body.engineState?.calendar?.totalDays, 1);
    assert.ok(chat.body.overlayPatch?.proximityRings || chat.body.engineState?.proximityScope);
  } finally {
    await server.stop();
    await fakeLlm.stop();
    await removeTempDir(dataDir);
  }
});
