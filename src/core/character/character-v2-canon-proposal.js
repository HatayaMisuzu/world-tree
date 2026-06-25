// Character V2 Canon Proposal
// Canon fact proposals and consolidation.

import { createCanonProposalFromCandidate, validateCanonProposal, acceptCanonProposal, rejectCanonProposal } from "./character-v2-canon-store.js";
import { appendCharacterAuditEvent } from "./character-v2-long-term-state.js";

export function processCanonCandidate({ state = {}, candidate = {} } = {}) {
  const proposal = createCanonProposalFromCandidate(candidate);
  const validation = validateCanonProposal(proposal);
  if (!validation.valid) return { status: "error", errors: validation.errors };

  return {
    status: "ok",
    proposal,
    state: {
      ...state,
      canon: {
        ...state.canon,
        proposals: [...(state.canon?.proposals || []), proposal],
      },
    },
  };
}

export function acceptCanon({ state = {}, proposalId = "", userPatch = {} } = {}) {
  let updated = acceptCanonProposal({ state, proposalId, userPatch });
  updated = appendCharacterAuditEvent({
    state: updated,
    event: { type: "canon_accept", proposalId, userPatch },
  });
  return { state: updated, status: "ok" };
}

export function rejectCanon({ state = {}, proposalId = "" } = {}) {
  let updated = rejectCanonProposal({ state, proposalId });
  updated = appendCharacterAuditEvent({
    state: updated,
    event: { type: "canon_reject", proposalId },
  });
  return { state: updated, status: "ok" };
}
