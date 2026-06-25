import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAdventureModule } from "../../src/core/tabletop/tabletop-v2-adventure-module.js";
import { createTabletopRun } from "../../src/core/tabletop/tabletop-v2-save-branch.js";

// ── Runtime isolation in run state ──

test("createTabletopRun includes runtimeIsolation", () => {
  const module = normalizeAdventureModule({ title: "Iso Test" });
  const run = createTabletopRun({ module });
  assert.ok(run.runtimeIsolation);
  assert.equal(run.runtimeIsolation.modeId, "tabletop");
  assert.ok(run.runtimeIsolation.runtimeNamespace.startsWith("tabletop::"));
});

test("runtimeIsolation has all required namespaces", () => {
  const module = normalizeAdventureModule({ title: "NS Test" });
  const run = createTabletopRun({ module });
  const iso = run.runtimeIsolation;
  assert.ok(iso.runtimeNamespace);
  assert.ok(iso.cacheNamespace.endsWith(":cache"));
  assert.ok(iso.saveNamespace.endsWith(":save"));
  assert.ok(iso.branchNamespace.endsWith(":branch"));
  assert.ok(iso.llmNamespace.endsWith(":llm"));
  assert.equal(iso.hiddenStatePolicy, "mode_private");
});

// ── Asset bindings ──

test("normalizeAdventureModule includes assetBindings", () => {
  const module = normalizeAdventureModule({
    title: "Bindings Test",
    worldbookRefs: ["wb-alpha"],
    characterRefs: ["npc-1"],
  });
  assert.ok(module.assetBindings);
  assert.equal(module.assetBindings.modeId, "tabletop");
  assert.deepEqual(module.assetBindings.worldbookRefs, ["wb-alpha"]);
  assert.deepEqual(module.assetBindings.characterRefs, ["npc-1"]);
});

test("assetBindings worldbookRefs backward compat", () => {
  const module = normalizeAdventureModule({
    title: "Compat Test",
    worldbookRefs: ["legacy-ref"],
  });
  assert.deepEqual(module.worldbookRefs, ["legacy-ref"]);
  assert.deepEqual(module.assetBindings.worldbookRefs, ["legacy-ref"]);
});

// ── Save/branch carry Tabletop namespace ──

test("createTabletopRun saveNamespace is Tabletop-specific", () => {
  const module = normalizeAdventureModule({ title: "Save NS" });
  const run = createTabletopRun({ module });
  assert.ok(run.runtimeIsolation.saveNamespace.includes("tabletop"));
  assert.ok(!run.runtimeIsolation.saveNamespace.includes("detective"));
  assert.ok(!run.runtimeIsolation.saveNamespace.includes("character"));
});

// ── Hidden GM state stripped ──

test("stripHiddenState removes hiddenGmState", async () => {
  const module = normalizeAdventureModule({ title: "Hidden Test", gmBook: { hiddenTruth: "SECRET" } });
  const run = createTabletopRun({ module });
  run.hiddenGmState.secretProgress = { key: "value" };
  const { stripHiddenState: s } = await import("../../src/core/tabletop/tabletop-v2-save-branch.js");
  const safe = s(run);
  assert.equal(safe.hiddenGmState, undefined);
  assert.ok(safe.publicState);
});
