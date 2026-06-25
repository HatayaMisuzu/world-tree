// Character V2 Memory Store
// Manages pending/confirmed/rejected memories for a character.

export const MEMORY_TYPES = [
  "preference", "identity_fact", "relationship_fact", "boundary",
  "recurring_context", "correction", "event_memory",
];

export function createMemoryEntry(candidate = {}) {
  return {
    memoryId: candidate.memoryId || `mem_${Date.now()}`,
    type: candidate.type || "event_memory",
    content: candidate.content || candidate.excerpt || "",
    sourceTurnId: candidate.sourceTurnId || null,
    candidateId: candidate.candidateId || null,
    confidence: candidate.confidence || 0.5,
    tags: candidate.tags || [],
    userDecision: candidate.userDecision || null,
    userPatch: candidate.userPatch || null,
    acceptedAt: candidate.acceptedAt || null,
    rejectedAt: candidate.rejectedAt || null,
    expiresAt: candidate.expiresAt || null,
    active: true,
    version: 1,
  };
}

export function acceptMemoryIntoConfirmed(state = {}, candidate = {}, userPatch = {}) {
  const entry = createMemoryEntry({ ...candidate, ...userPatch, userDecision: "accepted", acceptedAt: new Date().toISOString() });
  return {
    ...state,
    memory: {
      ...state.memory,
      confirmed: [...(state.memory?.confirmed || []), entry],
      pending: (state.memory?.pending || []).filter((p) => p.candidateId !== candidate.candidateId),
    },
  };
}

export function rejectMemory(state = {}, candidate = {}, reason = "") {
  const entry = createMemoryEntry({ ...candidate, userDecision: "rejected", rejectedAt: new Date().toISOString() });
  return {
    ...state,
    memory: {
      ...state.memory,
      rejected: [...(state.memory?.rejected || []), entry],
      pending: (state.memory?.pending || []).filter((p) => p.candidateId !== candidate.candidateId),
    },
  };
}

export function rankConfirmedMemories({ memories = [], currentContext = "" } = {}) {
  // Simple ranking: prefer recent, high-confidence, context-relevant
  return [...memories].sort((a, b) => {
    const aScore = (a.confidence || 0) + (a.acceptedAt ? 0.1 : 0);
    const bScore = (b.confidence || 0) + (b.acceptedAt ? 0.1 : 0);
    return bScore - aScore;
  });
}

export function pruneStaleMemories({ memories = [], policy = {} } = {}) {
  const maxAge = policy.maxAgeDays || 90;
  const cutoff = Date.now() - maxAge * 86400000;
  return memories.filter((m) => {
    if (!m.acceptedAt) return true;
    return new Date(m.acceptedAt).getTime() > cutoff;
  });
}
