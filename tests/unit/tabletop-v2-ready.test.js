// tests/unit/tabletop-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTabletopV2Ready } from "../../src/core/tabletop/tabletop-v2-ready.js";

test("normalizeTabletopV2Ready preserves rule ref and runtime truth", () => {
  const t = normalizeTabletopV2Ready({
    ruleSourceRef: "dnd5e-basic",
    runtimeTruth: { lastResult: 14, isCritical: false }
  });
  assert.equal(t.ruleSourceRef, "dnd5e-basic");
  assert.equal(t.runtimeTruth.lastResult, 14);
});

test("normalizeTabletopV2Ready has safe defaults", () => {
  const t = normalizeTabletopV2Ready({});
  assert.equal(t.difficultyTag, "normal");
  assert.equal(t.checkResult, null);
});
