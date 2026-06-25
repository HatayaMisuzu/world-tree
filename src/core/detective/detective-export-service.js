// Detective V2 Export Service
// Export case packs and run reports. Player pack never includes truthLedger.

import { stripDetectiveRunForPlayer } from "./detective-run-state.js";
import { extractDetectivePlayerCaseView } from "./detective-case-capsule.js";

export function buildDetectiveCasePlayerPack({ caseCapsule, runState } = {}) {
  if (!caseCapsule) return null;

  const playerCase = extractDetectivePlayerCaseView(caseCapsule);
  const playerRun = runState ? stripDetectiveRunForPlayer(runState) : null;

  return {
    exportedAt: new Date().toISOString(),
    type: "detective-case-player-pack",
    case: playerCase,
    run: playerRun,
    // Explicitly exclude truthLedger
  };
}

export function buildDetectiveCaseGMPack({ caseCapsule, runState } = {}) {
  if (!caseCapsule) return null;

  return {
    exportedAt: new Date().toISOString(),
    type: "detective-case-gm-pack",
    private: true,
    case: caseCapsule,
    run: runState,
    // Includes full truthLedger for GM
  };
}

export function buildDetectiveRunReport({ caseCapsule, runState, reviewResult } = {}) {
  if (!caseCapsule || !runState) return null;

  const playerRun = stripDetectiveRunForPlayer(runState);

  return {
    exportedAt: new Date().toISOString(),
    type: "detective-run-report",
    caseId: caseCapsule.caseId,
    runId: runState.runId,
    title: caseCapsule.title,
    playerCase: extractDetectivePlayerCaseView(caseCapsule),
    playerRun,
    evidenceBoard: createExportEvidenceBoard(runState),
    testimonyBoard: createExportTestimonyBoard(runState),
    timelineBoard: runState.publicState?.timelineEntries || [],
    hypothesisBoard: runState.publicState?.hypothesisEntries || [],
    notebook: runState.publicState?.notebookEntries || [],
    deduction: runState.publicState?.lastDeduction || null,
    review: reviewResult || null,
    statistics: {
      locationsVisited: (runState.publicState?.visitedLocationIds || []).length,
      evidenceFound: (runState.publicState?.discoveredEvidenceIds || []).length,
      charactersInterviewed: (runState.publicState?.interviewedCharacterIds || []).length,
      contradictionsDetected: (runState.publicState?.contradictionIds || []).length,
      hintsUsed: runState.publicState?.hintUsage || 0,
    },
  };
}

function createExportEvidenceBoard(runState) {
  const discovered = runState.publicState?.discoveredEvidenceIds || [];
  return discovered.map((id) => ({ evidenceId: id }));
}

function createExportTestimonyBoard(runState) {
  const discovered = runState.publicState?.discoveredTestimonyIds || [];
  return discovered.map((id) => ({ testimonyId: id }));
}
