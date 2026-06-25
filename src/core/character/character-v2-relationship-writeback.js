// Character V2 Relationship Writeback
// Writes relationship changes after user confirmation.
// Major changes require double confirmation.

import { proposeRelationshipChange, acceptRelationshipChange } from "./character-v2-relationship-state.js";
import { appendCharacterAuditEvent } from "./character-v2-long-term-state.js";

const MAJOR_CHANGE_TYPES = ["romance", "dependency", "intimate_name", "identity_relation", "long_term_commitment"];

export function proposeRelationshipWriteback({ state = {}, candidate = {}, currentRelationship = {} } = {}) {
  const proposal = proposeRelationshipChange({ candidate, currentRelationship });
  if (proposal.status !== "ok") return proposal;

  return {
    status: "ok",
    proposal: proposal.proposal,
    requiresDoubleConfirm: proposal.proposal.requiresDoubleConfirm,
  };
}

export function acceptRelationshipWriteback({ state = {}, proposal = {}, userDecision = "accepted", doubleConfirmed = false } = {}) {
  if (proposal.requiresDoubleConfirm && !doubleConfirmed) {
    return { status: "pending_double_confirm", message: "此关系变化需要二次确认" };
  }

  let updated = acceptRelationshipChange({ state, proposal, userDecision });
  updated = appendCharacterAuditEvent({
    state: updated,
    event: {
      type: "relationship_change",
      changeType: proposal.changeType,
      fromBaseline: proposal.fromState?.baseline,
      toBaseline: proposal.toState?.baseline,
      userDecision,
      doubleConfirmed,
    },
  });

  return { state: updated, status: "ok" };
}

export function rejectRelationshipWriteback({ state = {}, proposal = {}, reason = "" } = {}) {
  const updated = appendCharacterAuditEvent({
    state,
    event: {
      type: "relationship_reject",
      changeType: proposal.changeType,
      reason: reason.slice(0, 200),
    },
  });
  return { state: updated, status: "ok" };
}

export function isMajorRelationshipChange(changeType = "") {
  return MAJOR_CHANGE_TYPES.includes(changeType);
}
