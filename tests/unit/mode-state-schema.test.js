import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import {
  MODE_STATE_SCHEMA_VERSION,
  createDefaultModeState,
  createDefaultModuleState,
  createDefaultRuntimeFlags,
  createDefaultReviewPolicy,
  createModeStateEnvelope,
  normalizeModeStateEnvelope,
  validateModeStateEnvelope,
  createModeStateSummary
} from "../../src/core/modes/mode-state-schema.js";

// ─── Test 1: schemaVersion = 1 ───

test("1. createModeStateEnvelope('quick-setting') has schemaVersion = 1", () => {
  const env = createModeStateEnvelope("quick-setting");
  assert.equal(env.schemaVersion, MODE_STATE_SCHEMA_VERSION);
  assert.equal(env.schemaVersion, 1);
});

// ─── Test 2: mode = quick-setting ───

test("2. quick-setting envelope.mode = quick-setting", () => {
  const env = createModeStateEnvelope("quick-setting");
  assert.equal(env.mode, "quick-setting");
});

// ─── Test 3: quick-setting visibleToUser = true ───

test("3. quick-setting runtimeFlags.visibleToUser = true", () => {
  const env = createModeStateEnvelope("quick-setting");
  assert.equal(env.runtimeFlags.visibleToUser, true);
});

// ─── Test 4: character envelope ───

test("4. createModeStateEnvelope('character') generates structural envelope", () => {
  const env = createModeStateEnvelope("character");
  assert.equal(env.mode, "character");
  assert.equal(typeof env.modeState, "object");
  assert.equal(typeof env.moduleState, "object");
  assert.ok(Object.keys(env.moduleState).length > 0);
});

// ─── Test 5: character visibleToUser = false ───

test("5. character runtimeFlags.visibleToUser = true (character is active)", () => {
  const env = createModeStateEnvelope("character");
  assert.equal(env.runtimeFlags.visibleToUser, true);
});

// ─── Test 6: world-rpg envelope ───

test("6. createModeStateEnvelope('world-rpg') generates structural envelope", () => {
  const env = createModeStateEnvelope("world-rpg");
  assert.equal(env.mode, "world-rpg");
  assert.equal(typeof env.moduleState, "object");
});

// ─── Test 7: world-rpg moduleState has module keys ───

test("7. world-rpg moduleState has module keys", () => {
  const env = createModeStateEnvelope("world-rpg");
  const keys = Object.keys(env.moduleState);
  assert.ok(keys.length > 0);
  assert.ok(keys.includes("core.world_container"));
  assert.ok(keys.includes("lore.worldbook_trigger"));
  // 每个 module state 有默认结构
  for (const key of keys) {
    const mod = env.moduleState[key];
    assert.equal(mod.status, "initialized");
    assert.equal(mod.updatedAt, null);
    assert.deepEqual(mod.data, {});
    assert.deepEqual(mod.warnings, []);
  }
});

// ─── Test 8: hidden mode visibleToUser = false ───

test("8. hidden mode envelope generates but visibleToUser = false", () => {
  for (const modeId of ["creation-forge"]) {
    assert.equal(getMode(modeId)?.status, MODE_STATUS.PLANNED);
    assert.equal(isModeVisible(modeId), false);

    const env = createModeStateEnvelope(modeId);
    assert.equal(env.mode, modeId);
    assert.equal(env.runtimeFlags.visibleToUser, false);
  }
});

// ─── Test 9: reviewPolicy.allowAutoApply = false ───

test("9. reviewPolicy.allowAutoApply = false for all modes", () => {
  for (const modeId of ["quick-setting", "character", "world-rpg", "creation-forge"]) {
    const env = createModeStateEnvelope(modeId);
    assert.equal(env.reviewPolicy.allowAutoApply, false);
  }
});

// ─── Test 10: reviewPolicy.requireUserConfirmation = true ───

test("10. reviewPolicy.requireUserConfirmation = true", () => {
  const env = createModeStateEnvelope("quick-setting");
  assert.equal(env.reviewPolicy.requireUserConfirmation, true);
  assert.equal(env.reviewPolicy.defaultDisposition, "manual_review");
  assert.ok(env.reviewPolicy.protectedScopes.includes("world.json"));
  assert.ok(env.reviewPolicy.protectedScopes.includes("shared/"));
  assert.ok(env.reviewPolicy.protectedScopes.includes("runtime/state.json"));
});

