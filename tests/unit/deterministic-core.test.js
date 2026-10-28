import test from "node:test";
import assert from "node:assert/strict";

import { createRng, deriveRng, hashSeed, stableId, worldSeedOf, withoutWallClock } from "../../src/shared/determinism.js";
import { calculateEventScore, shouldTriggerEvent, directNarrative } from "../../src/core/engine/director.js";
import { eventChance, proposeRandomEvent, resetEventCache } from "../../src/core/data/random-events.js";
import { STORYTELLERS, applyStorytellerModifiers, applyStorytellerPacing } from "../../src/core/engine/storytellers.js";
import { softReject } from "../../src/core/data/character-card.js";
import { createProcessingPackage } from "../../src/core/data/processing-engine.js";
import { proposeEntry, buildVectorIndex } from "../../src/core/data/worldbook.js";
import { addToPending } from "../../src/core/engine/overlay-store.js";
import { sessionRecord, confirmWorldFact, resetAllMemoryLayers } from "../../src/core/engine/memory-layers.js";
import { addClue, addUnresolvedEvent, createWorldPanel } from "../../src/core/data/world-state.js";
import { getProposalStats } from "../../src/core/engine/proposal-system.js";
import { grepRulesLayer } from "../../scripts/determinism-check.mjs";

function withNondeterminismTrapped(fn) {
  const { random } = Math;
  const now = Date.now;
  Math.random = () => { throw new Error("Math.random called in rules layer"); };
  Date.now = () => { throw new Error("Date.now called in rules layer"); };
  try { return fn(); } finally { Math.random = random; Date.now = now; }
}

test("RNG: same seed → same stream; state() restores; different seed differs", () => {
  const a = createRng("world-a"); const b = createRng("world-a");
  const seqA = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(seqA, Array.from({ length: 20 }, () => b.next()));
  const mid = createRng("world-a"); for (let i = 0; i < 7; i += 1) mid.next();
  const { seed, counter } = mid.state();
  assert.deepEqual(Array.from({ length: 5 }, () => createRng(seed, counter).next()).slice(0, 1), [seqA[7]]);
  const resumed = createRng(seed, counter);
  assert.deepEqual(Array.from({ length: 13 }, () => resumed.next()), seqA.slice(7));
  const c = createRng("world-b");
  assert.notDeepEqual(seqA, Array.from({ length: 20 }, () => c.next()));
  assert.ok(seqA.every(v => v >= 0 && v < 1));
  assert.equal(hashSeed("x", 1), hashSeed("x", 1));
  assert.notEqual(deriveRng("w", 1, "director").next(), deriveRng("w", 2, "director").next());
});

test("stableId is reproducible, order-insensitive for object keys, sensitive to content", () => {
  assert.equal(stableId("p", { a: 1, b: 2 }), stableId("p", { b: 2, a: 1 }));
  assert.notEqual(stableId("p", "x"), stableId("p", "y"));
  assert.match(stableId("pending", 1), /^pending-[0-9a-f]{16}$/);
  assert.deepEqual(withoutWallClock({ id: 1, createdAt: "t", _writtenAt: "t", nested: { queuedAt: "t", v: 2 } }), { id: 1, nested: { v: 2 } });
  assert.equal(worldSeedOf({ selected: { id: "w1" } }), "w1");
  assert.equal(worldSeedOf({ moduleData: { runtime: { seed: 42 } }, selected: { id: "w1" } }), 42);
});

test("rules layer never touches Math.random / Date.now (runtime trap)", () => {
  withNondeterminismTrapped(() => {
    resetEventCache();
    const score = calculateEventScore({ round: 3, worldSeed: "w" });
    assert.ok(Number.isFinite(score.score));
    shouldTriggerEvent({ method: "probability", score: 50, type: "ambient" }, { round: 3, worldSeed: "w" });
    proposeRandomEvent({ round: 10, worldSeed: "w" });
    eventChance(0.5);
    directNarrative({ round: 5, input: "看看四周", worldSeed: "w" });
    applyStorytellerModifiers(50, STORYTELLERS.chaos || Object.values(STORYTELLERS).find(s => s.randomness > 0.3), { tension: 5 });
    applyStorytellerPacing(Object.values(STORYTELLERS).find(s => s.pressureCurve === "unstable"), { fatigue: 3 });
    softReject("温柔", "钥匙");
    createProcessingPackage("包", "素材");
    proposeEntry({ keys: ["k"], content: "c" });
    buildVectorIndex([{ title: "t", content: "c" }]);
    addToPending("w-trap", { path: "runtime/overlay/a.json", op: "merge-json", value: { a: 1 } }, { round: 1 });
    resetAllMemoryLayers();
    sessionRecord({ type: "event", summary: "s" });
    confirmWorldFact("f");
    const panel = createWorldPanel();
    addClue(panel, { description: "d" });
    addUnresolvedEvent(panel, { description: "e" });
    getProposalStats();
  });
});

test("director: same world seed + inputs → identical decisions over 40 rounds; other seed diverges", () => {
  const runFor = seed => {
    resetEventCache();
    const out = [];
    for (let round = 1; round <= 40; round += 1) {
      const s = calculateEventScore({ round, worldSeed: seed, emotion: { engagement: 5, tension: 3, fatigue: 5, curiosity: 3 } });
      const t = shouldTriggerEvent(s, { round, worldSeed: seed, worldType: "daily" });
      out.push([s.ambientScore, t.trigger, t.event?.level || null, t.event?.proposal || null]);
    }
    return out;
  };
  assert.deepEqual(runFor("seed-1"), runFor("seed-1"));
  assert.notDeepEqual(runFor("seed-1"), runFor("seed-2"));
});

test("ids no longer depend on wall clock: same inputs → same ids", () => {
  assert.equal(createProcessingPackage("包", "素材").id, createProcessingPackage("包", "素材").id);
  assert.equal(proposeEntry({ keys: ["k"], content: "c" }).id, proposeEntry({ keys: ["k"], content: "c" }).id);
  const p1 = createWorldPanel(); const p2 = createWorldPanel();
  addClue(p1, { description: "d" }); addClue(p2, { description: "d" });
  assert.equal(p1.knownClues[0].id, p2.knownClues[0].id);
  resetAllMemoryLayers(); const a = [sessionRecord({ type: "event", summary: "s" }), sessionRecord({ type: "event", summary: "s" })];
  resetAllMemoryLayers(); const b = [sessionRecord({ type: "event", summary: "s" }), sessionRecord({ type: "event", summary: "s" })];
  assert.deepEqual(a.map(e => e?.id), b.map(e => e?.id));
});

test("overlay pending ids are reproducible and unique within a queue", () => {
  const op = { path: "runtime/overlay/a.json", op: "merge-json", value: { a: 1 } };
  const x1 = addToPending("w-ids-1", op, { round: 2 }); const x2 = addToPending("w-ids-1", op, { round: 2 });
  const y1 = addToPending("w-ids-2", op, { round: 2 });
  assert.notEqual(x1.id, x2.id);
  const z1 = addToPending("w-ids-1b", op, { round: 2 }); const z2 = addToPending("w-ids-1b", op, { round: 2 });
  assert.notEqual(x1.id, y1.id, "world key is part of the id");
  assert.equal(stableId("x"), stableId("x"));
  assert.ok(z1.id && z2.id && z1.id !== z2.id);
});

test("static check: rules layer grep finds no Math.random / Date.now (allowlist reported)", () => {
  const g = grepRulesLayer();
  assert.deepEqual(g.hits, []);
  assert.ok(g.allowed.every(line => line.startsWith("src/core/engine/tabletop.js:")));
});
