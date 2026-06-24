// src/core/mystery-puzzle/mystery-v2-ready.js — v2-ready mystery slice
// Stage 4: clue/hypothesis/truth lock. NOT full inference engine.
export function normalizeMysteryV2Ready(input = {}) {
  return Object.freeze({
    clueRecord: input?.clueRecord !== undefined ? { ...input.clueRecord } : null,
    hypothesisRecord: input?.hypothesisRecord !== undefined ? { ...input.hypothesisRecord } : null,
    evidenceLink: input?.evidenceLink !== undefined ? { ...input.evidenceLink } : null,
    contradictionCandidate: input?.contradictionCandidate !== undefined ? { ...input.contradictionCandidate } : null,
    truthLock: input?.truthLock !== undefined ? { ...input.truthLock } : { visibility: "hidden_truth", locked: true },
    revealCondition: String(input?.revealCondition || ""),
    knownToPlayer: Boolean(input?.knownToPlayer ?? false),
  });
}
