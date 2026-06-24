import test from "node:test";
import assert from "node:assert/strict";
import { createProposal, exportProposalSnapshot, getPendingUserConfirmations, importProposalSnapshot, resetProposalStore } from "../../src/core/engine/proposal-system.js";
import { exportEngineState, importEngineState } from "../../src/core/engine/state-persistence.js";

test("critical proposal queue survives the engine snapshot roundtrip", () => {
  resetProposalStore();
  const proposal = createProposal({ typeId: "relation", change: { field: "relationship", description: "关系网全局重构" }, source: "writer", moduleKey: "audit-world", round: 3 });
  assert.equal(proposal.status, "pending");
  const snapshot = exportEngineState({ turnCount: 3 });
  resetProposalStore();
  assert.equal(getPendingUserConfirmations().length, 0);
  importEngineState(snapshot);
  assert.equal(exportProposalSnapshot().proposals.some(item => item.id === proposal.id), true);
  resetProposalStore();
});
