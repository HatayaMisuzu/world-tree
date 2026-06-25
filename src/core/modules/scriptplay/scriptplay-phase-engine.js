// Reusable Scriptplay Phase Engine
// Module-layer pure helpers. Used by 单人剧本杀 V2; may later be reused by other entries.

function asArray(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }

export function getCurrentScriptPhase(packageData = {}, runState = {}) {
  const phases = asArray(packageData.phases);
  const id = runState.currentPhaseId || phases[0]?.phaseId || "";
  return phases.find(p => p.phaseId === id) || phases[0] || null;
}

export function canPerformPhaseAction(phase = {}, action = "") {
  const allowed = phase.allowedActions || {};
  if (!action) return false;
  return allowed[action] === true;
}

export function advanceScriptPhase(packageData = {}, runState = {}, options = {}) {
  const phase = getCurrentScriptPhase(packageData, runState);
  if (!phase) return { status: "error", code: "NO_PHASE" };
  const phases = asArray(packageData.phases);
  const currentIndex = phases.findIndex(p => p.phaseId === phase.phaseId);
  const nextPhaseId = options.nextPhaseId || phase.nextPhaseId || phases[currentIndex + 1]?.phaseId || null;
  if (!nextPhaseId) return { status: "complete", state: { ...runState, completedAt: new Date().toISOString() }, phase };
  const next = phases.find(p => p.phaseId === nextPhaseId);
  if (!next) return { status: "error", code: "NEXT_PHASE_NOT_FOUND", nextPhaseId };
  return {
    status: "ok",
    previousPhase: phase,
    phase: next,
    state: {
      ...runState,
      currentPhaseId: next.phaseId,
      phaseHistory: [...asArray(runState.phaseHistory), { from: phase.phaseId, to: next.phaseId, at: new Date().toISOString(), reason: options.reason || "manual_or_completion" }]
    }
  };
}

export function getPhaseUnlockedRoleActs(phase = {}) {
  return asArray(phase.unlocks?.roleActIds);
}

export function getPhaseUnlockedClueIds(packageData = {}, phase = {}) {
  const explicitDeckIds = asArray(phase.unlocks?.clueDeckIds);
  const explicitClues = asArray(phase.unlocks?.clueIds);
  const byPhase = asArray(packageData.clueCards).filter(c => c.phaseAvailable === phase.phaseId).map(c => c.clueId);
  const byDeck = asArray(packageData.clueCards).filter(c => explicitDeckIds.includes(c.deckId)).map(c => c.clueId);
  return [...new Set([...explicitClues, ...byPhase, ...byDeck])];
}
