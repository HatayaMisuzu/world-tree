import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import { loadModulesForMode, loadWrappersForMode } from "../../src/core/modules/module-loader.js";
import {
  getModeRuntimeHints,
  summarizeModeModuleGraph,
  summarizeModeWrapperGraph,
  createModeMetadata
} from "../../src/core/modes/mode-metadata.js";
import {
  createModeEngineStatePatch,
  createModeInitialState
} from "../../src/core/modes/mode-initial-state.js";
import {
  createModeRuntimePacket,
  createModeRuntimeSummary
} from "../../src/core/modes/mode-runtime.js";
import {
  QUICK_SETTING_MODE_ID,
  buildQuickSettingModuleGraph,
  createQuickSettingMetadata,
  createQuickSettingInitialState,
  normalizeQuickSettingInput
} from "../../src/core/modes/quick-setting.js";

// ─── Tests 1-3: createModeMetadata("quick-setting") ───

test("1. createModeMetadata('quick-setting') returns mode quick-setting", () => {
  const metadata = createModeMetadata(QUICK_SETTING_MODE_ID);
  assert.equal(metadata.mode, QUICK_SETTING_MODE_ID);
});

test("2. quick-setting metadata dataMode = preset", () => {
  const metadata = createModeMetadata(QUICK_SETTING_MODE_ID);
  assert.equal(metadata.dataMode, "preset");
});

test("3. quick-setting metadata worldSubType = classic", () => {
  const metadata = createModeMetadata(QUICK_SETTING_MODE_ID);
  assert.equal(metadata.worldSubType, "classic");
});

// ─── Test 4: createModeInitialState("quick-setting") ───

test("4. createModeInitialState('quick-setting') returns engineStatePatch", () => {
  const state = createModeInitialState(QUICK_SETTING_MODE_ID);
  assert.equal(state.engineStatePatch.dataMode, "preset");
  assert.equal(state.engineStatePatch.worldSubType, "classic");
  assert.equal(state.engineStatePatch.preset, "preset");
  assert.equal(state.mode, QUICK_SETTING_MODE_ID);
});

// ─── Test 5: createModeRuntimePacket("quick-setting") ───

test("5. createModeRuntimePacket('quick-setting') returns metadata / initialState / moduleGraph / wrapperGraph", () => {
  const packet = createModeRuntimePacket(QUICK_SETTING_MODE_ID);
  assert.equal(packet.mode, QUICK_SETTING_MODE_ID);
  assert.ok(packet.metadata);
  assert.ok(packet.initialState);
  assert.ok(packet.moduleGraph);
  assert.ok(packet.wrapperGraph);
  assert.ok(Array.isArray(packet.warnings));
});

// ─── Test 6: quick-setting wrapperGraph 不保存函数对象 ───

