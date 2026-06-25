// Character V2 Memory Writeback
// Writes accepted memory candidates to confirmed memory store.

import { acceptMemoryIntoConfirmed, rejectMemory, rankConfirmedMemories, pruneStaleMemories } from "./character-v2-memory-store.js";
import { appendCharacterAuditEvent } from "./character-v2-long-term-state.js";

export function acceptMemoryCandidate({ state = {}, candidate = {}, userPatch = {} } = {}) {
  if (!candidate.candidateId) return { state, error: "no candidateId" };
  let updated = acceptMemoryIntoConfirmed(state, candidate, userPatch);
  updated = appendCharacterAuditEvent({
    state: updated,
    event: {
      type: "memory_accept",
      candidateId: candidate.candidateId,
      memoryType: candidate.kind || candidate.type,
      excerpt: candidate.excerpt?.slice(0, 200) || "",
      userPatch,
    },
  });
  return { state: updated, status: "ok" };
}

export function rejectMemoryCandidate({ state = {}, candidate = {}, reason = "" } = {}) {
  let updated = rejectMemory(state, candidate, reason);
  updated = appendCharacterAuditEvent({
    state: updated,
    event: {
      type: "memory_reject",
      candidateId: candidate.candidateId,
      reason: reason.slice(0, 200),
    },
  });
  return { state: updated, status: "ok" };
}

export function mergeMemoryCandidates({ state = {}, candidates = [], mergedPayload = {} } = {}) {
  let updated = state;
  for (const candidate of candidates) {
    const result = acceptMemoryIntoConfirmed(updated, candidate, { ...mergedPayload, mergedFrom: candidates.map((c) => c.candidateId) });
    updated = result;
  }
  updated = appendCharacterAuditEvent({
    state: updated,
    event: {
      type: "memory_merge",
      candidateIds: candidates.map((c) => c.candidateId),
      mergedContent: mergedPayload.content?.slice(0, 200) || "",
    },
  });
  return { state: updated, status: "ok" };
}

export function buildConfirmedMemorySummary({ memories = [], maxItems = 5 } = {}) {
  const ranked = rankConfirmedMemories({ memories });
  return ranked.slice(0, maxItems).map((m) => ({
    type: m.type,
    content: m.content?.slice(0, 100),
    confidence: m.confidence,
  }));
}

export function detectMemoryConflicts({ memories = [], candidate = {} } = {}) {
  const content = candidate.content || candidate.excerpt || "";
  const conflicts = [];
  for (const mem of memories) {
    if (mem.content && content && mem.content.includes(content.slice(0, 20))) {
      conflicts.push({ memoryId: mem.memoryId, existingContent: mem.content.slice(0, 100) });
    }
  }
  return { hasConflicts: conflicts.length > 0, conflicts };
}
