import test from "node:test";
import assert from "node:assert/strict";

import { MODULE_MANIFEST } from "../../src/core/modules/module-manifest.js";
import { validateModuleDefinition } from "../../src/core/modules/module-contract.js";
import {
  expandModuleDependencies,
  getModule,
  getModuleByLegacyId,
  getModuleGraph,
  getModuleStats
} from "../../src/core/modules/module-registry.js";

test("registry resolves standard and legacy module ids", () => {
  assert.equal(getModule("lore.worldbook_trigger")?.legacyId, "M2");
  assert.equal(getModuleByLegacyId("M2")?.id, "lore.worldbook_trigger");
  assert.equal(getModuleByLegacyId("M19")?.id, "character.card_runtime");
  assert.equal(getModuleByLegacyId("unknown"), null);
});

test("dependency expansion is ordered, deduplicated, and missing-safe", () => {
  const expanded = expandModuleDependencies(["lore.worldbook_trigger", "not.registered"]);
  assert.ok(expanded.modules.includes("core.world_container"));
  assert.ok(expanded.modules.includes("lore.worldbook_trigger"));
  assert.deepEqual(expanded.missing, ["not.registered"]);
});

test("module graph reports resolved and missing modules", () => {
  const graph = getModuleGraph(["lore.worldbook_trigger", "not.registered"]);
  assert.ok(graph.resolved.includes("lore.worldbook_trigger"));
  assert.ok(graph.missing.includes("not.registered"));
  assert.ok(graph.modules.every((entry) => typeof entry.callable === "boolean"));
});

test("module statistics cover status, category, legacy, and callable counts", () => {
  const stats = getModuleStats();
  assert.ok(stats.total > 0);
  assert.equal(stats.legacyMappedCount, 20);
  assert.ok(stats.byStatus["legacy-wrapped"] > 0);
  assert.ok(stats.byCategory.core > 0);
  assert.ok(stats.callableCount > 0);
});

test("every manifest entry satisfies the module contract", () => {
  for (const [id, definition] of Object.entries(MODULE_MANIFEST)) {
    const result = validateModuleDefinition(definition);
    assert.equal(result.ok, true, `${id}: ${result.errors.join(", ")}`);
  }
});
