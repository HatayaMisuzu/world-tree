import test from "node:test";
import assert from "node:assert/strict";
import {
  resetTimeline,
  getCausalGraph,
  exportTimeline,
  traceCauses,
  traceImpact
} from "../../src/core/data/timeline-causality.js";
import { recordTurnCausality } from "../../src/core/engine/timeline-causality-wire.js";
import {
  exportEngineState,
  importEngineState,
  resetEngineState
} from "../../src/core/engine/state-persistence.js";
import { completeTurn } from "../../src/core/engine/lifecycle.js";
import { createCalendar } from "../../src/core/engine/world-tick.js";
import { createLocationGraph } from "../../src/core/engine/location-graph.js";
import { createNpcRuntime, recomputeNpcProximity } from "../../src/core/engine/npc-schedule.js";

test("S4-4 recordTurnCausality writes assertable nodes/edges for offscreen + world event", () => {
  resetTimeline();
  const result = recordTurnCausality({
    tickDelta: { unit: "period", amount: 2, reason: "travel", from: "fort", to: "outpost" },
    calendar: { totalDays: 2 },
    lodReports: [
      { id: "scout-far", ring: "far", mode: "far", days: 2, wake: false },
      { id: "scout-near", ring: "near", mode: "near", days: 2, wake: false }
    ],
    randomEvent: { title: "边境警报", description: "哨所升起狼烟" },
    round: 3
  });
  assert.ok(result.eventIds.length >= 2, "tick + offscreen and/or world event");
  assert.ok(result.tickEventId, "worldTick node");
  const graph = getCausalGraph();
  assert.ok(graph.nodes.length >= 3, `nodes=${graph.nodes.length}`);
  assert.ok(graph.edges.length >= 1, "dependsOn edges from offscreen/world → tick");
  // near fine steps must not flood the graph
  assert.equal(graph.nodes.some((n) => /scout-near/.test(n.title)), false);
  assert.equal(graph.nodes.some((n) => /远距摘要.*scout-far/.test(n.title)), true);
  assert.equal(graph.nodes.some((n) => n.title === "边境警报"), true);

  const causes = traceCauses(result.eventIds.find((id) => id !== result.tickEventId));
  assert.ok(!causes.error);
  assert.ok((causes.causes || []).length >= 1, "traceCauses reaches tick parent");
  const impact = traceImpact(result.tickEventId);
  assert.ok(!impact.error);
  assert.ok((impact.effects || []).length >= 1, "traceImpact reaches children");
});

test("S4-4 causality graph survives exportEngineState / importEngineState roundtrip", () => {
  resetEngineState();
  recordTurnCausality({
    tickDelta: { unit: "period", amount: 1, reason: "wait-idle" },
    calendar: { totalDays: 1 },
    lodReports: [{ id: "npc-a", mode: "far", days: 1 }],
    randomEvent: { title: "市场传闻" },
    round: 1
  });
  const before = getCausalGraph();
  assert.ok(before.nodes.length >= 2);
  const snap = exportEngineState({ turnCount: 1 });
  assert.ok(snap.causality, "causality key in engineSnapshot");
  assert.ok((snap.causality.events || []).length >= 2);
  assert.ok((snap.causality.edges || []).length >= 1);

  resetEngineState();
  assert.equal(getCausalGraph().nodes.length, 0);

  importEngineState(snap);
  const after = getCausalGraph();
  assert.equal(after.nodes.length, before.nodes.length);
  assert.equal(after.edges.length, before.edges.length);
  assert.deepEqual(
    after.nodes.map((n) => n.id).sort(),
    before.nodes.map((n) => n.id).sort()
  );
  resetEngineState();
});

