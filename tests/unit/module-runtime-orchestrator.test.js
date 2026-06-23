import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import {
  createModuleRuntimeContext,
  runWrapperHook,
  runWrappersHook,
  normalizeHookResult,
  createModuleRuntimePacket,
  createModuleRuntimeSummary
} from "../../src/core/modules/module-runtime-orchestrator.js";
import { getModuleWrapper } from "../../src/core/modules/wrappers/index.js";

// ─── Test 1: createModuleRuntimeContext({}) 不 throw ───

test("1. createModuleRuntimeContext({}) does not throw and returns safe defaults", () => {
  const ctx = createModuleRuntimeContext({});
  assert.equal(typeof ctx, "object");
  assert.equal(ctx.input, "");
  assert.deepEqual(ctx.model, {});
  assert.deepEqual(ctx.engineState, {});
  assert.deepEqual(ctx.moduleData, {});
  assert.equal(ctx.worldbookState, null);
  assert.deepEqual(ctx.cards, []);
  assert.deepEqual(ctx.options, {});
});

test("1b. createModuleRuntimeContext passes through provided values", () => {
  const ctx = createModuleRuntimeContext({
    model: { selected: { id: "test" } },
    input: "hello",
    engineState: { dataMode: "worldbook" },
    cards: [{ name: "Alice" }],
    options: { sourceType: "pasted_text" }
  });
  assert.equal(ctx.input, "hello");
  assert.equal(ctx.engineState.dataMode, "worldbook");
  assert.equal(ctx.cards.length, 1);
  assert.equal(ctx.model.selected.id, "test");
});

// ─── Test 2: runWrapperHook() buildContext 成功 ───

test("2. runWrapperHook calls buildContext successfully", () => {
  const wrapper = getModuleWrapper("core.world_container");
  assert.ok(wrapper);
  const result = runWrapperHook(wrapper, "buildContext", { model: {}, input: "" });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.moduleId, "core.world_container");
  assert.equal(result.legacyId, "M1");
  assert.equal(result.hook, "buildContext");
});

// ─── Test 3: runWrapperHook() 缺失 hook → skipped ───

test("3. runWrapperHook returns skipped for missing hook", () => {
  const wrapper = getModuleWrapper("core.world_container");
  assert.ok(wrapper);
  const result = runWrapperHook(wrapper, "nonexistentHook", {});
  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.ok(result.warnings[0].includes("hook not implemented"));
});

// ─── Test 4: runWrapperHook() 抛错不中断 ───

test("4. runWrapperHook catches throwing wrapper without crashing", () => {
  // 构造一个会抛错的临时 wrapper
  const throwingWrapper = {
    id: "test.throwing",
    legacyId: "TX",
    buildContext() { throw new Error("simulated failure"); }
  };
  assert.doesNotThrow(() => {
    const result = runWrapperHook(throwingWrapper, "buildContext", {});
    assert.equal(result.ok, false);
    assert.equal(result.skipped, false);
    assert.equal(result.result, null);
    assert.ok(result.warnings.length > 0);
  });
});

// ─── Test 5: createModuleRuntimePacket("quick-setting") ───

test("5. createModuleRuntimePacket('quick-setting') returns contextBlocks / promptBlocks / debugInfo", () => {
  const packet = createModuleRuntimePacket("quick-setting", { input: "test" });
  assert.equal(packet.modeId, "quick-setting");
  assert.ok(packet.wrapperCount > 0);
  assert.ok(packet.contextBlocks.length > 0);
  assert.ok(packet.promptBlocks.length > 0);
  assert.ok(packet.debugInfo.length > 0);
  assert.ok(Array.isArray(packet.warnings));
  assert.ok(Array.isArray(packet.errors));
});

// ─── Test 6: quick-setting packet 包含 core.world_container ───

test("6. quick-setting packet includes core.world_container wrapper", () => {
  const packet = createModuleRuntimePacket("quick-setting", { input: "test" });
  const worldContainer = packet.contextBlocks.find((b) => b.moduleId === "core.world_container");
  assert.ok(worldContainer);
  assert.equal(worldContainer.ok, true);
  assert.equal(worldContainer.legacyId, "M1");
});

// ─── Test 7: createModuleRuntimePacket("character") ───

test("7. createModuleRuntimePacket('character') generates a structural packet", () => {
  const packet = createModuleRuntimePacket("character", { input: "test" });
  assert.equal(packet.modeId, "character");
  assert.ok(packet.wrapperCount > 0);
  assert.ok(packet.contextBlocks.length > 0);
});

