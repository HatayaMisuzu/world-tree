import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createOrPreviewCharacterCapsule, loadCharacterCapsuleRuntimeMvp } from "../../src/server/character-capsule-service.js";
import { loadCharacterV2EditableProfile, saveCharacterV2EditableProfile } from "../../src/server/character-v2-profile-service.js";

function createTestCharacter(root, name = "Aster") {
  return createOrPreviewCharacterCapsule({ input: { name, text: "A reliable companion" }, confirmed: true }, { charactersRoot: root });
}

test("advanced profile save reloads and changes runtime context", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-"));
  try {
    const created = createTestCharacter(root);
    const saved = await saveCharacterV2EditableProfile(root, created.characterId, {
      displayName: "Aster Farwalker",
      oneLineSummary: "A cautious and reliable travelling companion.",
      relationshipLabel: "trusted companion",
      relationshipAllows: "discuss routes, offer support",
      relationshipForbids: "make decisions for the user",
      runtimeSummary: "Respond naturally as a travelling companion.",
      outputGuidance: "acknowledge emotion, give concise advice",
      cognitionSummary: "Knows travel basics but not specialist medicine.",
      commonKnowledgeExamples: "maps, trains",
      depthLimitedExamples: "specialist medicine",
      catchphrases: "We can take this slowly",
      speechHabits: "short sentences",
      gestures: "nods gently",
      expressions: "relaxed smile",
      appearanceAnchors: "canvas backpack"
    });
    assert.equal(saved.status, "ok");
    const reloaded = await loadCharacterV2EditableProfile(root, created.characterId);
    assert.equal(reloaded.editable.displayName, "Aster Farwalker");
    assert.deepEqual(reloaded.editable.catchphrases, ["We can take this slowly"]);
    const runtime = await loadCharacterCapsuleRuntimeMvp(root, created.characterId);
    assert.equal(runtime.available, true);
    assert.equal(runtime.displayName, "Aster Farwalker");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("required validation writes no target files", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-invalid-"));
  try {
    const created = createTestCharacter(root);
    const manifestPath = join(root, created.characterId, "v2", "capsule.manifest.json");
    const before = readFileSync(manifestPath, "utf8");
    const result = await saveCharacterV2EditableProfile(root, created.characterId, { displayName: "", oneLineSummary: "student" });
    assert.equal(result.code, "CHARACTER_NAME_REQUIRED");
    assert.equal(readFileSync(manifestPath, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("corrupted required source fails closed without overwriting capsule files", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-corrupt-"));
  try {
    const created = createTestCharacter(root);
    const characterDir = join(root, created.characterId);
    const corruptPath = join(characterDir, "v2", "runtime-contract.json");
    const untouchedPath = join(characterDir, "v2", "capsule.manifest.json");
    writeFileSync(corruptPath, "{ invalid json", "utf8");
    const before = readFileSync(untouchedPath, "utf8");
    const result = await saveCharacterV2EditableProfile(root, created.characterId, { displayName: "Changed", oneLineSummary: "Changed summary" });
    assert.equal(result.code, "CHARACTER_PROFILE_SOURCE_CORRUPT");
    assert.equal(readFileSync(corruptPath, "utf8"), "{ invalid json");
    assert.equal(readFileSync(untouchedPath, "utf8"), before);
    assert.equal(result.errorMsg.includes("runtime-contract.json"), true);
    assert.equal(result.errorMsg.includes(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mid-transaction failure rolls every written file back and removes journal", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-rollback-"));
  try {
    const created = createTestCharacter(root);
    const characterDir = join(root, created.characterId);
    const manifestPath = join(characterDir, "v2", "capsule.manifest.json");
    const cardPath = join(characterDir, "card.json");
    const beforeManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const beforeCard = JSON.parse(readFileSync(cardPath, "utf8"));
    const result = await saveCharacterV2EditableProfile(root, created.characterId, {
      displayName: "Broken write", oneLineSummary: "Must roll back"
    }, { faultInjector(stage, { index }) { if (stage === "before-write" && index === 3) throw new Error("injected"); } });
    assert.equal(result.code, "CHARACTER_PROFILE_SAVE_FAILED");
    assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), beforeManifest);
    assert.deepEqual(JSON.parse(readFileSync(cardPath, "utf8")), beforeCard);
    assert.equal(existsSync(join(characterDir, "v2", ".character-profile-transaction.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime load rolls back prepared transaction before consuming capsule state", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-recovery-"));
  try {
    const created = createTestCharacter(root, "Original");
    const characterDir = join(root, created.characterId);
    const v2Dir = join(characterDir, "v2");
    const manifestPath = join(v2Dir, "capsule.manifest.json");
    const original = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(manifestPath, JSON.stringify({ ...original, displayName: "Partial" }), "utf8");
    writeFileSync(join(v2Dir, ".character-profile-transaction.json"), JSON.stringify({
      schemaVersion: 1, status: "prepared", originals: { "v2/capsule.manifest.json": { existed: true, value: original } }
    }), "utf8");
    const runtime = await loadCharacterCapsuleRuntimeMvp(root, created.characterId);
    assert.equal(runtime.displayName, "Original");
    assert.equal(existsSync(join(v2Dir, ".character-profile-transaction.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("committed journal cleanup keeps next state", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-committed-"));
  try {
    const created = createTestCharacter(root, "Original");
    const characterDir = join(root, created.characterId);
    const v2Dir = join(characterDir, "v2");
    const manifestPath = join(v2Dir, "capsule.manifest.json");
    const original = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(manifestPath, JSON.stringify({ ...original, displayName: "Committed" }), "utf8");
    writeFileSync(join(v2Dir, ".character-profile-transaction.json"), JSON.stringify({
      schemaVersion: 1, status: "committed", originals: { "v2/capsule.manifest.json": { existed: true, value: original } }
    }), "utf8");
    const loaded = await loadCharacterV2EditableProfile(root, created.characterId);
    assert.equal(loaded.editable.displayName, "Committed");
    assert.equal(existsSync(join(v2Dir, ".character-profile-transaction.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("corrupt transaction journal fails closed", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-journal-corrupt-"));
  try {
    const created = createTestCharacter(root);
    const v2Dir = join(root, created.characterId, "v2");
    const manifestPath = join(v2Dir, "capsule.manifest.json");
    const before = readFileSync(manifestPath, "utf8");
    writeFileSync(join(v2Dir, ".character-profile-transaction.json"), "{ invalid journal", "utf8");
    const loaded = await loadCharacterV2EditableProfile(root, created.characterId);
    assert.equal(loaded.code, "CHARACTER_PROFILE_JOURNAL_CORRUPT");
    assert.equal(readFileSync(manifestPath, "utf8"), before);
    assert.equal(existsSync(join(v2Dir, ".character-profile-transaction.json")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("concurrent saves serialize into one complete state", async () => {
  const root = mkdtempSync(join(tmpdir(), "wt-character-profile-concurrent-"));
  try {
    const created = createTestCharacter(root);
    const [a, b] = await Promise.all([
      saveCharacterV2EditableProfile(root, created.characterId, { displayName: "Save A", oneLineSummary: "Summary A", relationshipLabel: "Relation A" }),
      saveCharacterV2EditableProfile(root, created.characterId, { displayName: "Save B", oneLineSummary: "Summary B", relationshipLabel: "Relation B" })
    ]);
    assert.equal(a.status, "ok");
    assert.equal(b.status, "ok");
    const loaded = await loadCharacterV2EditableProfile(root, created.characterId);
    const variants = [["Save A", "Summary A", "Relation A"], ["Save B", "Summary B", "Relation B"]];
    assert.equal(variants.some(([name, summary, relation]) => loaded.editable.displayName === name && loaded.editable.oneLineSummary === summary && loaded.editable.relationshipLabel === relation), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
