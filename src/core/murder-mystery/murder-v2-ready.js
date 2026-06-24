// src/core/murder-mystery/murder-v2-ready.js — v2-ready murder mystery slice
// Stage 4: case/suspect/testimony/truth lock. NOT full murder-mystery engine.
export function normalizeMurderV2Ready(input = {}) {
  return Object.freeze({
    caseRecord: input?.caseRecord !== undefined ? { ...input.caseRecord } : null,
    suspectRef: String(input?.suspectRef || ""),
    testimonyRecord: input?.testimonyRecord !== undefined ? { ...input.testimonyRecord } : null,
    alibiClaim: input?.alibiClaim !== undefined ? { ...input.alibiClaim } : null,
    motiveCandidate: input?.motiveCandidate !== undefined ? { ...input.motiveCandidate } : null,
    caseTimelineFragment: input?.caseTimelineFragment !== undefined ? { ...input.caseTimelineFragment } : null,
    truthVisibility: String(input?.truthVisibility || "hidden_truth"),
    interrogationRecord: input?.interrogationRecord !== undefined ? { ...input.interrogationRecord } : null,
  });
}
