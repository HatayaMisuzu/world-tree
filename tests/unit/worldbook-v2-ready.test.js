// tests/unit/worldbook-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorldV2Ready } from "../../src/core/worldbook/worldbook-v2-ready.js";

test("normalizeWorldV2Ready produces frozen record with refs", () => {
  const w = normalizeWorldV2Ready({ worldEntityRef: "kingdom", hiddenStorylineRef: "plot-1" });
  assert.equal(w.worldEntityRef, "kingdom");
  assert.equal(w.hiddenStorylineRef, "plot-1");
  assert.equal(w.visibilityScope, "gm_only");
});

test("normalizeWorldV2Ready preserves candidate state", () => {
  const w = normalizeWorldV2Ready({ regionStateCandidate: { weather: "storm" } });
  assert.equal(w.regionStateCandidate.weather, "storm");
});
