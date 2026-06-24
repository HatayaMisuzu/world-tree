// tests/unit/strategy-numeric-system.test.js — Stage 4 P2
import test from "node:test";
import assert from "node:assert/strict";
import { clampStrategicValue, applyStrategicDelta, normalizeStrategicVariable, detectNumericDrift, createDefaultDisplayStats } from "../../src/core/strategy-sim/strategy-numeric-system.js";

test("clampStrategicValue clamps within bounds", () => {
  assert.equal(clampStrategicValue(50, 0, 100), 50);
  assert.equal(clampStrategicValue(-10, 0, 100), 0);
  assert.equal(clampStrategicValue(200, 0, 100), 100);
  assert.equal(clampStrategicValue(NaN, 0, 100), 0);
});

test("applyStrategicDelta applies bounded delta with soft cap", () => {
  const v = { currentValue: 80, min: 0, max: 100, softMin: 10, softMax: 85 };
  // delta pushes into soft cap zone
  const r = applyStrategicDelta(v, 20, { maxDelta: 30 });
  assert.ok(r.value <= 100);
  assert.ok(r.value > 85, "should be above soft max but diminished");
  assert.ok(r.softCapped);
});

test("applyStrategicDelta enforces maxDelta ceiling", () => {
  const v = { currentValue: 50, max: 100 };
  const r = applyStrategicDelta(v, 100, { maxDelta: 20 });
  assert.equal(r.effectiveDelta, 20);
  assert.equal(r.warning, "delta_capped");
});

test("applyStrategicDelta handles NaN and null gracefully", () => {
  assert.equal(applyStrategicDelta(null, 5).warning, "null variable");
  const r = applyStrategicDelta({ currentValue: 50 }, NaN);
  assert.equal(r.effectiveDelta, 0);
});

test("normalizeStrategicVariable builds frozen variable", () => {
  const v = normalizeStrategicVariable({ id: "food", currentValue: 120, max: 100 });
  assert.equal(v.currentValue, 100); // clamped
  assert.equal(v.id, "food");
});

test("createDefaultDisplayStats returns 5 default stats", () => {
  const stats = createDefaultDisplayStats();
  assert.equal(stats.length, 5);
  assert.equal(stats[0].id, "material");
  assert.equal(stats[4].id, "risk");
  assert.equal(stats[4].direction, "lower_is_better");
});

test("detectNumericDrift catches out-of-range values", () => {
  const r = detectNumericDrift([{ id: "x", currentValue: 150, max: 100 }]);
  assert.equal(r.drift, true);
  assert.ok(r.warnings.length > 0);
});

test("numeric system does not write shared canon", () => {
  const v = normalizeStrategicVariable({ currentValue: 50 });
  assert.equal(v.canonWrites || v._canon, undefined);
});
