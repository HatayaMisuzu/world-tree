// src/core/system/hidden-field-registry.js
// P1-4 v2.1: Unified hidden-field registry.
// Includes mode aliases so detective hidden fields are not missed when call
// sites use "detective", "detective-v2", or the canonical entry "mystery-puzzle".

export const GLOBAL_HIDDEN_FIELDS = Object.freeze([
  "truthLock", "answerLock", "hiddenTruth", "hiddenFacts",
  "systemOnly", "gmOnly", "culpritId", "solution",
  "secret", "privatePlan", "aiFactionPrivatePlan",
  "_systemOnly", "aiPlans"
]);

export const DETECTIVE_HIDDEN_FIELDS = Object.freeze([
  "truthLedger",
  "hiddenMeaning",
  "deceptionReason",
  "isCulprit",
  "hiddenNotes",
  "solutionChain",
  "realTimeline"
]);

export const TABLETOP_HIDDEN_FIELDS = Object.freeze([
  "runtimeTruth",
  "failureConsequenceCandidate"
]);

export const CHARACTER_HIDDEN_FIELDS = Object.freeze([
  "forbiddenAssumptions"
]);

export const SCRIPTKILL_HIDDEN_FIELDS = Object.freeze([
  "fullTruth",
  "dmBook"
]);

export const MODE_HIDDEN_FIELDS = Object.freeze({
  detective: DETECTIVE_HIDDEN_FIELDS,
  "detective-v2": DETECTIVE_HIDDEN_FIELDS,
  "mystery-puzzle": DETECTIVE_HIDDEN_FIELDS,

  tabletop: TABLETOP_HIDDEN_FIELDS,
  "tabletop-v2": TABLETOP_HIDDEN_FIELDS,

  character: CHARACTER_HIDDEN_FIELDS,
  "character-v2": CHARACTER_HIDDEN_FIELDS,

  "single-player-scriptkill": SCRIPTKILL_HIDDEN_FIELDS,
  "single-player-scriptkill-v2": SCRIPTKILL_HIDDEN_FIELDS
});

export function getHiddenFieldsForMode(modeId) {
  const modeSpecific = MODE_HIDDEN_FIELDS[modeId] || [];
  return new Set([...GLOBAL_HIDDEN_FIELDS, ...modeSpecific]);
}

export function isHiddenField(modeId, fieldName) {
  return getHiddenFieldsForMode(modeId).has(fieldName);
}
