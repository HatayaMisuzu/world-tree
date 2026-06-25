// Character V2 Relationship State
// Manages relationship state between character and user.
// Major changes require double confirmation.

const MAJOR_CHANGE_TYPES = ["romance", "dependency", "intimate_name", "identity_relation", "long_term_commitment"];

export function createRelationshipState(baseline = "neutral") {
  return {
    baseline,
    stage: "initial",
    trustScore: 0,
    familiarityScore: 0,
    boundaryFlags: [],
    lastChangedAt: null,
    changeLog: [],
  };
}

export function proposeRelationshipChange({ candidate, currentRelationship = {} } = {}) {
  if (!candidate) return { status: "error", errorMsg: "candidate required" };

  const changeType = candidate.changeType || "general";
  const requiresDoubleConfirm = MAJOR_CHANGE_TYPES.includes(changeType);

  return {
    status: "ok",
    proposal: {
      proposalId: `relprop_${Date.now()}`,
      changeType,
      fromState: { ...currentRelationship },
      toState: applyChange(currentRelationship, candidate),
      requiresDoubleConfirm,
      doubleConfirmed: false,
      candidateId: candidate.candidateId || null,
      sourceTurnId: candidate.sourceTurnId || null,
    },
  };
}

export function acceptRelationshipChange({ state = {}, proposal = {}, userDecision = "accepted" } = {}) {
  if (!proposal.toState) return state;

  const changeLog = [...(state.relationship?.confirmed?.changeLog || []), {
    at: new Date().toISOString(),
    fromBaseline: proposal.fromState?.baseline,
    toBaseline: proposal.toState.baseline,
    changeType: proposal.changeType,
    userDecision,
  }];

  return {
    ...state,
    relationship: {
      ...state.relationship,
      confirmed: {
        ...proposal.toState,
        changeLog,
        lastChangedAt: new Date().toISOString(),
      },
      pending: (state.relationship?.pending || []).filter((p) => p.proposalId !== proposal.proposalId),
    },
  };
}

function applyChange(current, candidate) {
  return {
    ...current,
    baseline: candidate.baseline || current.baseline,
    stage: candidate.stage || current.stage,
    trustScore: Math.max(0, Math.min(100, (current.trustScore || 0) + (candidate.trustDelta || 0))),
    familiarityScore: Math.max(0, Math.min(100, (current.familiarityScore || 0) + (candidate.familiarityDelta || 0))),
    boundaryFlags: candidate.boundaryFlags || current.boundaryFlags || [],
  };
}
