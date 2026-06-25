// Tabletop V2 Save/Branch System
// Manages run state, save slots, and branch forking.
// Hidden GM state is stored separately from public state.

import { createHash } from "node:crypto";
import { createModeRuntimeNamespace } from "../mode/mode-asset-linkage-contract.js";

// ── Run creation ──

export function createTabletopRun({ module, playerCharacter, seed } = {}) {
  const now = new Date().toISOString();
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const startingScene = (module?.scenes || []).find((s) => s.isStarting) || module?.scenes?.[0] || null;

  return {
    runId,
    moduleId: module?.moduleId || null,
    branchId: `branch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    parentBranchId: null,
    seed: seed || Date.now(),
    createdAt: now,
    updatedAt: now,
    currentSceneId: startingScene?.sceneId || null,
    turnIndex: 0,
    // public state
    publicState: {
      sceneTitle: startingScene?.title || "",
      lastNarrative: startingScene?.description || "",
      clocks: (module?.clocks || []).filter((c) => c.visibility !== "hidden").map((c) => ({ ...c })),
      resources: {},
      playerCharacter: playerCharacter ? { name: playerCharacter.name, role: playerCharacter.role, stats: playerCharacter.stats || {} } : null,
    },
    // hidden GM state (never sent to player)
    hiddenGmState: {
      clocks: (module?.clocks || []).filter((c) => c.visibility === "hidden").map((c) => ({ ...c })),
      secretProgress: {},
      gmNotes: "",
      revealedSecrets: [],
    },
    rollHistory: [],
    saveSlots: [],
    branches: [],
    reviewCandidates: [],
    endingState: null,
    runtimeIsolation: {
      schemaVersion: "world-tree.mode.runtime-isolation.1",
      modeId: "tabletop",
      runtimeNamespace: createModeRuntimeNamespace({ modeId: "tabletop", moduleId: module?.moduleId, runId }),
      cacheNamespace: createModeRuntimeNamespace({ modeId: "tabletop", moduleId: module?.moduleId, runId }) + ":cache",
      saveNamespace: createModeRuntimeNamespace({ modeId: "tabletop", moduleId: module?.moduleId, runId }) + ":save",
      branchNamespace: createModeRuntimeNamespace({ modeId: "tabletop", moduleId: module?.moduleId, runId }) + ":branch",
      llmNamespace: createModeRuntimeNamespace({ modeId: "tabletop", moduleId: module?.moduleId, runId }) + ":llm",
      hiddenStatePolicy: "mode_private",
    },
  };
}

// ── Create save slot ──

export function createSaveSlot(runState, label = "") {
  if (!runState?.runId) throw new Error("runState must have a runId");

  const saveId = `save_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const slot = {
    saveId,
    runId: runState.runId,
    branchId: runState.branchId,
    label: label || `存档 ${runState.turnIndex || 0}`,
    createdAt: now,
    turnIndex: runState.turnIndex,
    publicSnapshot: structuredClone(runState.publicState),
    hiddenSnapshot: structuredClone(runState.hiddenGmState),
    rollHistorySnapshot: structuredClone(runState.rollHistory || []),
    checksum: checksumForState(runState.publicState),
  };

  return slot;
}

// ── Restore save slot ──

export function restoreSaveSlot(saveSlot) {
  if (!saveSlot?.saveId) throw new Error("invalid save slot");

  return {
    currentSceneId: null, // caller must set based on restored scene title
    turnIndex: saveSlot.turnIndex,
    publicState: structuredClone(saveSlot.publicSnapshot),
    hiddenGmState: structuredClone(saveSlot.hiddenSnapshot),
    rollHistory: structuredClone(saveSlot.rollHistorySnapshot || []),
    restoredFromSaveId: saveSlot.saveId,
    restoredFromLabel: saveSlot.label,
  };
}

// ── Fork branch from save ──

export function forkBranchFromSave(saveSlot, branchLabel = "") {
  if (!saveSlot?.saveId) throw new Error("save slot required for branch");

  const branchId = `branch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    branchId,
    parentBranchId: saveSlot.branchId,
    forkedFromSaveId: saveSlot.saveId,
    label: branchLabel || `分支 ${saveSlot.label || ""}`,
    createdAt: new Date().toISOString(),
    divergenceTurnIndex: saveSlot.turnIndex || 0,
    status: "active",
  };
}

// ── Record turn ──

export function recordTurn(runState, turnRecord) {
  if (!runState) throw new Error("runState is required");

  const updated = {
    ...runState,
    turnIndex: (runState.turnIndex || 0) + 1,
    updatedAt: new Date().toISOString(),
    rollHistory: [
      ...(runState.rollHistory || []),
      ...(turnRecord.roll ? [{
        turnIndex: runState.turnIndex + 1,
        roll: turnRecord.roll,
        timestamp: new Date().toISOString(),
      }] : []),
    ],
  };

  // Update public state
  if (turnRecord.publicStateUpdate) {
    updated.publicState = { ...runState.publicState, ...turnRecord.publicStateUpdate };
  }

  // Update hidden GM state
  if (turnRecord.hiddenGmStateUpdate) {
    updated.hiddenGmState = { ...runState.hiddenGmState, ...turnRecord.hiddenGmStateUpdate };
  }

  // Append review candidates
  if (turnRecord.reviewCandidates?.length) {
    updated.reviewCandidates = [...(runState.reviewCandidates || []), ...turnRecord.reviewCandidates];
  }

  return updated;
}

// ── Validate run state ──

export function validateRunState(runState) {
  const errors = [];
  if (!runState) errors.push("runState is required");
  else {
    if (!runState.runId) errors.push("runId is required");
    if (!runState.moduleId) errors.push("moduleId is required");
    if (!runState.branchId) errors.push("branchId is required");
    if (!Number.isInteger(runState.turnIndex) || runState.turnIndex < 0) errors.push("turnIndex must be a non-negative integer");
    if (!runState.publicState) errors.push("publicState is required");
    if (!runState.hiddenGmState) errors.push("hiddenGmState is required");
    if (!Array.isArray(runState.rollHistory)) errors.push("rollHistory must be an array");
    if (!Array.isArray(runState.saveSlots)) errors.push("saveSlots must be an array");
  }
  return { valid: errors.length === 0, errors };
}

// ── Strip hidden state for player output ──

export function stripHiddenState(runState) {
  if (!runState) return null;
  const { hiddenGmState, ...safe } = runState;
  return safe;
}

// ── Checksum helper ──

function checksumForState(state) {
  const data = JSON.stringify(state || {});
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}
