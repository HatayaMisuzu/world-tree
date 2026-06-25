import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { createOrPreviewCharacterCapsule } from "../../src/server/character-capsule-service.js";
import { createCharacterCapsuleDraft } from "../../src/core/character/character-v2-capsule-creation.js";
import { exportCharacterV2 } from "../../src/server/character-v2-export-service.js";

function mkRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "wt-exp-")); }

function setupChar(root) {
  const draft = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "exp1" }).draft;
  createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });
  return draft.characterId;
}

test("character_md export returns readable markdown", () => {
  const root = mkRoot();
  const charId = setupChar(root);
  const result = exportCharacterV2(root, charId, "character_md");
  assert.equal(result.status, "ok");
  assert.ok(result.content.includes("美铃"));
  assert.ok(result.content.includes("关系基线"));
});

test("wt_profile_json excludes advanced fields", () => {
  const root = mkRoot();
  const charId = setupChar(root);
  const result = exportCharacterV2(root, charId, "wt_profile_json");
  assert.equal(result.status, "ok");
  const parsed = JSON.parse(result.content);
  assert.equal(parsed.advancedSummary, undefined);
});

test("export_bundle_json includes sidecars", () => {
  const root = mkRoot();
  const charId = setupChar(root);
  const result = exportCharacterV2(root, charId, "export_bundle_json");
  assert.equal(result.status, "ok");
  const parsed = JSON.parse(result.content);
  assert.equal(parsed.characterId, charId);
  assert.ok(parsed.runtime);
  assert.ok(parsed.manifest);
});

test("unknown format returns error", () => {
  const root = mkRoot();
  const result = exportCharacterV2(root, "char_x", "invalid");
  assert.equal(result.status, "error");
});
