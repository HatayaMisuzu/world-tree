// tests/unit/v2-ready-universal-metadata.test.js — Stage 4 P0
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUniversalMetadata, isPlayerVisible, isHiddenTruth, VALID_VISIBILITY } from "../../src/core/v2-ready/universal-metadata.js";

test("normalizeUniversalMetadata produces frozen record with all fields", () => {
  const r = normalizeUniversalMetadata({ id: "test-1", type: "character", visibility: "player_visible" });
  assert.equal(r.id, "test-1");
  assert.equal(r.type, "character");
  assert.equal(r.visibility, "player_visible");
  assert.equal(r.sourceType, "ai_inferred");
  assert.equal(r.authority, "inferred");
  assert.equal(r.canonState, "candidate_only");
  assert.ok(r.createdAt.includes("T"));
});

test("normalizeUniversalMetadata falls back invalid enums to safe defaults", () => {
  const r = normalizeUniversalMetadata({
    sourceType: "garbage",
    visibility: "not_a_visibility",
    canonState: "illegal",
    status: "also_bad"
  });
  assert.equal(r.sourceType, "ai_inferred");
  assert.equal(r.visibility, "gm_only");
  assert.equal(r.canonState, "candidate_only");
  assert.equal(r.status, "candidate");
});

test("normalizeUniversalMetadata respects explicit defaults override", () => {
  const r = normalizeUniversalMetadata(
    { id: "x" },
    { sourceType: "user_input", authority: "user_setting", visibility: "player_visible", canonState: "shared_canon" }
  );
  assert.equal(r.sourceType, "user_input");
  assert.equal(r.canonState, "shared_canon");
  assert.equal(r.visibility, "player_visible");
});

test("isPlayerVisible and isHiddenTruth work correctly", () => {
  assert.equal(isPlayerVisible({ visibility: "player_visible" }), true);
  assert.equal(isPlayerVisible({ visibility: "gm_only" }), false);
  assert.equal(isHiddenTruth({ visibility: "hidden_truth" }), true);
  assert.equal(isHiddenTruth({ visibility: "player_visible" }), false);
});

test("VALID_VISIBILITY includes all required values", () => {
  assert.ok(VALID_VISIBILITY.includes("player_visible"));
  assert.ok(VALID_VISIBILITY.includes("gm_only"));
  assert.ok(VALID_VISIBILITY.includes("hidden_truth"));
  assert.ok(VALID_VISIBILITY.includes("mode_private"));
  assert.ok(VALID_VISIBILITY.includes("system_only"));
});
