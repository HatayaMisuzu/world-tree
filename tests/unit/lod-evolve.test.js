import test from "node:test";
import assert from "node:assert/strict";

import {
  LOD_RATES,
  createLodState,
  applyLodDays,
  evolveNpcLod,
  evolveNpcsByLod,
  continuousNearLod,
  ensureNpcLod
} from "../../src/core/engine/lod-evolve.js";
import { createNpcRuntime } from "../../src/core/engine/npc-schedule.js";
import { calculateProximityScope } from "../../src/core/proximity/proximity-scope.js";

test("near fine vs far summary: same comparable net; modes differ", () => {
  const seed = createLodState({ lastEvolvedDay: 0 });
  const near = applyLodDays(seed, 3, "near");
  const far = applyLodDays(seed, 3, "far");
  assert.equal(near.fatigue, far.fatigue);
  assert.equal(near.taskProgress, far.taskProgress);
  assert.equal(near.fatigue, 3 * LOD_RATES.FATIGUE_PER_DAY);
  assert.equal(near.lastMode, "near");
  assert.equal(far.lastMode, "far");
  assert.equal(near.fineSteps, 3);
  assert.equal(far.summaryBatches, 1);
});

test("dormant freezes; wake catch-up matches continuous near on comparable fields", () => {
  let npc = ensureNpcLod(
    createNpcRuntime({ id: "scout", locationId: "fort", relationDistance: 0.2 }),
    0
  );

  // days 1..2 near
  ({ npc } = evolveNpcLod(npc, { totalDays: 2, ring: "near", previousRing: "near" }));
  assert.equal(npc.lod.fatigue, 2);
  assert.equal(npc.lod.taskProgress, 2);
  assert.equal(npc.lod.lastEvolvedDay, 2);

  // day 3 enter dormant (flush under previous near, then freeze)
  ({ npc } = evolveNpcLod(npc, { totalDays: 3, ring: "dormant", previousRing: "near" }));
  assert.equal(npc.lod.fatigue, 3);
  assert.equal(npc.lod.lastEvolvedDay, 3);
  assert.equal(npc.lod.lastMode, "dormant");

  // days 4..7 stay dormant — freeze
  ({ npc } = evolveNpcLod(npc, { totalDays: 7, ring: "dormant", previousRing: "dormant" }));
  assert.equal(npc.lod.fatigue, 3);
  assert.equal(npc.lod.taskProgress, 3);
  assert.equal(npc.lod.lastEvolvedDay, 3);

  // day 10 wake → near: catch-up 7 days
  const woke = evolveNpcLod(npc, { totalDays: 10, ring: "near", previousRing: "dormant" });
  npc = woke.npc;
  assert.equal(woke.applied.wake, true);
  assert.equal(woke.applied.mode, "catchup");
  assert.equal(woke.applied.days, 7);
  assert.equal(npc.lod.fatigue, 10);
  assert.equal(npc.lod.taskProgress, 10);
  assert.equal(npc.lod.lastEvolvedDay, 10);

  const continuous = continuousNearLod(createLodState({ lastEvolvedDay: 0 }), 10);
  assert.equal(npc.lod.fatigue, continuous.fatigue);
  assert.equal(npc.lod.taskProgress, continuous.taskProgress);
});

test("evolveNpcsByLod uses ringChanges for wake detection", () => {
  const npc = ensureNpcLod(
    createNpcRuntime({
      id: "scout-lin",
      locationId: "outpost",
      relationDistance: 0.3,
      lod: { fatigue: 1, taskProgress: 1, lastEvolvedDay: 1 }
    }),
    1
  );
  const previousScope = calculateProximityScope({
    currentLocationId: "fort",
    candidates: [{ id: "scout-lin", locationId: "outpost", relationDistance: 0.3 }]
  });
  assert.ok(
    previousScope.reasons["scout-lin"].ring === "far" ||
      previousScope.reasons["scout-lin"].ring === "dormant"
  );

  // Force dormant previous via ringChanges.from even if score says far
  const scope = calculateProximityScope({
    currentLocationId: "outpost",
    candidates: [{ id: "scout-lin", locationId: "outpost", relationDistance: 0.3 }]
  });
  assert.ok(scope.reasons["scout-lin"].ring === "core" || scope.reasons["scout-lin"].ring === "near");

  const { npcs, reports } = evolveNpcsByLod({
    npcs: [npc],
    totalDays: 5,
    scope,
    previousScope,
    ringChanges: [{ id: "scout-lin", from: "dormant", to: scope.reasons["scout-lin"].ring }]
  });
  assert.equal(npcs[0].lod.fatigue, 5);
  assert.equal(npcs[0].lod.taskProgress, 5);
  assert.ok(reports.some((r) => r.id === "scout-lin" && r.wake === true));
});
