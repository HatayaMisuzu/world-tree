import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialCharacterV2CreateUiState,
  setCharacterV2CreateField,
  toggleCharacterV2Advanced,
  normalizeAvatarForUi,
  buildCharacterV2CreateInput,
  buildCharacterV2ConfirmPayload,
  normalUiSummaryOnly
} from "../../src/core/character/character-v2-create-ui-state.js";

test("creation UI defaults to advanced hidden", () => {
  const state = createInitialCharacterV2CreateUiState();
  assert.equal(state.advancedOpen, false);
  assert.equal(state.open, false);
});

test("advanced opens only after explicit toggle", () => {
  const state = createInitialCharacterV2CreateUiState();
  const next = toggleCharacterV2Advanced(state);
  assert.equal(next.advancedOpen, true);
  const closed = toggleCharacterV2Advanced(next);
  assert.equal(closed.advancedOpen, false);
});

test("confirm payload marks v2 capsule and confirmation", () => {
  const payload = buildCharacterV2ConfirmPayload({ characterId: "char_test" });
  assert.equal(payload.v2Capsule, true);
  assert.equal(payload.confirmed, true);
  assert.equal(payload.draft.characterId, "char_test");
});

test("avatar is UI-only", () => {
  const avatar = normalizeAvatarForUi("data:image/png;base64,AAAA");
  assert.equal(avatar.uiOnly, true);
  assert.equal(avatar.participatesInPrompt, false);
  assert.equal(avatar.participatesInCognition, false);
  assert.equal(avatar.metadataParsed, false);
});

test("create input carries manual text fields", () => {
  let state = createInitialCharacterV2CreateUiState();
  state = setCharacterV2CreateField(state, "name", "美铃");
  state = setCharacterV2CreateField(state, "text", "普通日本学生，熟悉用户日常。 ");
  const input = buildCharacterV2CreateInput(state);
  assert.equal(input.sourceType, "manual");
  assert.equal(input.name, "美铃");
  assert.ok(input.text.includes("普通日本学生"));
});

test("normal UI summary strips technical details", () => {
  const summary = normalUiSummaryOnly({
    title: "美铃",
    subtitle: "角色摘要",
    badges: ["Text-first", "需确认"],
    lines: ["默认关系：熟悉但不过界"],
    promptPreview: "hidden",
    moduleTrace: "hidden"
  });
  assert.equal(summary.title, "美铃");
  assert.equal(JSON.stringify(summary).includes("promptPreview"), false);
  assert.equal(JSON.stringify(summary).includes("moduleTrace"), false);
});
