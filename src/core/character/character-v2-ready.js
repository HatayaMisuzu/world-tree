// src/core/character/character-v2-ready.js — v2-ready character slice
// Stage 4: relationship state, boundaries, memory candidates. NOT character distillation.
export function normalizeCharacterV2Ready(input = {}) {
  return Object.freeze({
    characterId: String(input?.characterId || ""),
    relationshipState: {
      stage: ["stranger","known","trusted","close","custom"].includes(input?.relationshipState?.stage)
        ? input.relationshipState.stage : "stranger",
      trust: Number(input?.relationshipState?.trust ?? 0),
      familiarity: Number(input?.relationshipState?.familiarity ?? 0),
      tension: Number(input?.relationshipState?.tension ?? 0),
    },
    boundaries: Array.isArray(input?.boundaries) ? [...input.boundaries].slice(0, 20) : [],
    confirmedUserFacts: Array.isArray(input?.confirmedUserFacts) ? [...input.confirmedUserFacts].slice(0, 50) : [],
    memoryCandidates: Array.isArray(input?.memoryCandidates) ? [...input.memoryCandidates].slice(0, 20) : [],
    relationshipEvents: Array.isArray(input?.relationshipEvents) ? [...input.relationshipEvents].slice(0, 50) : [],
    forbiddenAssumptions: Array.isArray(input?.forbiddenAssumptions) ? [...input.forbiddenAssumptions].slice(0, 20) : [],
    visibilityScope: String(input?.visibilityScope || "player_visible"),
  });
}
