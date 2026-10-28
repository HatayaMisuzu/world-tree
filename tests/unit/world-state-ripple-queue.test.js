import test from "node:test";
import assert from "node:assert/strict";
import {
  rootChangeFromStateSuggestion,
  enqueueRippleProposals
} from "../../src/core/world-state/world-state-ripple-queue.js";

test("rootChangeFromStateSuggestion synthesizes depth-2 effects for major impact", () => {
  const root = rootChangeFromStateSuggestion({
    "状态建议": { impactLevel: "major", stateId: "capital", summary: "siege" }
  }, { input: "攻城", round: 3 });
  assert.ok(root);
  assert.equal(root.impactLevel, "major");
  assert.equal(root.effects.some((e) => e.depth === 2), true);
});

test("rootChangeFromStateSuggestion ignores light/medium without effects", () => {
  assert.equal(rootChangeFromStateSuggestion({ "状态建议": { impactLevel: "medium", stateId: "x" } }), null);
  assert.equal(rootChangeFromStateSuggestion({}), null);
});

test("enqueueRippleProposals puts depth≥2 into pending proposal queue", () => {
  const root = {
    id: "siege_root",
    stateId: "capital",
    impactLevel: "major",
    effects: [
      { depth: 1, confidence: 0.9, stateId: "capital_direct", summary: "direct" },
      { depth: 2, confidence: 0.8, stateId: "harbor", summary: "harbor threatened" },
      { depth: 3, confidence: 0.9, stateId: "rumor", summary: "hook" }
    ]
  };
  const { ripple, proposals } = enqueueRippleProposals("", root, { modeId: "world-rpg" });
  assert.equal(ripple.maxDepth, 2);
  assert.ok(proposals.length >= 1);
  assert.equal(proposals.every((p) => p.status === "pending" && Number(p.rippleDepth) >= 2), true);
  assert.equal(proposals.every((p) => p.causedBy === "siege_root"), true);
});
