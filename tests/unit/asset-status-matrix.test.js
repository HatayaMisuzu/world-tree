// tests/unit/asset-status-matrix.test.js
// Stage 0: verify asset status registry correctness
import test from "node:test";
import assert from "node:assert/strict";
import { MATURATION_STATUS, READINESS_LEVEL, classifyModuleAsset, validateAssetExposure, buildAssetStatusRegistry, getAssetsByStatus } from "../../src/core/assets/asset-status-registry.js";

const mockManifest = {
  "core.world_container": { id: "core.world_container", name: "World Container", category: "core", status: "legacy-wrapped", sourceFiles: ["src/core/world-engine.js"] },
  "trpg.dice": { id: "trpg.dice", name: "TRPG Dice", category: "trpg", status: "prototype-hidden" },
  "core.memory": { id: "core.memory", name: "Memory", category: "core", status: "declared-only" },
  "entity.organization": { id: "entity.organization", name: "Organization", category: "entity", status: "legacy-inline" }
};
const mockMap = { "world-rpg": ["core.world_container", "trpg.dice"] };

const p3 = [{ id: "M1-test", name: "Test M1", sourcePath: "src/test.js", tested: true }];

test("all mode-module-map modules exist in manifest", () => {
  const registry = buildAssetStatusRegistry({ moduleManifest: mockManifest, modeModuleMap: mockMap, p3Assets: p3 });
  const found = registry.assets.find(a => a.id === "core.world_container");
  assert.ok(found);
});

test("prototype-hidden modules are not user exposed", () => {
  const status = classifyModuleAsset({ id: "trpg.dice", status: "prototype-hidden" });
  assert.equal(status, MATURATION_STATUS.PROTOTYPE_HOLD);
  const check = validateAssetExposure({ id: "trpg.dice", maturationStatus: MATURATION_STATUS.PROTOTYPE_HOLD, userExposureAllowed: true });
  assert.equal(check.ok, false);
});

test("declared-only modules are not workflow exposed", () => {
  const status = classifyModuleAsset({ id: "core.memory", status: "declared-only" });
  assert.equal(status, MATURATION_STATUS.DECLARED_HOLD);
});

test("P0-P2 assets are registered", () => {
  const kernel = [{ id: "P0-test", name: "P0", sourcePath: "src/p0", tested: true }];
  const registry = buildAssetStatusRegistry({ moduleManifest: {}, modeModuleMap: {}, kernelAssets: kernel });
  const found = registry.assets.find(a => a.id === "P0-test");
  assert.ok(found);
  assert.equal(found.maturationStatus, MATURATION_STATUS.KERNEL_COMPLETE);
});

test("P3 M1-M11 assets are registered", () => {
  const registry = buildAssetStatusRegistry({ moduleManifest: mockManifest, modeModuleMap: mockMap, p3Assets: p3 });
  const found = registry.assets.find(a => a.id === "M1-test");
  assert.ok(found);
  assert.equal(found.maturationStatus, MATURATION_STATUS.KERNEL_COMPLETE);
});

test("asset registry summary is stable", () => {
  const registry = buildAssetStatusRegistry({ moduleManifest: mockManifest, modeModuleMap: mockMap, p3Assets: p3 });
  assert.ok(registry.summary.total >= 5);
  assert.ok(typeof registry.summary["kernel-complete"] === "number");
});

test("getAssetsByStatus filters correctly", () => {
  const registry = buildAssetStatusRegistry({ moduleManifest: mockManifest, modeModuleMap: mockMap, p3Assets: p3 });
  const legacy = getAssetsByStatus(registry, MATURATION_STATUS.LEGACY_COMPAT);
  assert.equal(legacy.length, 1); // core.world_container
});
