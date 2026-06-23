import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import { createModeProjectDraft, createModeProjectFiles, createProjectFromMode, assertModeProjectCanBeCreated } from "../../src/core/modes/mode-project-factory.js";

// ─── Test 1: character mode visible ───

test("1. character isModeVisible() = true", () => {
  assert.equal(getMode("character")?.status, MODE_STATUS.ACTIVE);
  assert.equal(isModeVisible("character"), true);
});

// ─── Test 2: hidden modes remain invisible ───

test("2. hidden modes remain invisible", () => {
  // Only creation-forge remains deferred; all other modes are now active
  assert.equal(isModeVisible("creation-forge"), false);
});

// ─── Test 3: DATA_MODES unchanged ───

test("3. DATA_MODES unchanged", async () => {
  const { DATA_MODES } = await import("../../src/core/engine/modules.js");
  assert.ok(DATA_MODES.worldbook);
  assert.ok(DATA_MODES.character_card);
  assert.ok(DATA_MODES.preset);
  assert.equal(Object.keys(DATA_MODES).length, 3);
});

// ─── Test 4: character draft dataMode ───

test("4. createModeProjectDraft('character') dataMode = character_card", () => {
  const draft = createModeProjectDraft("character", { title: "测试角色" });
  assert.equal(draft.mode, "character");
  assert.equal(draft.dataMode, "character_card");
  assert.equal(draft.worldSubType, "classic");
  assert.equal(draft.sourceType, "character_card");
});

// ─── Test 5: character draft modeRuntimePacket ───

test("5. character draft includes modeRuntimePacket", () => {
  const draft = createModeProjectDraft("character", {});
  assert.ok(draft.modeRuntimePacket);
  assert.equal(draft.modeRuntimePacket.mode, "character");
});

// ─── Test 6: character draft moduleRuntimePacket ───

test("6. character draft includes moduleRuntimePacket", () => {
  const draft = createModeProjectDraft("character", {});
  assert.ok(draft.moduleRuntimePacket);
  assert.equal(draft.moduleRuntimePacket.modeId, "character");
});

// ─── Test 7: character draft modeStateEnvelope ───

test("7. character draft includes modeStateEnvelope", () => {
  const draft = createModeProjectDraft("character", {});
  assert.ok(draft.modeStateEnvelope);
  assert.equal(draft.modeStateEnvelope.mode, "character");
});

// ─── Test 8: character files has shared/characters.json ───

test("8. createModeProjectFiles(character) generates shared/characters.json with primary", () => {
  const draft = createModeProjectDraft("character", { title: "档案员" });
  const files = createModeProjectFiles(draft);
  assert.ok(files["shared/characters.json"]);
  const chars = files["shared/characters.json"];
  assert.ok(Array.isArray(chars));
  assert.ok(chars.length > 0);
  assert.equal(chars[0].id, "primary");
  assert.equal(chars[0].name, "档案员");
  assert.equal(chars[0].sourceType, "character_card");
  assert.equal(chars[0].rawTextRef, "runtime/source.txt");
});

// ─── Test 9: worlds/creation-forge still rejected ───

test("9. createProjectFromMode('world-rpg', persist=true) now allowed", () => {
  const r = createProjectFromMode("world-rpg", { title: "test" }, { persist: true });
  assert.equal(r.ok, true);
});

// ─── Test 10: creation-forge still rejected ───

test("10. createProjectFromMode('creation-forge', persist=true) still rejected", () => {
  const r = createProjectFromMode("creation-forge", { title: "test" }, { persist: true });
  assert.equal(r.ok, false);
});

// ─── Test 11: hidden mode still rejected ───

test("11. hidden modes still reject persist", () => {
  const r = createProjectFromMode("creation-forge", { title: "test" }, { persist: true });
  assert.equal(r.ok, false);
});

// ─── Test 12: character allowed for creation ───

test("12. character is allowed for project creation", () => {
  const perm = assertModeProjectCanBeCreated("character");
  assert.equal(perm.allowed, true);
});

// ─── Test 13: quick-setting still visible ───

test("13. quick-setting remains visible", () => {
  assert.equal(isModeVisible("quick-setting"), true);
  assert.equal(getMode("quick-setting")?.status, MODE_STATUS.ACTIVE);
});
