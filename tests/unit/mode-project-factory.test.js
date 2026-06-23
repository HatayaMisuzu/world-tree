import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import {
  assertModeProjectCanBeCreated,
  normalizeModeProjectInput,
  createModeProjectDraft,
  createModeProjectFiles,
  createProjectFromMode,
  createModeProjectSummary
} from "../../src/core/modes/mode-project-factory.js";

// ─── Test 1: normalizeModeProjectInput quick-setting 默认值 ───

test("1. normalizeModeProjectInput('quick-setting', {}) has default title/sourceType", () => {
  const input = normalizeModeProjectInput("quick-setting", {});
  assert.equal(input.mode, "quick-setting");
  assert.equal(input.title, "未命名设定");
  assert.equal(input.sourceType, "pasted_text");
  assert.equal(input.sourceText, "");
});

// ─── Test 2: createModeProjectDraft quick-setting ───

test("2. createModeProjectDraft('quick-setting') returns mode quick-setting", () => {
  const draft = createModeProjectDraft("quick-setting", { title: "测试" });
  assert.equal(draft.mode, "quick-setting");
  assert.equal(draft.title, "测试");
  assert.equal(draft.dataMode, "preset");
  assert.equal(draft.worldSubType, "classic");
});

// ─── Test 3: quick-setting draft 包含 modeRuntimePacket ───

test("3. quick-setting draft includes modeRuntimePacket", () => {
  const draft = createModeProjectDraft("quick-setting", {});
  assert.ok(draft.modeRuntimePacket);
  assert.equal(draft.modeRuntimePacket.mode, "quick-setting");
  assert.ok(draft.modeRuntimePacket.metadata);
});

// ─── Test 4: quick-setting draft 包含 moduleRuntimePacket ───

test("4. quick-setting draft includes moduleRuntimePacket", () => {
  const draft = createModeProjectDraft("quick-setting", {});
  assert.ok(draft.moduleRuntimePacket);
  assert.equal(draft.moduleRuntimePacket.modeId, "quick-setting");
  assert.ok(draft.moduleRuntimePacket.contextBlocks.length > 0);
  assert.ok(draft.moduleRuntimePacket.promptBlocks.length > 0);
  assert.ok(draft.moduleRuntimePacket.debugInfo.length > 0);
});

// ─── Test 5: quick-setting draft 包含 modeStateEnvelope ───

test("5. quick-setting draft includes modeStateEnvelope", () => {
  const draft = createModeProjectDraft("quick-setting", {});
  assert.ok(draft.modeStateEnvelope);
  assert.equal(draft.modeStateEnvelope.mode, "quick-setting");
  assert.equal(draft.modeStateEnvelope.schemaVersion, 1);
});

// ─── Test 6: worldJsonDraft 包含 mode / modeMetadata ───

test("6. quick-setting worldJsonDraft contains mode and modeMetadata", () => {
  const draft = createModeProjectDraft("quick-setting", { title: "玻璃城" });
  const wj = draft.worldJsonDraft;
  assert.equal(wj.title, "玻璃城");
  assert.equal(wj.mode, "quick-setting");
  assert.equal(wj.modeMetadata.dataMode, "preset");
  assert.equal(wj.modeMetadata.worldSubType, "classic");
  assert.ok(wj.moduleGraph.modules.length > 0);
});

// ─── Test 7: runtimeStateDraft 包含 engineState / moduleGraph / wrapperGraph ───

test("7. quick-setting runtimeStateDraft contains engineState / moduleGraph / wrapperGraph", () => {
  const draft = createModeProjectDraft("quick-setting", {});
  const rs = draft.runtimeStateDraft;
  assert.ok(rs.engineState);
  assert.equal(rs.mode, "quick-setting");
  assert.ok(rs.moduleGraph.modules.length > 0);
  assert.ok(rs.wrapperGraph.wrappers.length > 0);
  assert.ok(rs.modeStateEnvelope);
});

// ─── Test 8: createModeProjectFiles 返回核心文件 ───

