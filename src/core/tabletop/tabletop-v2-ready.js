// src/core/tabletop/tabletop-v2-ready.js — v2-ready tabletop slice
// Stage 4: rule ref, check, clock, runtime truth. NOT full DND.
export function normalizeTabletopV2Ready(input = {}) {
  return Object.freeze({
    ruleSourceRef: String(input?.ruleSourceRef || ""),
    checkResult: input?.checkResult !== undefined ? { ...input.checkResult } : null,
    difficultyTag: String(input?.difficultyTag || "normal"),
    challengeState: String(input?.challengeState || ""),
    clockState: input?.clockState !== undefined ? { ...input.clockState } : null,
    failureConsequenceCandidate: input?.failureConsequenceCandidate !== undefined ? { ...input.failureConsequenceCandidate } : null,
    runtimeTruth: input?.runtimeTruth !== undefined ? { ...input.runtimeTruth } : null,
  });
}
