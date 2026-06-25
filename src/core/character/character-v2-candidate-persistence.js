// Character V2 Candidate Persistence Helper
// Flattens live-turn candidate envelope into long-term pending stores.
// Pending only. Never auto-confirms.

export function flattenCharacterV2CandidateEnvelope(envelope = {}, context = {}) {
  const characterId = context.characterId || envelope.characterId || "";
  const sourceTurnId = context.sourceTurnId || envelope.sourceTurnId || `turn_${Date.now()}`;
  const now = context.now || new Date().toISOString();

  const out = [];
  for (const c of envelope.memoryCandidates || []) {
    out.push(makePendingCandidate({ ...c, kind: "memory", characterId, sourceTurnId, createdAt: now }));
  }
  for (const c of envelope.relationshipCandidates || []) {
    out.push(makePendingCandidate({ ...c, kind: "relationship", characterId, sourceTurnId, createdAt: now }));
  }
  for (const c of envelope.canonCandidates || envelope.canonProposalCandidates || []) {
    out.push(makePendingCandidate({ ...c, kind: "canon_proposal", characterId, sourceTurnId, createdAt: now }));
  }
  for (const c of envelope.qualityCandidates || []) {
    out.push(makePendingCandidate({ ...c, kind: "quality", characterId, sourceTurnId, createdAt: now }));
  }
  return out;
}

export function persistCharacterV2PendingCandidates({ state = {}, candidateEnvelope = {}, characterId = "", sourceTurnId = "" } = {}) {
  const candidates = flattenCharacterV2CandidateEnvelope(candidateEnvelope, { characterId, sourceTurnId });
  if (candidates.length === 0) return { state, persisted: 0, candidates: [] };

  const next = ensureLongTermShape(structuredClone(state || {}), characterId);

  for (const candidate of candidates) {
    if (candidate.kind === "memory") next.memory.pending.push(candidate);
    else if (candidate.kind === "relationship") next.relationship.pending.push(candidate);
    else if (candidate.kind === "canon_proposal") next.canon.proposals.push({ ...candidate, proposalId: candidate.proposalId || candidate.candidateId });
    else if (candidate.kind === "quality") next.quality.issues.push(candidate);
  }

  next.updatedAt = new Date().toISOString();
  next.auditLog.push({
    eventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "live_turn_candidates_persisted",
    characterId,
    sourceTurnId,
    counts: countByKind(candidates),
    timestamp: next.updatedAt
  });

  return { state: next, persisted: candidates.length, candidates };
}

export function ensureLongTermShape(state = {}, characterId = "") {
  return {
    schemaVersion: state.schemaVersion || "world-tree.character.v2.long-term.1",
    characterId: state.characterId || characterId,
    displayName: state.displayName || "",
    createdAt: state.createdAt || new Date().toISOString(),
    updatedAt: state.updatedAt || new Date().toISOString(),
    memory: {
      pending: Array.isArray(state.memory?.pending) ? state.memory.pending : [],
      confirmed: Array.isArray(state.memory?.confirmed) ? state.memory.confirmed : [],
      rejected: Array.isArray(state.memory?.rejected) ? state.memory.rejected : []
    },
    relationship: {
      pending: Array.isArray(state.relationship?.pending) ? state.relationship.pending : [],
      confirmed: state.relationship?.confirmed || { baseline: "neutral", stage: "initial", trustScore: 0, familiarityScore: 0, boundaryFlags: [], changeLog: [] },
      rejected: Array.isArray(state.relationship?.rejected) ? state.relationship.rejected : []
    },
    canon: {
      proposals: Array.isArray(state.canon?.proposals) ? state.canon.proposals : [],
      confirmed: Array.isArray(state.canon?.confirmed) ? state.canon.confirmed : []
    },
    quality: {
      issues: Array.isArray(state.quality?.issues) ? state.quality.issues : []
    },
    auditLog: Array.isArray(state.auditLog) ? state.auditLog : []
  };
}

function makePendingCandidate(candidate = {}) {
  const payload = candidate.payload || candidate;
  return {
    candidateId: candidate.candidateId || `cand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    characterId: candidate.characterId || "",
    kind: candidate.kind || "memory",
    sourceTurnId: candidate.sourceTurnId || null,
    excerpt: candidate.excerpt || candidate.content?.slice?.(0, 200) || payload.excerpt || payload.content?.slice?.(0, 200) || "",
    payload,
    confidence: normalizeConfidence(candidate.confidence),
    riskLevel: candidate.riskLevel || (candidate.kind === "quality" ? "high" : "low"),
    status: "pending",
    requiresUserConfirmation: true,
    autoWrite: false,
    createdAt: candidate.createdAt || new Date().toISOString(),
    reviewedAt: null,
    reviewDecision: null,
    reviewPatch: null
  };
}

function normalizeConfidence(value) {
  if (typeof value === "number") return value;
  if (value === "high") return 0.85;
  if (value === "medium") return 0.6;
  if (value === "low") return 0.35;
  return 0.5;
}

function countByKind(candidates = []) {
  return candidates.reduce((acc, c) => {
    acc[c.kind] = (acc[c.kind] || 0) + 1;
    return acc;
  }, {});
}
