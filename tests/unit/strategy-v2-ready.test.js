// tests/unit/strategy-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStrategyV2Ready } from "../../src/core/strategy-sim/strategy-v2-ready.js";

test("normalizeStrategyV2Ready provides default display stats", () => {
  const s = normalizeStrategyV2Ready({ controlledEntityId: "kingdom-1" });
  assert.equal(s.controlledEntityId, "kingdom-1");
  assert.ok(Array.isArray(s.displayStats));
  assert.equal(s.displayStats.length, 5);
  assert.equal(s.displayStats[0].id, "material");
});

test("normalizeStrategyV2Ready accepts custom display stats", () => {
  const s = normalizeStrategyV2Ready({ displayStats: [{ id: "custom", label: "Custom", value: 99 }] });
  assert.equal(s.displayStats[0].id, "custom");
});

test("normalizeStrategyV2Ready preserves numeric state and probability policy", () => {
  const s = normalizeStrategyV2Ready({ numericState: { bounded: false }, probabilityPolicy: "exact" });
  assert.equal(s.numericState.bounded, false);
  assert.equal(s.probabilityPolicy, "exact");
});
