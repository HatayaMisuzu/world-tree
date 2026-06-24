// src/core/creation-forge/creation-v2-ready.js — v2-ready creation forge slice
// Stage 4: source/artifact trace. NOT full asset market.
export function normalizeCreationV2Ready(input = {}) {
  return Object.freeze({
    sourceMaterialRef: String(input?.sourceMaterialRef || ""),
    artifactCandidate: input?.artifactCandidate !== undefined ? { ...input.artifactCandidate } : null,
    targetMode: String(input?.targetMode || ""),
    artifactType: String(input?.artifactType || ""),
    extractionTrace: Array.isArray(input?.extractionTrace) ? [...input.extractionTrace] : [],
    compatibilityCheck: input?.compatibilityCheck !== undefined ? { ...input.compatibilityCheck } : null,
    validationResult: input?.validationResult !== undefined ? { ...input.validationResult } : null,
  });
}
