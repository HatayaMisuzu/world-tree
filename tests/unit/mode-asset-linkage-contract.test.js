import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeModeAssetBindings,
  validateModeAssetBindings,
  createModeRuntimeNamespace,
  assertRuntimeNamespaceIsolation,
  buildReadOnlyAssetSnapshot,
} from "../../src/core/mode/mode-asset-linkage-contract.js";

// ── Normalizer ──

test("normalizeModeAssetBindings: minimal input", () => {
  const b = normalizeModeAssetBindings({ modeId: "tabletop", moduleId: "m1" });
  assert.equal(b.modeId, "tabletop");
  assert.equal(b.moduleId, "m1");
  assert.ok(Array.isArray(b.worldbookRefs));
  assert.ok(Array.isArray(b.characterRefs));
  assert.ok(Array.isArray(b.evidenceRefs)); // future slot
});

test("normalizeModeAssetBindings: preserves refs", () => {
  const b = normalizeModeAssetBindings({
    modeId: "detective",
    moduleId: "case1",
    worldbookRefs: ["wb1"],
    characterRefs: ["c1", "c2"],
    evidenceRefs: ["e1"],
  });
  assert.deepEqual(b.worldbookRefs, ["wb1"]);
  assert.deepEqual(b.characterRefs, ["c1", "c2"]);
  assert.deepEqual(b.evidenceRefs, ["e1"]);
});

test("normalizeModeAssetBindings: null input", () => {
  assert.equal(normalizeModeAssetBindings(null), null);
});

// ── Validator ──

test("validateModeAssetBindings: valid", () => {
  const b = normalizeModeAssetBindings({ modeId: "tabletop", moduleId: "m1" });
  assert.equal(validateModeAssetBindings(b).valid, true);
});

test("validateModeAssetBindings: missing modeId", () => {
  assert.equal(validateModeAssetBindings({ moduleId: "x" }).valid, false);
});

// ── Runtime namespace ──

test("createModeRuntimeNamespace: includes modeId/moduleId/runId", () => {
  const ns = createModeRuntimeNamespace({ modeId: "tabletop", moduleId: "m1", runId: "r1" });
  assert.ok(ns.startsWith("tabletop::"));
  assert.ok(ns.includes("m1"));
  assert.ok(ns.includes("r1"));
});

test("createModeRuntimeNamespace: different modes don't collide", () => {
  const t = createModeRuntimeNamespace({ modeId: "tabletop", moduleId: "a", runId: "r" });
  const d = createModeRuntimeNamespace({ modeId: "detective", moduleId: "a", runId: "r" });
  assert.notEqual(t, d);
});

// ── Isolation assertion ──

test("assertRuntimeNamespaceIsolation: valid", () => {
  const ns = createModeRuntimeNamespace({ modeId: "tabletop", moduleId: "m1", runId: "r1" });
  assert.equal(assertRuntimeNamespaceIsolation({ modeId: "tabletop", namespace: ns }).ok, true);
});

test("assertRuntimeNamespaceIsolation: wrong mode fails", () => {
  const ns = createModeRuntimeNamespace({ modeId: "detective", moduleId: "m1", runId: "r1" });
  const result = assertRuntimeNamespaceIsolation({ modeId: "tabletop", namespace: ns });
  assert.equal(result.ok, false);
});

test("assertRuntimeNamespaceIsolation: missing args", () => {
  assert.equal(assertRuntimeNamespaceIsolation({}).ok, false);
});

// ── Read-only snapshot ──

test("buildReadOnlyAssetSnapshot: marks readOnly", () => {
  const b = normalizeModeAssetBindings({ modeId: "tabletop", moduleId: "m1", worldbookRefs: ["wb1"] });
  const snap = buildReadOnlyAssetSnapshot({ modeId: "tabletop", moduleId: "m1", assetBindings: b });
  assert.equal(snap._readOnly, true);
  assert.equal(snap._mutableAssets, undefined);
  assert.deepEqual(snap.worldbookRefs, ["wb1"]);
  assert.notEqual(snap.worldbookRefs, b.worldbookRefs); // deep copy
});
