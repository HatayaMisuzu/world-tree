// Character V2 Candidate Review Service
// Server-side service for listing, reviewing, and managing character candidates.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { createCandidateEnvelope } from "../core/character/character-v2-candidate-review-queue.js";
import { acceptMemoryCandidate, rejectMemoryCandidate, mergeMemoryCandidates } from "../core/character/character-v2-memory-writeback.js";
import { acceptRelationshipWriteback, rejectRelationshipWriteback } from "../core/character/character-v2-relationship-writeback.js";
import { acceptCanon, rejectCanon, processCanonCandidate } from "../core/character/character-v2-canon-proposal.js";
import { createCharacterV2LongTermState } from "../core/character/character-v2-long-term-state.js";

function characterDir(dataRoot, characterId) {
  return join(dataRoot, "engine", "characters", characterId);
}

function v2Dir(dataRoot, characterId) {
  return join(characterDir(dataRoot, characterId), "v2");
}

function ltStatePath(dataRoot, characterId) {
  return join(v2Dir(dataRoot, characterId), "long-term-state.json");
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadState(dataRoot, characterId) {
  const path = ltStatePath(dataRoot, characterId);
  if (!existsSync(path)) {
    return createCharacterV2LongTermState({ characterId });
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveState(dataRoot, state) {
  const dir = v2Dir(dataRoot, state.characterId);
  ensureDir(dir);
  writeFileSync(ltStatePath(dataRoot, state.characterId), JSON.stringify(state, null, 2));
}

// ── List candidates ──

export async function listCharacterV2Candidates(body = {}, deps = {}) {
  const { dataRoot } = deps;
  const { characterId } = body;
  if (!characterId) return { status: "error", code: "NO_CHARACTER_ID" };

  try {
    const state = loadState(dataRoot, characterId);
    const pending = [
      ...(state.memory?.pending || []).map((c) => ({ ...c, kind: "memory" })),
      ...(state.relationship?.pending || []).map((c) => ({ ...c, kind: "relationship" })),
      ...(state.canon?.proposals || []).map((c) => ({ ...c, kind: "canon_proposal" })),
    ];
    return { status: "ok", candidates: pending, total: pending.length };
  } catch (err) {
    return { status: "error", code: "LIST_FAILED", errorMsg: err.message };
  }
}

// ── Review single candidate ──

export async function reviewCharacterV2Candidate(body = {}, deps = {}) {
  const { dataRoot } = deps;
  const { characterId, candidateId, decision, patch, reason } = body;
  if (!characterId || !candidateId) return { status: "error", code: "MISSING_PARAMS" };

  try {
    let state = loadState(dataRoot, characterId);
    const candidate = findCandidate(state, candidateId);
    if (!candidate) return { status: "error", code: "CANDIDATE_NOT_FOUND" };

    switch (decision) {
      case "accept": {
        if (candidate.kind === "memory" || candidate.kind === undefined) {
          const result = acceptMemoryCandidate({ state, candidate, userPatch: patch || {} });
          state = result.state;
        } else if (candidate.kind === "relationship") {
          const result = acceptRelationshipWriteback({ state, proposal: candidate, userDecision: "accepted" });
          if (result.status !== "ok") return result;
          state = result.state;
        } else if (candidate.kind === "canon_proposal") {
          const result = acceptCanon({ state, proposalId: candidate.proposalId || candidateId, userPatch: patch || {} });
          state = result.state;
        }
        break;
      }
      case "reject": {
        if (candidate.kind === "memory" || candidate.kind === undefined) {
          const result = rejectMemoryCandidate({ state, candidate, reason });
          state = result.state;
        } else if (candidate.kind === "relationship") {
          const result = rejectRelationshipWriteback({ state, proposal: candidate, reason });
          state = result.state;
        } else if (candidate.kind === "canon_proposal") {
          const result = rejectCanon({ state, proposalId: candidate.proposalId || candidateId });
          state = result.state;
        }
        break;
      }
      default:
        return { status: "error", code: "INVALID_DECISION" };
    }

    saveState(dataRoot, state);
    return { status: "ok", decision };
  } catch (err) {
    return { status: "error", code: "REVIEW_FAILED", errorMsg: err.message };
  }
}

// ── Bulk review ──

export async function bulkReviewCharacterV2Candidates(body = {}, deps = {}) {
  const { dataRoot } = deps;
  const { characterId, decisions = [] } = body;
  if (!characterId || !decisions.length) return { status: "error", code: "MISSING_PARAMS" };

  try {
    let state = loadState(dataRoot, characterId);
    const results = [];

    for (const decision of decisions) {
      const result = await reviewCharacterV2Candidate(
        { characterId, ...decision },
        { dataRoot }
      );
      results.push(result);
    }

    return { status: "ok", results };
  } catch (err) {
    return { status: "error", code: "BULK_REVIEW_FAILED", errorMsg: err.message };
  }
}

// ── Undo decision ──

export async function undoCharacterV2Decision(body = {}, deps = {}) {
  const { dataRoot } = deps;
  const { characterId, decisionId } = body;
  if (!characterId || !decisionId) return { status: "error", code: "MISSING_PARAMS" };

  try {
    let state = loadState(dataRoot, characterId);
    const entry = (state.auditLog || []).find((e) => e.eventId === decisionId || e.candidateId === decisionId);
    if (!entry) return { status: "error", code: "DECISION_NOT_FOUND" };

    // Mark candidate back to pending status
    if (entry.candidateId) {
      const candidate = findAnyCandidate(state, entry.candidateId);
      if (candidate) {
        candidate.status = "pending";
        candidate.reviewedAt = null;
        candidate.reviewDecision = null;
      }
    }

    saveState(dataRoot, state);
    return { status: "ok", undone: true };
  } catch (err) {
    return { status: "error", code: "UNDO_FAILED", errorMsg: err.message };
  }
}

function findCandidate(state, candidateId) {
  const all = [
    ...(state.memory?.pending || []),
    ...(state.relationship?.pending || []),
    ...(state.canon?.proposals || []),
  ];
  return all.find((c) => c.candidateId === candidateId || c.proposalId === candidateId);
}

function findAnyCandidate(state, candidateId) {
  const all = [
    ...(state.memory?.pending || []), ...(state.memory?.confirmed || []), ...(state.memory?.rejected || []),
    ...(state.relationship?.pending || []),
    ...(state.canon?.proposals || []), ...(state.canon?.confirmed || []),
  ];
  return all.find((c) => c.candidateId === candidateId || c.proposalId === candidateId);
}
