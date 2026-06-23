export function createWorldStateProposal(input = {}, options = {}) {
  return { id: `proposal_${Date.now()}`, type: input.type || "world_state_update", summary: input.summary || "", patch: input.patch || {}, reason: input.reason || "", status: "pending", scope: input.scope || "world_state", createdAt: new Date().toISOString() };
}

export function validateWorldStateProposal(proposal = {}, options = {}) {
  const errors = [], warnings = [];
  if (!proposal.type) errors.push("type required");
  if (!proposal.summary) errors.push("summary required");
  return { ok: errors.length === 0, errors, warnings };
}

export function applyApprovedWorldStateProposal(worldState = {}, proposal = {}, options = {}) {
  if (proposal.status !== "approved") return worldState;
  const patch = proposal.patch || {};
  return { ...worldState, variables: { ...(worldState.variables || {}), ...(patch.variables || {}) }, flags: { ...(worldState.flags || {}), ...(patch.flags || {}) }, lastUpdatedBy: "proposal", updatedAt: new Date().toISOString() };
}

export function serializeWorldStateProposal(proposal = {}, options = {}) {
  return JSON.stringify(proposal);
}