test("S4-4 completeTurn reaches causality write (world event + worldTick)", () => {
  resetEngineState();
  const result = completeTurn({
    rawText: "【叙事】\n哨所的狼烟升起。\n【状态】\nscene: 远方要塞",
    input: "我原地等待。",
    model: {
      turnCount: 4,
      selected: { branch: "main", type: "daily" },
      moduleData: {
        characters: [{ name: "斥候" }, { name: "队长" }],
        scenes: [{ title: "远方要塞" }]
      },
      entities: []
    },
    moduleKey: "s4-4-unit",
    dataMode: "worldbook",
    directorResult: {
      event: {
        trigger: {
          trigger: true,
          event: { title: "狼烟示警", intensity: "major", description: "远方示警" }
        },
        assessment: {}
      },
      pacing: { type: "hold", blockNewEvents: false },
      emotion: { profile: {} },
      narrativeAdvice: ""
    },
    engineState: {
      dataMode: "worldbook",
      calendar: createCalendar(),
      locationGraph: createLocationGraph({
        nodes: [
          { id: "fort", name: "远方要塞" },
          { id: "outpost", name: "边境哨所" }
        ],
        edges: [{ from: "fort", to: "outpost", durationDays: 2 }]
      }),
      currentLocationId: "fort",
      npcStates: [],
      protagonistId: "player"
    }
  });

  assert.ok(result.overlayPatch?.randomEvent?.title === "狼烟示警");
  assert.ok(result.overlayPatch?.worldTick, "worldTick ran on wait");
  assert.ok(result.overlayPatch?.causality?.eventIds?.length >= 1, "causality write reached");
  const snap = result.overlayPatch?._engineState;
  assert.ok(snap?.causality?.events?.length >= 1, "persisted into engineSnapshot");
  assert.equal(
    (snap.causality.events || []).some((e) => e.title === "狼烟示警"),
    true
  );
  const graph = getCausalGraph();
  assert.ok(graph.nodes.some((n) => n.title === "狼烟示警"));
  resetEngineState();
});

test("S4-4 completeTurn LOD offscreen (far) creates causality edge from worldTick", () => {
  resetEngineState();
  const locationGraph = createLocationGraph({
    nodes: [
      { id: "fort", name: "远方要塞" },
      { id: "outpost", name: "边境哨所" }
    ],
    edges: [{ from: "fort", to: "outpost", durationDays: 2 }]
  });
  // Different location + mid relation → far ring (score ~0.635)
  const farNpc = createNpcRuntime({
    id: "far-scout",
    locationId: "outpost",
    relationDistance: 0.6,
    schedule: [{ atDay: 0, locationId: "outpost" }],
    lod: { fatigue: 0, taskProgress: 0, lastEvolvedDay: 0 }
  });
  const scope = recomputeNpcProximity({
    npcs: [farNpc],
    totalDays: 0,
    currentLocationId: "fort",
    protagonistId: "player"
  }).scope;
  assert.equal(scope.reasons?.["far-scout"]?.ring, "far", `ring=${scope.reasons?.["far-scout"]?.ring}`);

  const result = completeTurn({
    rawText: "【叙事】\n你在要塞等待。\n",
    input: "我原地等待。",
    model: {
      turnCount: 1,
      selected: { branch: "main" },
      moduleData: { characters: [{ name: "玩家" }], scenes: [{ title: "远方要塞" }] },
      entities: []
    },
    moduleKey: "s4-4-lod",
    dataMode: "worldbook",
    engineState: {
      dataMode: "worldbook",
      calendar: createCalendar(),
      locationGraph,
      currentLocationId: "fort",
      npcStates: [farNpc],
      proximityScope: scope,
      protagonistId: "player"
    }
  });

  assert.ok(result.overlayPatch?.worldTick);
  const reports = result.engineState?.lodReports || [];
  assert.ok(reports.some((r) => r.id === "far-scout" && r.mode === "far" && r.days > 0), JSON.stringify(reports));
  assert.ok(result.overlayPatch?.causality?.eventIds?.length >= 2, "tick + lod node");
  const graph = exportTimeline().graph;
  assert.ok(graph.nodes.some((n) => /远距摘要.*far-scout/.test(n.title)));
  assert.ok(graph.edges.length >= 1, "lod dependsOn worldTick");
  resetEngineState();
});
