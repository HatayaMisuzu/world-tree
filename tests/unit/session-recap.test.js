import test from "node:test";
import assert from "node:assert/strict";

import { createSessionRecapProposal } from "../../src/core/narrative/session-recap.js";

test("session recap routes new facts to review proposals without canon writes", () => {
  const proposal = createSessionRecapProposal({
    moduleKey: "world-a",
    turnCount: 12,
    recap: {
      summary: "The party found a sealed gate.",
      keyEvents: ["Gate found"],
      decisions: ["Do not open it yet"],
      openThreads: ["Who sealed the gate?"],
      newFacts: ["The gate bears the silver moon seal."]
    }
  });
  assert.equal(proposal.status, "pending_review");
  assert.equal(proposal.writes.canon, false);
  assert.equal(proposal.writes.proposal, true);
  assert.equal(proposal.reviewProposals.length, 1);
  assert.equal(proposal.reviewProposals[0].status, "pending");
  assert.equal(proposal.reviewProposals[0].requiresHumanReview, true);
  assert.equal(proposal.reviewProposals[0].fact, "The gate bears the silver moon seal.");
});
