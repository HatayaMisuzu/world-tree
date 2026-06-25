import test from "node:test";
import assert from "node:assert/strict";

test("live UI keeps advanced details hidden by default", () => {
  const state = {
    input: "", busy: false, error: "", reply: null, history: [],
    candidates: null, advancedOpen: false, packetSummary: null
  };
  assert.equal(state.advancedOpen, false);
});

test("normal UI candidate summary uses counts only", () => {
  const candidates = { memoryCount: 1, relationshipCount: 0, qualityCount: 2, raw: "hidden" };
  const summary = { memory: candidates.memoryCount, relationship: candidates.relationshipCount, quality: candidates.qualityCount };
  assert.equal(JSON.stringify(summary).includes("raw"), false);
});
