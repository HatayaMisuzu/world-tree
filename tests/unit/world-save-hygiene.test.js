import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEngineGraphSidecar,
  mergeLegacyWorldGraph,
  splitWorldForSave,
  stripRegenerableWorldFields
} from "../../src/core/system/world-save-hygiene.js";

test("world save hygiene strips regenerable engine graph from world.json", () => {
  const world = { name: "old", mode: "quick-setting", moduleGraph: { modules: ["a"] }, wrapperGraph: { wrappers: ["w"] } };
  assert.deepEqual(stripRegenerableWorldFields(world), { name: "old", mode: "quick-setting" });
  const split = splitWorldForSave(world, {});
  assert.equal(split.world.moduleGraph, undefined);
  assert.deepEqual(split.engineGraph.moduleGraph, { modules: ["a"] });
  assert.deepEqual(split.engineGraph.wrapperGraph, { wrappers: ["w"] });
});

test("legacy world graph remains readable when runtime state lacks graph", () => {
  const world = { moduleGraph: { modules: ["legacy"] }, wrapperGraph: { wrappers: ["legacy-wrapper"] } };
  const merged = mergeLegacyWorldGraph(world, { turnCount: 2 });
  assert.deepEqual(merged.moduleGraph, { modules: ["legacy"] });
  assert.deepEqual(merged.wrapperGraph, { wrappers: ["legacy-wrapper"] });
});

test("engine graph sidecar prefers runtime state over stale world metadata", () => {
  const sidecar = buildEngineGraphSidecar(
    { moduleGraph: { modules: ["old"] } },
    { moduleGraph: { modules: ["runtime"] } }
  );
  assert.deepEqual(sidecar.moduleGraph, { modules: ["runtime"] });
});
