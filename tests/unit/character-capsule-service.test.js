import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { createCharacterCapsuleDraft } from "../../src/core/character/character-v2-capsule-creation.js";
import {
  createOrPreviewCharacterCapsule,
  loadCharacterCapsuleSummary
} from "../../src/server/character-capsule-service.js";

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wt-char-v2-"));
}

test("preview mode returns summary and writes nothing", () => {
  const root = mkRoot();
  const draft = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "svc1" }).draft;
  const result = createOrPreviewCharacterCapsule({ draft }, { charactersRoot: root });
  assert.equal(result.status, "preview");
  assert.equal(result.wrote, false);
  assert.equal(fs.existsSync(path.join(root, draft.characterId)), false);
});

test("confirmed mode writes V2 sidecars and legacy card", () => {
  const root = mkRoot();
  const draft = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "svc2" }).draft;
  const result = createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });
  assert.equal(result.status, "ok");
  assert.equal(fs.existsSync(path.join(root, result.characterId, "card.json")), true);
  assert.equal(fs.existsSync(path.join(root, result.characterId, "v2", "capsule.manifest.json")), true);
  assert.equal(fs.existsSync(path.join(root, result.characterId, "v2", "performance-fingerprint.json")), true);
});

test("unsafe draft that writes canon is rejected", () => {
  const root = mkRoot();
  const draft = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "svc3" }).draft;
  draft.persistencePolicy.mayWriteCanon = true;
  const result = createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });
  assert.equal(result.status, "error");
  assert.equal(result.code, "CHARACTER_V2_DRAFT_INVALID");
});

test("avatar remains UI-only after persistence", () => {
  const root = mkRoot();
  const draft = createCharacterCapsuleDraft({
    name: "美铃",
    text: "角色设定",
    avatar: { label: "头像", dataUri: "data:image/png;base64,AAAA" }
  }, { seed: "svc4" }).draft;
  createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, draft.characterId, "v2", "capsule.manifest.json"), "utf8"));
  assert.equal(manifest.avatar.uiOnly, true);
  assert.equal(manifest.avatar.metadataParsed, false);
  assert.equal(manifest.avatar.participatesInPrompt, false);
});

test("load summary omits technical details", () => {
  const root = mkRoot();
  const draft = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "svc5" }).draft;
  createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });
  const loaded = loadCharacterCapsuleSummary(root, draft.characterId);
  assert.equal(loaded.displayName, "美铃");
  assert.equal(loaded.summary.safeForNormalUi, true);
  assert.equal(JSON.stringify(loaded).includes("promptPreview"), false);
  assert.equal(JSON.stringify(loaded).includes("moduleTrace"), false);
});
