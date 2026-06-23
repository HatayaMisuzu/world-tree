export function createProposal(input = {}, options = {}) {
  return { id: `prop_${Date.now()}`, type: input.type || "world_state_update", summary: input.summary || "", patch: input.patch || {}, status: "pending", modeId: input.modeId || "", projectId: input.projectId || "", createdAt: new Date().toISOString() };
}

export function validateProposal(proposal = {}) {
  const errors = [];
  if (!proposal.type) errors.push("missing type");
  if (!["pending","approved","rejected"].includes(proposal.status)) errors.push("invalid status");
  return { ok: errors.length === 0, errors };
}

export function approveProposal(project = {}, proposalId, services = {}, options = {}) {
  return { ok: true, proposalId, status: "approved", message: "proposal approved for shared write" };
}

export function rejectProposal(project = {}, proposalId, services = {}, options = {}) {
  return { ok: true, proposalId, status: "rejected", message: "proposal rejected" };
}

export function listPendingProposals(project = {}, options = {}) {
  return { proposals: Array.isArray(project.proposals) ? project.proposals.filter(p => p.status === "pending") : [] };
}

export function createProposalSummary(proposal = {}) { return { id: proposal.id, type: proposal.type, status: proposal.status }; }
