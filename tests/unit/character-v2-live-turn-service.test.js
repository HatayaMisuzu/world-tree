import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { createCharacterCapsuleDraft } from "../../src/core/character/character-v2-capsule-creation.js";
import { createOrPreviewCharacterCapsule } from "../../src/server/character-capsule-service.js";
import { handleCharacterV2LiveTurn } from "../../src/server/character-v2-live-turn-service.js";

test("dryRun returns packet summary without calling LLM", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wt-char-v2-live-"));
  const draft = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "live1" }).draft;
  createOrPreviewCharacterCapsule({ draft, confirmed: true }, { charactersRoot: root });

  const result = await handleCharacterV2LiveTurn({
    characterId: draft.characterId,
    userInput: "今天有点累。",
    dryRun: true
  }, { charactersRoot: root, llmCaller: null });

  assert.equal(result.status, "ok");
  assert.equal(result.dryRun, true);
  assert.equal(result.writes.canon, false);
  assert.ok(result.packetSummary.packetChars > 0);
});

test("valid request is rejected if mvp unavailable", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wt-char-v2-live-"));
  const result = await handleCharacterV2LiveTurn({
    characterId: "char_nonexistent",
    userInput: "你好",
    dryRun: true
  }, { charactersRoot: root, llmCaller: null });

  assert.equal(result.status, "error");
  assert.equal(result.code, "CHARACTER_V2_RUNTIME_MVP_UNAVAILABLE");
});
