// tests/unit/character-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCharacterV2Ready } from "../../src/core/character/character-v2-ready.js";

test("normalizeCharacterV2Ready defaults to stranger stage", () => {
  const c = normalizeCharacterV2Ready({ characterId: "alice" });
  assert.equal(c.characterId, "alice");
  assert.equal(c.relationshipState.stage, "stranger");
  assert.equal(c.relationshipState.trust, 0);
  assert.equal(c.relationshipState.familiarity, 0);
  assert.equal(c.boundaries.length, 0);
  assert.equal(c.memoryCandidates.length, 0);
});

test("normalizeCharacterV2Ready preserves explicit relationship state", () => {
  const c = normalizeCharacterV2Ready({
    characterId: "bob",
    relationshipState: { stage: "trusted", trust: 60, familiarity: 40, tension: 5 }
  });
  assert.equal(c.relationshipState.stage, "trusted");
  assert.equal(c.relationshipState.trust, 60);
});

test("normalizeCharacterV2Ready stores forbidden assumptions", () => {
  const c = normalizeCharacterV2Ready({ forbiddenAssumptions: ["is in love", "knows secret"] });
  assert.equal(c.forbiddenAssumptions.length, 2);
});
