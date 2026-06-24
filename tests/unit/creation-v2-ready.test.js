// tests/unit/creation-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCreationV2Ready } from "../../src/core/creation-forge/creation-v2-ready.js";

test("normalizeCreationV2Ready preserves source material and target mode", () => {
  const c = normalizeCreationV2Ready({
    sourceMaterialRef: "raw-setting-1",
    targetMode: "world-rpg",
    artifactType: "worldbook"
  });
  assert.equal(c.sourceMaterialRef, "raw-setting-1");
  assert.equal(c.targetMode, "world-rpg");
  assert.equal(c.artifactType, "worldbook");
});

test("normalizeCreationV2Ready stores extraction trace", () => {
  const c = normalizeCreationV2Ready({ extractionTrace: ["step1", "step2"] });
  assert.equal(c.extractionTrace.length, 2);
});
