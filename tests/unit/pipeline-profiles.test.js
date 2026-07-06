import test from "node:test";
import assert from "node:assert/strict";

import { loadPipelineProfiles, resolvePipelineProfile } from "../../src/core/llm/pipeline-profiles.js";

test("pipeline profiles load quality speed cost mappings from defaults", () => {
  const catalog = loadPipelineProfiles();
  assert.equal(catalog.default, "balanced");
  assert.deepEqual(catalog.profiles.map((profile) => profile.id), ["fast", "balanced", "quality"]);
  assert.deepEqual(catalog.profiles.map((profile) => [profile.quality, profile.speed, profile.cost]), [
    ["low", "high", "low"],
    ["medium", "medium", "medium"],
    ["high", "low", "high"]
  ]);
  assert.equal(resolvePipelineProfile("quality", catalog).directorMode, "llm");
  assert.equal(resolvePipelineProfile("missing", catalog).id, "balanced");
});
