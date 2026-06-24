// tests/unit/v2-ready-visibility.test.js — Stage 4 P0
import test from "node:test";
import assert from "node:assert/strict";
import { canExposeToPlayer, filterPlayerVisible, filterPromptVisible } from "../../src/core/v2-ready/visibility-policy.js";

test("canExposeToPlayer denies hidden_truth always", () => {
  assert.equal(canExposeToPlayer({ id: "1", visibility: "hidden_truth" }), false);
  assert.equal(canExposeToPlayer({ id: "1", visibility: "hidden_truth" }, { modeId: "mystery-puzzle" }), false);
});

test("canExposeToPlayer denies system_only", () => {
  assert.equal(canExposeToPlayer({ id: "1", visibility: "system_only" }), false);
});

test("canExposeToPlayer allows player_visible", () => {
  assert.equal(canExposeToPlayer({ id: "1", visibility: "player_visible" }), true);
});

test("canExposeToPlayer denies gm_only for player context", () => {
  assert.equal(canExposeToPlayer({ id: "1", visibility: "gm_only" }), false);
});

test("canExposeToPlayer enforces mode_private scope", () => {
  const r = { id: "1", visibility: "mode_private", modeScope: ["mystery-puzzle"] };
  assert.equal(canExposeToPlayer(r, { modeId: "mystery-puzzle" }), true);
  assert.equal(canExposeToPlayer(r, { modeId: "strategy-sim" }), false);
});

test("filterPlayerVisible strips to safe fields", () => {
  const records = [
    { id: "a", visibility: "player_visible", type: "clue", secret: "should not appear" },
    { id: "b", visibility: "hidden_truth", type: "answer" },
    { id: "c", visibility: "player_visible", type: "goal" }
  ];
  const result = filterPlayerVisible(records, { modeId: "mystery-puzzle" });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "a");
  assert.equal(result[1].id, "c");
  assert.equal(result[0].secret, undefined, "secret field stripped");
  assert.equal(result[0].visibility, "player_visible");
});

test("filterPromptVisible returns full records for safe entries", () => {
  const records = [
    { id: "a", visibility: "player_visible", data: "hello" },
    { id: "b", visibility: "hidden_truth", data: "secret" }
  ];
  const result = filterPromptVisible(records);
  assert.equal(result.length, 1);
  assert.equal(result[0].data, "hello");
});

test("canExposeToPlayer handles null/undefined", () => {
  assert.equal(canExposeToPlayer(null), false);
  assert.equal(canExposeToPlayer(undefined), false);
  assert.equal(canExposeToPlayer({}), false);
});