test("6. quick-setting wrapperGraph does not contain function objects", () => {
  const packet = createModeRuntimePacket(QUICK_SETTING_MODE_ID);
  assert.doesNotThrow(() => JSON.stringify(packet.wrapperGraph));
  for (const wrapper of packet.wrapperGraph.wrappers) {
    for (const hook of wrapper.hooks) {
      assert.equal(typeof hook, "string");
    }
});

// ─── Test 7: createModeRuntimeSummary("quick-setting") ───

test("7. createModeRuntimeSummary('quick-setting') returns moduleCount / wrapperCount", () => {
  const summary = createModeRuntimeSummary(QUICK_SETTING_MODE_ID);
  assert.equal(summary.mode, QUICK_SETTING_MODE_ID);
  assert.ok(summary.moduleCount > 0);
  assert.ok(summary.wrapperCount > 0);
  assert.equal(summary.dataMode, "preset");
  assert.equal(summary.worldSubType, "classic");
});

// ─── Tests 8-9: createModeRuntimePacket("character") ───

test("8. createModeRuntimePacket('character') generates a structural packet", () => {
  const packet = createModeRuntimePacket("character");
  assert.equal(packet.mode, "character");
  assert.ok(packet.metadata);
  assert.ok(packet.initialState);
  assert.ok(packet.moduleGraph);
  assert.ok(Array.isArray(packet.warnings));
});

test("9. character packet dataMode = character_card", () => {
  const packet = createModeRuntimePacket("character");
  assert.equal(packet.metadata.dataMode, "character_card");
  assert.equal(packet.metadata.worldSubType, "classic");
  assert.equal(packet.engineStatePatch.dataMode, "character_card");
});

// ─── Tests 10-11: createModeRuntimePacket("world-rpg") ───

test("10. createModeRuntimePacket('world-rpg') generates a structural packet", () => {
  const packet = createModeRuntimePacket("world-rpg");
  assert.equal(packet.mode, "world-rpg");
  assert.ok(packet.metadata);
  assert.ok(packet.initialState);
  assert.ok(Array.isArray(packet.warnings));
});

test("11. world-rpg packet dataMode = worldbook", () => {
  const packet = createModeRuntimePacket("world-rpg");
  assert.equal(packet.metadata.dataMode, "worldbook");
  assert.equal(packet.engineStatePatch.dataMode, "worldbook");
});

// ─── Test 12: createModeRuntimePacket("creation-forge") ───

test("12. createModeRuntimePacket('creation-forge') generates a structural packet", () => {
  const packet = createModeRuntimePacket("creation-forge");
  assert.equal(packet.mode, "creation-forge");
  assert.ok(packet.metadata);
  assert.equal(packet.metadata.dataMode, "worldbook");
  assert.equal(packet.metadata.sourceType, "creation");
});

// ─── Test 13: hidden mode packet 可生成但不改变 visibility ───

test("13. hidden mode packet generates without changing visibility", () => {
  const deferredModes = ["creation-forge"];
  for (const modeId of deferredModes) {
    assert.equal(getMode(modeId)?.status, MODE_STATUS.HIDDEN);
    assert.equal(isModeVisible(modeId), false);

    const packet = createModeRuntimePacket(modeId);
    assert.equal(packet.mode, modeId);
    assert.ok(packet.metadata);

    // 确认 visibility 未被改变
    assert.equal(isModeVisible(modeId), false);
    assert.equal(getMode(modeId)?.status, MODE_STATUS.HIDDEN);
});

// ─── Test 14: unknown mode 抛出明确错误 ───

test("14. unknown mode throws explicit error", () => {
  assert.throws(() => createModeRuntimePacket("nonexistent-mode"), {
    message: /Unknown mode/
  });
  assert.throws(() => createModeMetadata("nonexistent-mode"), {
    message: /Unknown mode/
  });
  assert.throws(() => getModeRuntimeHints("nonexistent-mode"), {
    message: /Unknown mode/
  });

// ─── Test 15: quick-setting 旧 helper 与新 runtime 输出兼容 ───

test("15. quick-setting legacy helpers remain compatible with new runtime", () => {
  // normalizeQuickSettingInput unchanged
  assert.deepEqual(normalizeQuickSettingInput({ title: " ", sourceText: " " }), {
    title: "未命名设定",
    sourceText: "",
    sourceType: "pasted_text"
  });

  // buildQuickSettingModuleGraph still works
  const graphResult = buildQuickSettingModuleGraph();
  assert.equal(graphResult.modeId, QUICK_SETTING_MODE_ID);
  assert.deepEqual(graphResult.misses || graphResult.graph?.missing || [], []);
  // note: graphResult uses 'graph' key from loader, .missing is inside .graph

  // createQuickSettingMetadata dataMode = preset
  const meta = createQuickSettingMetadata({ sourceType: "pasted_text", createdAt: "2026-06-23T00:00:00.000Z" });
  assert.equal(meta.mode, QUICK_SETTING_MODE_ID);
  assert.equal(meta.dataMode, "preset");
  assert.equal(meta.worldSubType, "classic");
  assert.equal(meta.sourceType, "pasted_text");
  assert.equal(meta.createdAt, "2026-06-23T00:00:00.000Z");

  // createQuickSettingInitialState contains engineStatePatch with preset
  const state = createQuickSettingInitialState({ createdAt: "2026-06-23T00:00:00.000Z" });
  assert.equal(state.mode, QUICK_SETTING_MODE_ID);
  assert.equal(state.engineStatePatch.dataMode, "preset");
  assert.equal(state.engineStatePatch.worldSubType, "classic");
  assert.equal(state.engineStatePatch.preset, "preset");
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.ok(state.moduleGraph.modules.every((mod) => typeof mod.callable === "boolean"));
});
