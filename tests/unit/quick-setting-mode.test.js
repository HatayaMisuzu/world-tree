import test from "node:test";
import assert from "node:assert/strict";

import {
  QUICK_SETTING_MODE_ID,
  buildQuickSettingModuleGraph,
  createQuickSettingInitialState,
  createQuickSettingMetadata,
  normalizeQuickSettingInput
} from "../../src/core/modes/quick-setting.js";
import { MODE_STATUS, getMode, isModeVisible } from "../../src/core/modes/mode-manifest.js";

test("quick-setting metadata uses the existing preset compatibility path", () => {
  const metadata = createQuickSettingMetadata({ sourceType: "pasted_text", createdAt: "2026-06-23T00:00:00.000Z" });
  assert.equal(metadata.mode, QUICK_SETTING_MODE_ID);
  assert.equal(metadata.dataMode, "preset");
  assert.equal(metadata.worldSubType, "classic");
  assert.equal(metadata.sourceType, "pasted_text");
  assert.equal(metadata.createdAt, "2026-06-23T00:00:00.000Z");
  assert.equal(getMode(QUICK_SETTING_MODE_ID)?.status, MODE_STATUS.ACTIVE);
  assert.equal(isModeVisible(QUICK_SETTING_MODE_ID), true);
});

test("quick-setting module graph resolves the declared core slice", () => {
  const result = buildQuickSettingModuleGraph();
  assert.equal(result.modeId, QUICK_SETTING_MODE_ID);
  assert.deepEqual(result.graph.missing, []);
  for (const moduleId of [
    "core.world_container",
    "lore.worldbook_trigger",
    "scene.session",
    "audit.narrative_quality"
  ]) {
    assert.ok(result.graph.resolved.includes(moduleId), `missing ${moduleId}`);
});

test("quick-setting input normalization handles empty and aliased fields", () => {
  assert.deepEqual(normalizeQuickSettingInput({ title: " ", sourceText: " " }), {
    title: "未命名设定",
    sourceText: "",
    sourceType: "pasted_text"
  });
  assert.deepEqual(normalizeQuickSettingInput({ name: " 玻璃城 ", content: " 风暴档案 " }), {
    title: "玻璃城",
    sourceText: "风暴档案",
    sourceType: "pasted_text"
  });

test("quick-setting initial state contains JSON-safe graph metadata", () => {
  const state = createQuickSettingInitialState({ createdAt: "2026-06-23T00:00:00.000Z" });
  assert.equal(state.mode, QUICK_SETTING_MODE_ID);
  assert.equal(state.engineStatePatch.dataMode, "preset");
  assert.equal(state.engineStatePatch.worldSubType, "classic");
  assert.equal(state.engineStatePatch.preset, "preset");
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.ok(state.moduleGraph.modules.every((module) => typeof module.callable === "boolean"));
});

test("quick-setting helper does not activate hidden modes", () => {
  createQuickSettingMetadata();
  assert.equal(getMode("creation-forge")?.status, MODE_STATUS.PLANNED);
});
