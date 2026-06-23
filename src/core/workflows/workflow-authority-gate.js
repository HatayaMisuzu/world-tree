// workflow-authority-gate.js — Authority decisions per workflow type
import { WORKFLOW_TYPES } from "./workflow-types.js";
export function decideWorkflowAuthority(envelope, intent = {}) {
  const wt = envelope.workflowType;
  const base = { canWriteCanon: false, canWriteRuntime: true, mustUseProposal: true, candidateOnly: true, initializationWriteAllowed: false, manualCanonEditAllowed: false, proposalApprovedWriteAllowed: false, debugReadOnly: false, reason: "default_candidate_only" };
  if (wt === WORKFLOW_TYPES.CREATION_INSTANTIATE) return { ...base, canWriteCanon: intent.userConfirmed === true, initializationWriteAllowed: intent.userConfirmed === true, candidateOnly: intent.userConfirmed !== true, reason: intent.userConfirmed ? "confirmed_initialization_write" : "creation_requires_confirmation" };
  if (wt === WORKFLOW_TYPES.PROPOSAL_APPROVE) return { ...base, canWriteCanon: intent.proposalApproved === true, proposalApprovedWriteAllowed: intent.proposalApproved === true, candidateOnly: intent.proposalApproved !== true, reason: intent.proposalApproved ? "approved_proposal_write" : "proposal_not_approved" };
  if (wt === WORKFLOW_TYPES.DEBUG_INSPECT) return { ...base, canWriteRuntime: false, mustUseProposal: false, candidateOnly: false, debugReadOnly: true, reason: "debug_read_only" };
  return base;
}
