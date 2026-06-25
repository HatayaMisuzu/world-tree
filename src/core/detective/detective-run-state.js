// Detective V2 Run State
// Isolated run state for detective play sessions. Never mixes with Tabletop/Character runtime.

import { createDetectiveRuntimeIsolationMeta, assertDetectiveRuntimeIsolation } from "./detective-asset-links.js";
import { createNotebookState } from "./detective-player-notebook.js";

export function createDetectiveRunState({ caseCapsule, playerProfile } = {}) {
  const now = new Date().toISOString();
  const runId = `det_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const caseId = caseCapsule?.caseId || "";

  const iso = createDetectiveRuntimeIsolationMeta();

  return {
    runId,
    caseId,
    mode: "detective",
    runtimeIsolation: iso,
    createdAt: now,
    updatedAt: now,
    playerProfile: playerProfile ? { name: playerProfile.name || "侦探" } : { name: "侦探" },
    publicState: {
      currentLocationId: (caseCapsule?.locations || []).find((l) => l.isStartingLocation)?.locationId
        || caseCapsule?.locations?.[0]?.locationId || "",
      discoveredEvidenceIds: [],
      discoveredTestimonyIds: [],
      visitedLocationIds: [],
      interviewedCharacterIds: [],
      publicTimeline: [],
      activeObjectives: caseCapsule?.playerBrief?.objective ? [caseCapsule.playerBrief.objective] : [],
    },
    hiddenCaseState: {
      truthLedgerRef: caseId,
      hiddenDiscoveryState: {},
      gmOnlyFlags: {},
    },
    notebookState: createNotebookState({ caseId }),
    deductionHistory: [],
    eventLog: [{ timestamp: now, type: "run_started", caseId }],
  };
}

export function stripDetectiveRunForPlayer(runState = {}) {
  if (!runState) return null;
  const { hiddenCaseState, runtimeIsolation, eventLog, deductionHistory, ...safe } = runState;
  // Strip sensitive parts from event log
  safe.eventLog = (eventLog || []).map((e) => {
    const { hiddenCaseState: _, truthLedgerRef, ...publicEvent } = e;
    return publicEvent;
  });
  return safe;
}

export function recordDetectiveDiscovery(runState = {}, discovery = {}) {
  if (!runState) return runState;
  const now = new Date().toISOString();
  return {
    ...runState,
    updatedAt: now,
    publicState: {
      ...runState.publicState,
      discoveredEvidenceIds: [...new Set([...(runState.publicState?.discoveredEvidenceIds || []), ...(discovery.newEvidenceIds || [])])],
      visitedLocationIds: discovery.locationId ? [...new Set([...(runState.publicState?.visitedLocationIds || []), discovery.locationId])] : runState.publicState?.visitedLocationIds || [],
    },
    eventLog: [...(runState.eventLog || []), { timestamp: now, type: "discovery", locationId: discovery.locationId, evidenceIds: discovery.newEvidenceIds }],
  };
}

export function recordDetectiveInterview(runState = {}, interview = {}) {
  if (!runState) return runState;
  const now = new Date().toISOString();
  return {
    ...runState,
    updatedAt: now,
    publicState: {
      ...runState.publicState,
      discoveredTestimonyIds: [...new Set([...(runState.publicState?.discoveredTestimonyIds || []), ...(interview.newTestimonyIds || [])])],
      interviewedCharacterIds: interview.characterId ? [...new Set([...(runState.publicState?.interviewedCharacterIds || []), interview.characterId])] : runState.publicState?.interviewedCharacterIds || [],
    },
    eventLog: [...(runState.eventLog || []), { timestamp: now, type: "interview", characterId: interview.characterId, testimonyIds: interview.newTestimonyIds }],
  };
}

export function recordDetectiveNotebookChange(runState = {}, noteChange = {}) {
  if (!runState) return runState;
  return {
    ...runState,
    updatedAt: new Date().toISOString(),
    notebookState: noteChange.notebook || runState.notebookState,
  };
}

export function recordDetectiveDeduction(runState = {}, deduction = {}) {
  if (!runState) return runState;
  return {
    ...runState,
    updatedAt: new Date().toISOString(),
    deductionHistory: [...(runState.deductionHistory || []), { ...deduction, submittedAt: new Date().toISOString() }],
    eventLog: [...(runState.eventLog || []), { timestamp: new Date().toISOString(), type: "deduction_submitted", score: deduction.score }],
    publicState: deduction.ended ? { ...runState.publicState, activeObjectives: [] } : runState.publicState,
  };
}

export function validateDetectiveRunState(runState = {}) {
  const errors = [];
  if (!runState.runId) errors.push("runId required");
  if (!runState.caseId) errors.push("caseId required");
  if (runState.mode !== "detective") errors.push("mode must be detective");
  if (!runState.runtimeIsolation) errors.push("runtimeIsolation required");
  else {
    const isoCheck = assertDetectiveRuntimeIsolation(runState.runtimeIsolation);
    if (!isoCheck.ok) errors.push(...isoCheck.errors);
  }
  return { valid: errors.length === 0, errors };
}
