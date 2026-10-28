// S2 dc-2: ③ per-world engine state, ④ director plan A (grounded events, decisions in snapshot)
import test from "node:test";
import assert from "node:assert/strict";

import { WorldSession } from "../../src/core/engine/world-session.js";
import { createWorldScope, runInWorldScope } from "../../src/core/engine/world-scope.js";
import { confirmWorldFact, queryWorldFacts } from "../../src/core/engine/memory-layers.js";
import { setRelation, findRelation } from "../../src/core/data/relations.js";
import { createProposal, getProposalStats } from "../../src/core/engine/proposal-system.js";
import { exportEngineState, importEngineState, resetEngineState } from "../../src/core/engine/state-persistence.js";
import { getEventHistory, importEventHistory } from "../../src/core/data/random-events.js";
import {
  collectStoryHooks, directNarrative, analyzePacing, getDirectorDecisions, resetDirectorLog,
  importPredictionStores, exportPredictionStores
} from "../../src/core/engine/director.js";

import { withoutWallClock } from "../../src/shared/determinism.js";

const tick = () => new Promise((r) => setImmediate(r));
const DEMO = {
  worldState: { openThreads: ["第七锚塔失压", "匿名委托来源", "旧锚链齿轮用途"] },
  characters: [{ id: "mira", name: "米拉", motive: "查清压力记录被谁改过" }, { id: "x", name: "路人" }],
  organizations: [{ name: "灰烬工会", goals: ["控制第七锚塔"] }]
};
const EMOS = [
  { engagement: 6, tension: 2, fatigue: 3, curiosity: 6 },
  { engagement: 8, tension: 9, fatigue: 2, curiosity: 9 },
  { engagement: 9, tension: 8, fatigue: 3, curiosity: 8 },
  { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
];

function playDirector({ seed, moduleData, rounds = 40 }) {
  return runInWorldScope(createWorldScope(`t-${seed}-${Math.random()}`), () => {
    resetEngineState();
    for (let round = 0; round < rounds; round += 1) {
      directNarrative({ emotionState: EMOS[round % EMOS.length], input: "调查", round, moduleData, worldSeed: seed });
    }
    // wall-clock createdAt in cache entries is excluded, same as the state hash (moved to dc-3)
    return { decisions: getDirectorDecisions(), predictions: withoutWallClock(exportPredictionStores()) };
  });
}

test("③ two worlds interleaving async turns never see each other's engine state", async () => {
  resetEngineState();
  confirmWorldFact("DEFAULT_SCOPE_FACT", "t", "confirmed", "event");
  const a = new WorldSession("world:A");
  const b = new WorldSession("world:B");
  const turn = (session, tag) => session.runTurn(async () => {
    session.beginTurn(null);
    confirmWorldFact(`${tag}_FACT`, "t", "confirmed", "event");
    await tick();
    setRelation({ source: `${tag}1`, target: `${tag}2`, type: "ally", attitude: 3 });
    await tick();
    createProposal({ typeId: "world_fact", change: { fact: tag }, moduleKey: tag, round: 1 });
    await tick();
    return {
      own: queryWorldFacts(`${tag}_FACT`).length,
      other: queryWorldFacts(tag === "A" ? "B_FACT" : "A_FACT").length,
      dflt: queryWorldFacts("DEFAULT_SCOPE").length,
      otherRel: findRelation(tag === "A" ? "B1" : "A1", tag === "A" ? "B2" : "A2") ? 1 : 0,
      proposals: getProposalStats().total ?? getProposalStats().active ?? null,
      snapshot: exportEngineState({ turnCount: 1 })
    };
  });
  const [ra, rb] = await Promise.all([turn(a, "A"), turn(b, "B")]);
  for (const r of [ra, rb]) {
    assert.equal(r.own, 1);
    assert.equal(r.other, 0, "no cross-world memory leak");
    assert.equal(r.dflt, 0, "default/global scope does not leak into a world");
    assert.equal(r.otherRel, 0, "no cross-world relation leak");
  }
  assert.equal(queryWorldFacts("DEFAULT_SCOPE_FACT").length, 1, "world turns do not wipe the default scope");
  assert.equal(queryWorldFacts("A_FACT").length + queryWorldFacts("B_FACT").length, 0);

  // engineSnapshot follows the world: a fresh session for A restored from A's snapshot sees A only
  const a2 = new WorldSession("world:A");
  const seen = await a2.runTurn(async () => { a2.beginTurn(ra.snapshot); return [queryWorldFacts("A_FACT").length, queryWorldFacts("B_FACT").length]; });
  assert.deepEqual(seen, [1, 0]);
  resetEngineState();
});

test("③ alternating turns A,B,A,B keep per-world state across turns (in-memory scope persists)", async () => {
  const a = new WorldSession("world:alt-A"); const b = new WorldSession("world:alt-B");
  for (let i = 0; i < 3; i += 1) {
    await a.runTurn(async () => { confirmWorldFact(`altA-${i}`, "t", "confirmed", "event"); });
    await b.runTurn(async () => { confirmWorldFact(`altB-${i}`, "t", "confirmed", "event"); });
  }
  assert.equal(await a.runTurn(async () => queryWorldFacts("altA").length), 3);
  assert.equal(await a.runTurn(async () => queryWorldFacts("altB").length), 0);
  assert.equal(await b.runTurn(async () => queryWorldFacts("altB").length), 3);
});

test("④ timing: beginTurn restores before the director; finalize does not wipe the director's decisions", async () => {
  const s = new WorldSession("world:timing");
  const out = await s.runTurn(async () => {
    s.beginTurn(null);
    directNarrative({ emotionState: EMOS[0], round: 7, moduleData: DEMO, worldSeed: "timing" });
    const { result } = await s.finalizeWithSnapshot(null, () => ({ overlayPatch: { _engineState: exportEngineState({ turnCount: 7 }) } }));
    return result.overlayPatch._engineState;
  });
  assert.equal(out.director.decisions.length, 1);
  assert.equal(out.director.decisions[0].round, 7);
  // legacy path (no beginTurn) still restores inside finalize
  const legacy = await s.runTurn(async () => {
    confirmWorldFact("WIPED_BY_RESTORE", "t", "confirmed", "event");
    await s.finalizeWithSnapshot(null, () => ({}));
    return queryWorldFacts("WIPED_BY_RESTORE").length;
  });
  assert.equal(legacy, 0);
});

test("④ director replay: same seed + same inputs → identical decisions and cache; other seed diverges", () => {
  const x = playDirector({ seed: "seed-1", moduleData: DEMO });
  const y = playDirector({ seed: "seed-1", moduleData: DEMO });
  assert.deepEqual(x, y);
  assert.ok(x.decisions.some((d) => d.trigger), "the scenario actually triggers events");
  const z = playDirector({ seed: "seed-2", moduleData: DEMO });
  assert.notDeepEqual(x.decisions, z.decisions);
});

test("④ plan A: no existing threads/motives → never any event, however high tension/pacing scores get", () => {
  for (const moduleData of [{}, { worldState: { openThreads: [] }, characters: [{ name: "无动机者" }] }]) {
    const { decisions, predictions } = playDirector({ seed: "empty", moduleData, rounds: 60 });
    assert.equal(decisions.filter((d) => d.trigger).length, 0);
    assert.ok(decisions.some((d) => d.method === "no_grounded_hook"), "scores were high enough to have triggered before plan A");
    assert.deepEqual(Object.values(predictions).flatMap((p) => p.events), [], "nothing invented into the cache either");
  }
});

test("④ plan A: every triggered event is grounded in an existing hook", () => {
  const hooks = collectStoryHooks(DEMO);
  assert.deepEqual(hooks.map((h) => h.kind).sort(), ["faction_motive", "npc_motive", "open_thread", "open_thread", "open_thread"]);
  assert.deepEqual(collectStoryHooks(DEMO), hooks, "stable order and ids");
  const ids = new Set(hooks.map((h) => h.id));
  const { decisions } = playDirector({ seed: "grounded", moduleData: DEMO, rounds: 80 });
  const fired = decisions.filter((d) => d.trigger);
  assert.ok(fired.length > 0);
  for (const d of fired) assert.ok(ids.has(d.hookId), `event ${d.title} has no hook`);
});

test("④ cached event goes stale when its hook disappears from world state", () => {
  runInWorldScope(createWorldScope("stale"), () => {
    resetEngineState();
    importPredictionStores({ _default: { events: [{ id: "cache-1", round: 1, score: 49, type: "ambient", status: "pending",
      event: { level: "light", title: "已解决的线索", hookId: "hook-gone" } }], maxSize: 5, counter: 1 } });
    const r = directNarrative({ emotionState: EMOS[0], round: 3, moduleData: { worldState: { openThreads: ["别的线索"] } }, worldSeed: "s" });
    assert.notEqual(r.event.trigger.method, "cache_promotion");
  });
});

test("snapshot round-trip carries director decisions and event history (previously history was dropped)", () => {
  runInWorldScope(createWorldScope("rt"), () => {
    resetEngineState();
    importEventHistory([{ level: "light", title: "t", round: 4 }]);
    directNarrative({ emotionState: EMOS[0], round: 5, moduleData: DEMO, worldSeed: "rt" });
    const snap = JSON.parse(JSON.stringify(exportEngineState({ turnCount: 5 })));
    resetEngineState(); resetDirectorLog();
    assert.equal(getDirectorDecisions().length, 0);
    importEngineState(snap);
    assert.deepEqual(getDirectorDecisions(), snap.director.decisions);
    assert.deepEqual(getEventHistory(), snap.events.history);
  });
});

test("regression: analyzePacing high-engagement path no longer throws (curiosity was undeclared)", () => {
  assert.doesNotThrow(() => analyzePacing({ engagement: 9, tension: 5, fatigue: 2, curiosity: 9 }, 5, 0));
  assert.ok(analyzePacing({ engagement: 9, tension: 5, fatigue: 2, curiosity: 9 }, 5, 0).advices.some((a) => a.signal === "最佳窗口"));
});

test("④ director cooldown takes effect: no new event within COOLDOWN_MIN_ROUNDS of a trigger (caller passes lastEventRound=0)", async () => {
  const { PACING_THRESHOLDS } = await import("../../src/core/engine/constants.js");
  const cooldown = PACING_THRESHOLDS.COOLDOWN_MIN_ROUNDS;
  const hot = { engagement: 9, tension: 9, fatigue: 1, curiosity: 9 };
  const result = runInWorldScope(createWorldScope(`cooldown-${Math.random()}`), () => {
    resetEngineState();
    const rounds = [];
    for (let round = 1; round <= 60; round += 1) {
      // 主管线的真实调用方式：lastEventRound 一直是 0（从不更新）
      const r = directNarrative({ emotionState: hot, input: "调查", round, moduleData: DEMO, worldSeed: "cooldown-seed", lastEventRound: 0 });
      rounds.push({ round, trigger: Boolean(r.event.trigger.trigger), cooling: r.pacing.advices.some(a => a.signal === "事件冷却") });
    }
    return rounds;
  });
  const triggered = result.filter(r => r.trigger).map(r => r.round);
  assert.ok(triggered.length >= 3, `expected several triggers in 60 hot rounds, got ${triggered.length}`);
  for (let i = 1; i < triggered.length; i += 1) {
    assert.ok(triggered[i] - triggered[i - 1] >= cooldown, `events at rounds ${triggered[i - 1]} and ${triggered[i]} violate cooldown ${cooldown}`);
  }
  const first = triggered[0];
  for (let k = 1; k < cooldown; k += 1) {
    assert.equal(result.find(r => r.round === first + k).cooling, true, `round ${first + k} should report 事件冷却`);
  }
});