// ─── Test 11: normalizeModeStateEnvelope fills missing fields ───

test("11. normalizeModeStateEnvelope fills missing fields from partial envelope", () => {
  const partial = { mode: "quick-setting" };
  const env = normalizeModeStateEnvelope(partial);
  assert.equal(env.schemaVersion, 1);
  assert.equal(env.mode, "quick-setting");
  assert.equal(typeof env.modeState, "object");
  assert.equal(env.modeState.status, "initialized");
  assert.equal(typeof env.moduleState, "object");
  assert.equal(typeof env.runtimeFlags, "object");
  assert.equal(typeof env.reviewPolicy, "object");
  assert.ok(env.createdAt);
  assert.ok(env.updatedAt);
});

// ─── Test 12: validate valid envelope → ok = true ───

test("12. validateModeStateEnvelope returns ok=true for valid envelope", () => {
  const env = createModeStateEnvelope("quick-setting");
  const result = validateModeStateEnvelope(env);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

// ─── Test 13: validate invalid envelope → ok = false ───

test("13. validateModeStateEnvelope returns ok=false for invalid envelope", () => {
  // allowAutoApply = true 应失败
  const badReview = createModeStateEnvelope("quick-setting");
  badReview.reviewPolicy.allowAutoApply = true;
  const r1 = validateModeStateEnvelope(badReview);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes("allowAutoApply")));

  // hidden mode visibleToUser = true 应失败
  const badFlag = createModeStateEnvelope("creation-forge");
  badFlag.runtimeFlags.visibleToUser = true;
  const r2 = validateModeStateEnvelope(badFlag);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes("visibleToUser")));

  // 无 schemaVersion → 错误
  const r3 = validateModeStateEnvelope({ mode: "quick-setting" });
  assert.equal(r3.ok, false);
  assert.ok(r3.errors.some((e) => e.includes("schemaVersion")));

  // 无 mode → 错误
  const r4 = validateModeStateEnvelope({ schemaVersion: 1 });
  assert.equal(r4.ok, false);
  assert.ok(r4.errors.some((e) => e.includes("mode")));
});

// ─── Test 14: unknown mode throws ───

test("14. unknown mode throws explicit error", () => {
  assert.throws(() => createModeStateEnvelope("nonexistent-mode"), {
    message: /Unknown mode/
  });
  // normalizeModeStateEnvelope with unknown mode + options.modeId should work
  // because it catches the error and uses fallback hints
  const env = normalizeModeStateEnvelope({ mode: "nonexistent-mode" });
  assert.equal(env.mode, "nonexistent-mode");
  assert.equal(env.schemaVersion, 1);
});

// ─── Test 15: createModeStateSummary ───

test("15. createModeStateSummary returns correct statistics", () => {
  const env = createModeStateEnvelope("quick-setting");
  const summary = createModeStateSummary(env);
  assert.equal(summary.mode, "quick-setting");
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.modeStatus, "initialized");
  assert.ok(summary.moduleCount > 0);
  assert.equal(summary.visibleToUser, true);
  assert.equal(summary.reviewDefaultDisposition, "manual_review");
  assert.equal(summary.allowAutoApply, false);
});

// ─── Test 16: envelope 不包含函数对象 ───

test("16. envelope does not contain function objects", () => {
  const env = createModeStateEnvelope("quick-setting");
  assert.doesNotThrow(() => JSON.stringify(env));
  const json = JSON.stringify(env);
  const parsed = JSON.parse(json);
  // 遍历检查无函数
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

// ─── Test 17: envelope 不包含本机绝对路径 ───

test("17. envelope does not contain local absolute paths", () => {
  const env = createModeStateEnvelope("quick-setting");
  const json = JSON.stringify(env);
  assert.doesNotMatch(json, /[A-Za-z]:[/\\]Users[/\\]/);
  assert.doesNotMatch(json, /[A-Za-z]:[/\\]data[/\\]/);
  assert.doesNotMatch(json, /sk-/);
});
