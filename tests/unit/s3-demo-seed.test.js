import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildS3DemoSeed,
  unmetDemoThresholds,
  applyDemoRelationSeed,
  S3_DEMO_THRESHOLDS,
  S3_DEMO_EVENT_SEED,
  S3_DEMO_EVENT_TRIGGER_ROUND
} from "../../src/core/engine/s3-demo-seed.js";
import { getRecentChanges, findRelation, resetRelations } from "../../src/core/data/relations.js";
import { createWorldScope, runInWorldScope } from "../../src/core/engine/world-scope.js";
import { resetEngineState } from "../../src/core/engine/state-persistence.js";
import { directNarrative, getDirectorDecisions, resetDirectorLog } from "../../src/core/engine/director.js";
import { travelDuration } from "../../src/core/engine/location-graph.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DEMO_SHARED = join(ROOT, "defaults/examples/demo-world-cloud-steam-city/shared");

const EMOS = [
  { engagement: 6, tension: 2, fatigue: 3, curiosity: 6 },
  { engagement: 8, tension: 9, fatigue: 2, curiosity: 9 },
  { engagement: 9, tension: 8, fatigue: 3, curiosity: 8 },
  { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
];

test("s3-4 seed meets PRD demo thresholds", () => {
  const seed = buildS3DemoSeed();
  assert.deepEqual(unmetDemoThresholds(seed), []);
  assert.ok(seed.counts.nations >= S3_DEMO_THRESHOLDS.nations);
  assert.ok(seed.counts.organizations >= S3_DEMO_THRESHOLDS.organizations);
  assert.ok(seed.counts.races >= S3_DEMO_THRESHOLDS.races);
  assert.ok(seed.counts.locations >= S3_DEMO_THRESHOLDS.locations);
  assert.ok(seed.counts.locationEdges >= 1);
  assert.ok(seed.counts.npcs >= S3_DEMO_THRESHOLDS.npcs);
  assert.ok(seed.counts.npcsWithSchedule >= S3_DEMO_THRESHOLDS.npcs);
  // travel cost exists between harbor and fog tower
  const trip = travelDuration(seed.locationGraph, "brass-harbor", "fog-bell-tower");
  assert.ok(trip && trip.durationDays >= 1);
});

test("s3-4 demo-world shared JSON mirrors seed thresholds", () => {
  const orgs = JSON.parse(readFileSync(join(DEMO_SHARED, "organizations.json"), "utf8"));
  const races = JSON.parse(readFileSync(join(DEMO_SHARED, "races.json"), "utf8"));
  const locations = JSON.parse(readFileSync(join(DEMO_SHARED, "locations.json"), "utf8"));
  const characters = JSON.parse(readFileSync(join(DEMO_SHARED, "characters.json"), "utf8"));
  const graph = JSON.parse(readFileSync(join(DEMO_SHARED, "location-graph.json"), "utf8"));
  const schedules = JSON.parse(readFileSync(join(DEMO_SHARED, "npc-schedules.json"), "utf8"));
  const nations = orgs.filter((o) => o.type === "国家");
  assert.ok(nations.length >= 2, `nations=${nations.length}`);
  assert.ok(orgs.length >= 3, `orgs=${orgs.length}`);
  assert.ok(races.length >= 2);
  assert.ok(locations.length >= 5);
  assert.ok((graph.edges || []).length >= 1);
  assert.ok(characters.length >= 8);
  assert.equal(schedules.length, characters.length);
  assert.ok(schedules.every((n) => Array.isArray(n.schedule) && n.schedule.length > 0));
});

test("s3-4 relations.js path records assertable affinity/type change", () => {
  runInWorldScope(createWorldScope("s3-4-rel"), () => {
    const { relation, recentChanges } = applyDemoRelationSeed();
    assert.ok(relation);
    assert.equal(relation.type, "ally");
    assert.equal(relation.attitude, 3);
    assert.ok(recentChanges.length >= 1, "changeLog should record the update");
    assert.ok(
      recentChanges.some((c) =>
        (c.changes || []).some((ch) => ch.field === "attitude" || ch.field === "type")
      ),
      JSON.stringify(recentChanges)
    );
    assert.equal(findRelation("米拉·阀匠", "罗船长").type, "ally");
    assert.ok(getRecentChanges(5).length >= 1);
    resetRelations();
  });
});

test("s3-4 fixed seed triggers event on specified turn; scheme A empty does not; reproducible", () => {
  const seed = buildS3DemoSeed();
  const moduleData = seed.moduleData;

  function play(worldSeed, module, rounds = S3_DEMO_EVENT_TRIGGER_ROUND + 1) {
    return runInWorldScope(createWorldScope(`evt-${worldSeed}-${Math.random()}`), () => {
      resetEngineState();
      resetDirectorLog();
      for (let round = 0; round <= S3_DEMO_EVENT_TRIGGER_ROUND; round += 1) {
        directNarrative({
          emotionState: EMOS[round % EMOS.length],
          input: "调查雾铃塔",
          round,
          moduleData: module,
          worldSeed
        });
      }
      return getDirectorDecisions().map((d) => ({
        round: d.round,
        trigger: Boolean(d.trigger),
        method: d.method,
        hookId: d.hookId || null
      }));
    });
  }

  const a = play(S3_DEMO_EVENT_SEED, moduleData);
  const b = play(S3_DEMO_EVENT_SEED, moduleData);
  assert.deepEqual(a, b, "fixed seed must be reproducible");
  const atTrigger = a.find((d) => d.round === S3_DEMO_EVENT_TRIGGER_ROUND);
  assert.ok(atTrigger, "decision recorded for trigger round");
  assert.equal(atTrigger.trigger, true, `round ${S3_DEMO_EVENT_TRIGGER_ROUND} must trigger under seed ${S3_DEMO_EVENT_SEED}`);
  assert.ok(atTrigger.hookId, "triggered event must be grounded in a hook");

  const empty = play(S3_DEMO_EVENT_SEED, {});
  assert.ok(empty.every((d) => !d.trigger), "scheme A: no entity/motive → never trigger");
  assert.ok(empty.some((d) => d.method === "no_grounded_hook"), "scheme A method visible");

  const noMotive = play(S3_DEMO_EVENT_SEED, {
    worldState: { openThreads: [] },
    characters: [{ name: "无动机者" }],
    organizations: [{ name: "无目标组织" }]
  });
  assert.ok(noMotive.every((d) => !d.trigger), "no-motive / no-thread → never trigger");
});
