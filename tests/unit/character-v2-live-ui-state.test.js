import test from "node:test";
import assert from "node:assert/strict";

import {
  createCharacterV2LiveUiState,
  beginCharacterV2LiveTurn,
  appendCharacterV2LiveHistory,
  summarizeCharacterV2LiveCandidates,
  completeCharacterV2LiveTurn,
  failCharacterV2LiveTurn
} from "../../src/core/character/character-v2-live-ui-state.js";

test("advanced hidden by default", () => {
  const state = createCharacterV2LiveUiState();
  assert.equal(state.advancedOpen, false);
  assert.equal(state.busy, false);
});

test("begin sets busy", () => {
  const state = createCharacterV2LiveUiState();
  const next = beginCharacterV2LiveTurn(state, { characterId: "char_1", input: "你好" });
  assert.equal(next.busy, true);
  assert.equal(next.error, "");
  assert.equal(next.characterId, "char_1");
});

test("complete stores reply and advances history", () => {
  let state = createCharacterV2LiveUiState();
  state = beginCharacterV2LiveTurn(state, { characterId: "char_1", input: "你好" });
  state = completeCharacterV2LiveTurn(state, { reply: "嗨，今天过得怎么样？", candidates: { memoryCandidates: [], relationshipCandidates: [], qualityCandidates: [] } });
  assert.equal(state.reply, "嗨，今天过得怎么样？");
  assert.equal(state.history.length, 2);
  assert.equal(state.history[0].role, "user");
  assert.equal(state.input, "");
});

test("history capped", () => {
  let history = [];
  for (let i = 0; i < 30; i++) {
    history = appendCharacterV2LiveHistory(history, `msg${i}`, `reply${i}`);
  }
  assert.ok(history.length <= 24);
});

test("normal candidate summary excludes raw payload", () => {
  const summary = summarizeCharacterV2LiveCandidates({
    candidates: { memoryCandidates: [{ id: "m1", reason: "test", payload: { secret: "hidden" } }], relationshipCandidates: [], qualityCandidates: [] }
  });
  assert.equal(summary.memory, 1);
  assert.equal(summary.safeForNormalUi, true);
  assert.equal(JSON.stringify(summary).includes("hidden"), false);
});

test("fail clears busy and stores error", () => {
  let state = createCharacterV2LiveUiState();
  state = beginCharacterV2LiveTurn(state, { characterId: "char_1" });
  state = failCharacterV2LiveTurn(state, new Error("崩溃了"));
  assert.equal(state.busy, false);
  assert.equal(state.error, "崩溃了");
});
