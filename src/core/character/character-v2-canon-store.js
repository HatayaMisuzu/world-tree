// Character V2 Canon Store
// Manages canon proposals and confirmed canon facts.

export function createCanonProposalFromCandidate(candidate = {}) {
  return {
    proposalId: `canonprop_${Date.now()}`,
    candidateId: candidate.candidateId || null,
    sourceTurnId: candidate.sourceTurnId || null,
    content: candidate.content || candidate.excerpt || "",
    category: candidate.category || "general",
    confidence: candidate.confidence || 0.5,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function validateCanonProposal(proposal = {}) {
  const errors = [];
  if (!proposal.content || proposal.content.length < 5) errors.push("content too short");
  if (!proposal.category) errors.push("missing category");
  return { valid: errors.length === 0, errors };
}

export function acceptCanonProposal({ state = {}, proposalId = "", userPatch = {} } = {}) {
  const proposal = (state.canon?.proposals || []).find((p) => p.proposalId === proposalId);
  if (!proposal) return state;

  const confirmed = {
    canonId: `canon_${Date.now()}`,
    content: userPatch.content || proposal.content,
    category: userPatch.category || proposal.category,
    sourceTurnId: proposal.sourceTurnId,
    acceptedAt: new Date().toISOString(),
    acceptedBy: userPatch.acceptedBy || "user",
  };

  return {
    ...state,
    canon: {
      ...state.canon,
      confirmed: [...(state.canon?.confirmed || []), confirmed],
      proposals: (state.canon?.proposals || []).filter((p) => p.proposalId !== proposalId),
    },
  };
}

export function rejectCanonProposal({ state = {}, proposalId = "" } = {}) {
  return {
    ...state,
    canon: {
      ...state.canon,
      proposals: (state.canon?.proposals || []).filter((p) => p.proposalId !== proposalId),
    },
  };
}