// ─── Test 8: character packet 包含 character.card_runtime ───

test("8. character packet includes character.card_runtime wrapper", () => {
  const packet = createModuleRuntimePacket("character", { input: "test" });
  const cardRuntime = packet.contextBlocks.find((b) => b.moduleId === "character.card_runtime");
  assert.ok(cardRuntime);
  assert.equal(cardRuntime.legacyId, "M19");
});

// ─── Test 9: createModuleRuntimePacket("world-rpg") ───

test("9. createModuleRuntimePacket('world-rpg') generates a structural packet", () => {
  const packet = createModuleRuntimePacket("world-rpg", { input: "test" });
  assert.equal(packet.modeId, "world-rpg");
  assert.ok(packet.wrapperCount > 0);
});

// ─── Test 10: missing wrappers 不 fatal ───

test("10. missing wrappers are collected but not fatal", () => {
  // world-rpg has some modules without wrappers (e.g. rpg.quest)
  const packet = createModuleRuntimePacket("world-rpg", { input: "test" });
  assert.ok(packet.missingWrappers.length > 0);
  // packet still generates for available wrappers
  assert.ok(packet.wrapperCount > 0);
  assert.ok(packet.contextBlocks.length > 0);
});

// ─── Test 11: hidden mode packet 不改变 visibility ───

test("11. hidden mode generates packet without changing visibility", () => {
  const hiddenModes = ["murder-mystery", "tabletop", "strategy-sim"];
  for (const modeId of hiddenModes) {
    assert.equal(getMode(modeId)?.status, MODE_STATUS.HIDDEN);
    assert.equal(isModeVisible(modeId), false);

    const packet = createModuleRuntimePacket(modeId, { input: "test" });
    assert.equal(packet.modeId, modeId);

    // visibility unchanged
    assert.equal(isModeVisible(modeId), false);
    assert.equal(getMode(modeId)?.status, MODE_STATUS.HIDDEN);
  }
});

// ─── Test 12: promptBlocks 是旁路文本 ───

test("12. promptBlocks are side-channel text only", () => {
  const packet = createModuleRuntimePacket("quick-setting", { input: "test" });
  for (const block of packet.promptBlocks) {
    assert.equal(typeof block.text, "string");
    assert.ok(block.text.length <= 1200);
    // text 不包含本机路径
    assert.doesNotMatch(block.text, /[A-Za-z]:[/\\]/);
  }
});

// ─── Test 13: packet 不包含函数对象 ───

test("13. packet does not contain function objects", () => {
  const packet = createModuleRuntimePacket("quick-setting", { input: "test" });
  assert.doesNotThrow(() => JSON.stringify(packet));
  const json = JSON.stringify(packet);
  const parsed = JSON.parse(json);
  for (const block of parsed.contextBlocks) {
    assert.equal(typeof block.data, "object");
    if (block.data) {
      for (const value of Object.values(block.data)) {
        assert.notEqual(typeof value, "function");
      }
    }
  }
});

// ─── Test 14: packet 不包含本机绝对路径 ───

test("14. packet does not contain local absolute paths", () => {
  const packet = createModuleRuntimePacket("quick-setting", {
    input: "C:\\Users\\test\\file.txt",
    model: { selected: { id: "D:\\data\\world" } }
  });
  const json = JSON.stringify(packet);
  assert.doesNotMatch(json, /[A-Za-z]:[/\\]Users[/\\]/);
  assert.doesNotMatch(json, /[A-Za-z]:[/\\]data[/\\]/);
});

// ─── Test 15: createModuleRuntimeSummary() 返回统计 ───

test("15. createModuleRuntimeSummary returns correct statistics", () => {
  const packet = createModuleRuntimePacket("quick-setting", { input: "test" });
  const summary = createModuleRuntimeSummary(packet);
  assert.equal(summary.modeId, "quick-setting");
  assert.ok(summary.wrapperCount > 0);
  assert.equal(summary.contextBlockCount, summary.wrapperCount);
  assert.equal(summary.promptBlockCount, summary.wrapperCount);
  assert.equal(summary.debugInfoCount, summary.wrapperCount);
  assert.ok(summary.missingWrapperCount >= 0);
  assert.equal(typeof summary.warningCount, "number");
  assert.equal(typeof summary.errorCount, "number");
});
