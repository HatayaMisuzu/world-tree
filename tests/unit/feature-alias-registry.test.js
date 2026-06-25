import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_PRODUCT_FEATURES,
  assertCanonicalFeatureCount,
  canonicalFeatureId,
  isSameFeature,
  productFeatureForRuntime,
  resolveFeatureAlias,
} from "../../src/core/features/feature-alias-registry.js";

test("feature alias registry has exactly 8 canonical product features", () => {
  assert.equal(CANONICAL_PRODUCT_FEATURES.length, 8);
  assert.equal(assertCanonicalFeatureCount(8), true);
});

test("ScriptKill and single-player ScriptKill resolve to murder-mystery, not a ninth feature", () => {
  assert.equal(canonicalFeatureId("single-player-scriptkill-v2"), "murder-mystery");
  assert.equal(canonicalFeatureId("ScriptKill"), "murder-mystery");
  assert.equal(canonicalFeatureId("单人剧本杀"), "murder-mystery");
  assert.equal(isSameFeature("single-player-scriptkill-v2", "murder-mystery"), true);
});

test("Detective V2 resolves to mystery-puzzle", () => {
  assert.equal(canonicalFeatureId("detective-v2"), "mystery-puzzle");
  assert.equal(canonicalFeatureId("解谜调查"), "mystery-puzzle");
  assert.equal(isSameFeature("detective-v2", "mystery-puzzle"), true);
});

test("V2 runtime slices resolve to existing product features", () => {
  assert.equal(productFeatureForRuntime({ route: "/api/tabletop-v2/turn" })?.id, "tabletop");
  assert.equal(productFeatureForRuntime({ route: "/api/detective-v2/interrogate" })?.id, "mystery-puzzle");
  assert.equal(productFeatureForRuntime({ route: "/api/single-player-scriptkill-v2/public-talk" })?.id, "murder-mystery");
  assert.equal(productFeatureForRuntime({ route: "/api/characters/v2/turn" })?.id, "character");
});

test("all canonical entries have user-facing names", () => {
  for (const feature of CANONICAL_PRODUCT_FEATURES) {
    assert.ok(feature.zhName, feature.id);
    assert.ok(feature.enName, feature.id);
    assert.ok(resolveFeatureAlias(feature.id), feature.id);
  }
});
