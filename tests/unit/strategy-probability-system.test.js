// tests/unit/strategy-probability-system.test.js — Stage 4 P2
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProbabilityEvent, rollProbabilityEvent, getPlayerVisibleProbability } from "../../src/core/strategy-sim/strategy-probability-system.js";

test("normalizeProbabilityEvent clamps base chance between min/max", () => {
  const e = normalizeProbabilityEvent({ baseChance: -0.5, minChance: 0.05 });
  assert.ok(e.baseChance >= 0.05);
  const e2 = normalizeProbabilityEvent({ baseChance: 5, maxChance: 0.95 });
  assert.ok(e2.baseChance <= 0.95);
});

test("rollProbabilityEvent is deterministic with fixed seed", () => {
  const e = normalizeProbabilityEvent({ baseChance: 1.0 });
  const r = rollProbabilityEvent(e, () => 0.5);
  assert.equal(r.success, true);
  assert.equal(r.rolled, true);
});

test("rollProbabilityEvent fails with low seed", () => {
  const e = normalizeProbabilityEvent({ baseChance: 0.0 });
  const r = rollProbabilityEvent(e, () => 0.99);
  assert.equal(r.success, false);
});

test("rollProbabilityEvent applies hidden modifiers", () => {
  const e = normalizeProbabilityEvent({
    baseChance: 0.3,
    hiddenModifiers: [{ value: 0.7 }]
  });
  const r = rollProbabilityEvent(e, () => 0.5);
  assert.equal(r.success, true);
  assert.equal(r.wasModified, true);
});

test("getPlayerVisibleProbability exact shows percentage", () => {
  const e = normalizeProbabilityEvent({ baseChance: 0.65 });
  const r = getPlayerVisibleProbability(e, "exact");
  assert.equal(r.visible, true);
  assert.match(r.display, /65%/);
});

test("getPlayerVisibleProbability range shows approximate", () => {
  const e = normalizeProbabilityEvent({ baseChance: 0.65 });
  const r = getPlayerVisibleProbability(e, "range");
  assert.equal(r.visible, true);
  assert.match(r.display, /大约/);
});

test("getPlayerVisibleProbability hint shows qualitative text", () => {
  assert.match(getPlayerVisibleProbability(normalizeProbabilityEvent({ baseChance: 0.9 }), "hint").display, /较高/);
  assert.match(getPlayerVisibleProbability(normalizeProbabilityEvent({ baseChance: 0.5 }), "hint").display, /把握/);
  assert.match(getPlayerVisibleProbability(normalizeProbabilityEvent({ baseChance: 0.3 }), "hint").display, /风险/);
  assert.match(getPlayerVisibleProbability(normalizeProbabilityEvent({ baseChance: 0.1 }), "hint").display, /渺茫/);
});

test("getPlayerVisibleProbability hidden shows nothing", () => {
  const e = normalizeProbabilityEvent({ baseChance: 0.7 });
  const r = getPlayerVisibleProbability(e, "hidden");
  assert.equal(r.visible, false);
});

test("rollProbabilityEvent handles null", () => {
  const r = rollProbabilityEvent(null);
  assert.equal(r.rolled, false);
  assert.ok(r.error);
});
