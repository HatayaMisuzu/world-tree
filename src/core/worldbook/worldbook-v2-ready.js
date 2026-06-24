// src/core/worldbook/worldbook-v2-ready.js — v2-ready worldbook slice
// Stage 4: entity/location/event/time refs. NOT a full world state machine.
export function normalizeWorldV2Ready(input = {}) {
  return Object.freeze({
    worldEntityRef: String(input?.worldEntityRef || ""),
    locationRef: String(input?.locationRef || ""),
    regionStateCandidate: input?.regionStateCandidate !== undefined ? { ...input.regionStateCandidate } : null,
    worldEventCandidate: input?.worldEventCandidate !== undefined ? { ...input.worldEventCandidate } : null,
    timeBinding: input?.timeBinding !== undefined ? { ...input.timeBinding } : null,
    publicGoalRef: String(input?.publicGoalRef || ""),
    hiddenStorylineRef: String(input?.hiddenStorylineRef || ""),
    visibilityScope: String(input?.visibilityScope || "gm_only"),
    relations: Array.isArray(input?.relations) ? [...input.relations].slice(0, 50) : [],
  });
}