test("8. createModeProjectFiles returns world.json, runtime/state.json, runtime/source.txt", () => {
  const draft = createModeProjectDraft("quick-setting", { sourceText: "风暴中的玻璃城" });
  const files = createModeProjectFiles(draft);
  assert.ok(files["world.json"]);
  assert.ok(files["runtime/state.json"]);
  assert.ok(files["runtime/source.txt"]);
  assert.equal(files["runtime/source.txt"], "风暴中的玻璃城");
  assert.ok(files["shared/worldbook.json"]);
  assert.ok(files["shared/characters.json"]);
  // 全部 10 个 shared 文件
  assert.equal(Object.keys(files).length, 10);
});

// ─── Test 9: createModeProjectDraft character ───

test("9. createModeProjectDraft('character') generates structural draft", () => {
  const draft = createModeProjectDraft("character", { title: "角色卡测试" });
  assert.equal(draft.mode, "character");
  assert.equal(draft.title, "角色卡测试");
  assert.ok(draft.modeRuntimePacket);
  assert.ok(draft.moduleRuntimePacket);
  assert.ok(draft.modeStateEnvelope);
});

// ─── Test 10: character draft dataMode = character_card ───

test("10. character draft dataMode = character_card", () => {
  const draft = createModeProjectDraft("character", {});
  assert.equal(draft.dataMode, "character_card");
  assert.equal(draft.modeStateEnvelope.modeState.dataMode, "character_card");
});

// ─── Test 11: planned mode 默认不可真实创建 ───

test("11. createProjectFromMode('character', ..., { persist: true }) now allowed (character is active)", () => {
  const result = createProjectFromMode("character", { title: "test" }, { persist: true });
  assert.equal(result.ok, true);
  assert.ok(result.files); // now returns files
});

// ─── Test 12: hidden mode 默认不可真实创建 ───

test("12. hidden mode defaults to not creatable", () => {
  for (const modeId of ["murder-mystery", "tabletop", "strategy-sim"]) {
    const perm = assertModeProjectCanBeCreated(modeId);
    assert.equal(perm.allowed, false);
  }
});

// ─── Test 13: draft 不包含函数对象 ───

test("13. draft does not contain function objects", () => {
  const draft = createModeProjectDraft("quick-setting", {});
  assert.doesNotThrow(() => JSON.stringify(draft));
  const json = JSON.stringify(draft);
  const parsed = JSON.parse(json);
  function checkNoFunctions(obj) {
    if (obj == null) return;
    if (typeof obj === "object") {
      for (const value of Object.values(obj)) {
        assert.notEqual(typeof value, "function");
        checkNoFunctions(value);
      }
    }
  }
  checkNoFunctions(parsed);
});

// ─── Test 14: draft 不包含本机绝对路径 ───

test("14. draft does not contain local absolute paths", () => {
  const draft = createModeProjectDraft("quick-setting", {
    sourceText: "C:\\Users\\test\\file.txt"
  });
  const json = JSON.stringify(draft);
  assert.doesNotMatch(json, /[A-Za-z]:[/\\]Users[/\\]/);
  assert.doesNotMatch(json, /sk-/);
});

// ─── Test 15: createModeProjectSummary ───

test("15. createModeProjectSummary returns statistics", () => {
  const draft = createModeProjectDraft("quick-setting", { title: "摘要测试" });
  const summary = createModeProjectSummary(draft);
  assert.equal(summary.mode, "quick-setting");
  assert.equal(summary.title, "摘要测试");
  assert.equal(summary.hasModeRuntimePacket, true);
  assert.equal(summary.hasModuleRuntimePacket, true);
  assert.equal(summary.hasModeStateEnvelope, true);
});

// ─── Test 16: unknown mode throws ───

test("16. unknown mode throws explicit error", () => {
  assert.throws(() => normalizeModeProjectInput("nonexistent-mode", {}), {
    message: /Unknown mode/
  });
  assert.throws(() => createModeProjectDraft("nonexistent-mode", {}), {
    message: /Unknown mode/
  });
});
