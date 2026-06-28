import test from "node:test";
import assert from "node:assert/strict";

import { getMode, isModeVisible, MODE_STATUS } from "../../src/core/modes/mode-manifest.js";
import { createModeProjectDraft, createModeProjectFiles, createProjectFromMode, assertModeProjectCanBeCreated } from "../../src/core/modes/mode-project-factory.js";

const NEW_MODES = ["world-rpg", "mystery-puzzle", "tabletop", "strategy-sim", "murder-mystery"];

// ─── Tests 1-5: each new mode is visible/enabled ───

for (const modeId of NEW_MODES) {
  test(`${modeId} is visible and active`, () => {
    assert.equal(getMode(modeId)?.status, MODE_STATUS.ACTIVE);
    assert.equal(isModeVisible(modeId), true);
  });
}

// ─── Test 6: creation-forge remains not visible ───

test("creation-forge remains not visible and not persisted", () => {
  assert.equal(isModeVisible("creation-forge"), false);
  assert.equal(getMode("creation-forge")?.status, MODE_STATUS.PLANNED);
  const r = createProjectFromMode("creation-forge", { title: "test" }, { persist: true });
  assert.equal(r.ok, false);
});

// ─── Test 7: DATA_MODES unchanged ───

test("DATA_MODES unchanged", async () => {
  const { DATA_MODES } = await import("../../src/core/engine/modules.js");
  assert.equal(Object.keys(DATA_MODES).length, 3);
  assert.ok(DATA_MODES.worldbook);
  assert.ok(DATA_MODES.character_card);
  assert.ok(DATA_MODES.preset);
});

// ─── Tests 8-12: draft dataMode = worldbook for all new modes ───

for (const modeId of NEW_MODES) {
  test(`${modeId} draft dataMode = worldbook`, () => {
    const draft = createModeProjectDraft(modeId, { title: "test" });
    assert.equal(draft.mode, modeId);
    assert.equal(draft.dataMode, "worldbook");
    assert.equal(draft.worldSubType, "classic");
  });
}

// ─── Tests 13-17: draft includes modeRuntimePacket ───

for (const modeId of NEW_MODES) {
  test(`${modeId} draft includes modeRuntimePacket`, () => {
    const draft = createModeProjectDraft(modeId, { title: "test" });
    assert.ok(draft.modeRuntimePacket);
  });
}

// ─── Tests 18-22: draft includes moduleRuntimePacket ───

for (const modeId of NEW_MODES) {
  test(`${modeId} draft includes moduleRuntimePacket`, () => {
    const draft = createModeProjectDraft(modeId, { title: "test" });
    assert.ok(draft.moduleRuntimePacket);
  });
}

// ─── Tests 23-27: draft includes modeStateEnvelope ───

for (const modeId of NEW_MODES) {
  test(`${modeId} draft includes modeStateEnvelope`, () => {
    const draft = createModeProjectDraft(modeId, { title: "test" });
    assert.ok(draft.modeStateEnvelope);
  });
}

// ─── Tests 28-32: mode-specific shared files ───

const SHARED_FILES = {
  "world-rpg": "shared/world_rpg.json",
  "mystery-puzzle": "shared/mystery.json",
  tabletop: "shared/tabletop.json",
  "strategy-sim": "shared/strategy.json",
  "murder-mystery": "shared/murder_mystery.json"
};

for (const [modeId, fileKey] of Object.entries(SHARED_FILES)) {
  const expectedSchemaVersion = modeId === "strategy-sim" ? 2 : 1;
  test(`${modeId} files has ${fileKey}`, () => {
    const draft = createModeProjectDraft(modeId, { title: "test" });
    const files = createModeProjectFiles(draft);
    assert.ok(files[fileKey], `${fileKey} missing for ${modeId}`);
    assert.equal(files[fileKey].schemaVersion, expectedSchemaVersion);
    assert.equal(files[fileKey].mode, modeId);
  });
}

// ─── Test 33: creation-forge still reject ───

test("createProjectFromMode('creation-forge', persist=true) rejected", () => {
  const r = createProjectFromMode("creation-forge", { title: "test" }, { persist: true });
  assert.equal(r.ok, false);
});

// ─── Test 34: quick-setting still visible ───

test("quick-setting remains visible", () => {
  assert.equal(isModeVisible("quick-setting"), true);
});

// ─── Test 35: character still visible ───

test("character remains visible", () => {
  assert.equal(isModeVisible("character"), true);
});

// ─── Test 36: all 5 new modes allowed for creation ───

for (const modeId of NEW_MODES) {
  test(`${modeId} allowed for project creation`, () => {
    const perm = assertModeProjectCanBeCreated(modeId);
    assert.equal(perm.allowed, true);
  });
}
