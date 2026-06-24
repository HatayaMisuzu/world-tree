// tests/unit/mystery-v2-ready.test.js — Stage 4 P3
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMysteryV2Ready } from "../../src/core/mystery-puzzle/mystery-v2-ready.js";

test("normalizeMysteryV2Ready defaults truthLock to hidden_truth", () => {
  const m = normalizeMysteryV2Ready({});
  assert.equal(m.truthLock.visibility, "hidden_truth");
  assert.equal(m.truthLock.locked, true);
});

test("normalizeMysteryV2Ready preserves clue and hypothesis", () => {
  const m = normalizeMysteryV2Ready({
    clueRecord: { name: "footprint" },
    hypothesisRecord: { statement: "butler did it" }
  });
  assert.equal(m.clueRecord.name, "footprint");
  assert.equal(m.hypothesisRecord.statement, "butler did it");
});
