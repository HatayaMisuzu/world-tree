// Character V2 Candidate Review Queue
// Manages pending candidates from live turns for user review.
// All candidates require user confirmation before writing to confirmed stores.

export function createCandidateEnvelope(candidate = {}) {
  return {
    candidateId: candidate.candidateId || `cand_${Date.now()}`,
    characterId: candidate.characterId || "",
    kind: candidate.kind || "memory",    // memory | relationship | quality | canon_proposal
    sourceTurnId: candidate.sourceTurnId || null,
    excerpt: candidate.excerpt || candidate.content?.slice(0, 200) || "",
    payload: candidate.payload || candidate,
    confidence: candidate.confidence || 0.5,
    riskLevel: candidate.riskLevel || "low",
    status: "pending",                   // pending | accepted | rejected | merged | deferred
    requiresUserConfirmation: true,
    autoWrite: false,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewDecision: null,
    reviewPatch: null,
  };
}

export function acceptCandidate({ state = {}, candidateId = "", patch = {} } = {}) {
  const updated = {
    ...state,
    memory: { ...state.memory },
    relationship: { ...state.relationship },
    canon: { ...state.canon },
    quality: { ...state.quality },
  };

  // Move candidate from pending to appropriate store based on kind
  const pending = [...(state.memory?.pending || []), ...(state.relationship?.pending || []), ...(state.canon?.proposals || []), ...(state.quality?.issues || [])];
  const candidate = pending.find((c) => c.candidateId === candidateId);
  if (!candidate) return state;

  // Mark as accepted
  candidate.status = "accepted";
  candidate.reviewedAt = new Date().toISOString();
  candidate.reviewDecision = "accepted";
  candidate.reviewPatch = patch;

  return updated;
}

export function rejectCandidate({ state = {}, candidateId = "", reason = "" } = {}) {
  // Find and mark candidate as rejected
  const updated = structuredClone(state);
  const allPending = [
    ...(updated.memory?.pending || []),
    ...(updated.relationship?.pending || []),
    ...(updated.canon?.proposals || []),
    ...(updated.quality?.issues || []),
  ];
  const candidate = allPending.find((c) => c.candidateId === candidateId);
  if (candidate) {
    candidate.status = "rejected";
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewDecision = "rejected";
    candidate.reviewReason = reason;
  }
  return updated;
}

export function mergeCandidates({ state = {}, candidateIds = [], mergedPayload = {} } = {}) {
  const updated = structuredClone(state);
  // Mark original candidates as merged
  for (const cid of candidateIds) {
    const candidate = findCandidateInState(updated, cid);
    if (candidate) {
      candidate.status = "merged";
      candidate.reviewedAt = new Date().toISOString();
    }
  }
  return updated;
}

export function undoCandidateDecision({ state = {}, decisionId = "" } = {}) {
  // Find the audit entry and revert
  const entry = (state.auditLog || []).find((e) => e.eventId === decisionId || e.candidateId === decisionId);
  if (!entry) return state;
  // Mark candidate back to pending
  const candidate = findCandidateInState(state, entry.candidateId);
  if (candidate) {
    candidate.status = "pending";
    candidate.reviewedAt = null;
    candidate.reviewDecision = null;
  }
  return state;
}

function findCandidateInState(state, candidateId) {
  const all = [
    ...(state.memory?.pending || []), ...(state.memory?.confirmed || []), ...(state.memory?.rejected || []),
    ...(state.relationship?.pending || []),
    ...(state.canon?.proposals || []), ...(state.canon?.confirmed || []),
    ...(state.quality?.issues || []),
  ];
  return all.find((c) => c.candidateId === candidateId);
}
