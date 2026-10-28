// Tabletop V2 Save/Branch System
// Manages run state, save slots, and branch forking.
// Hidden GM state is stored separately from public state.
// Ids/seeds are derived from stableId / hashSeed (dc-3); wall-clock fields are display-only.

import { createHash } from "node:crypto";
import { createModeRuntimeNamespace } from "../mode/mode-asset-linkage-contract.js";
import { hashSeed, stableId } from "../../shared/determinism.js";

// ── Run creation ──

export function createTabletopRun({ module, playerCharacter, seed, runKey } = {}) {
  const moduleId = module?.moduleId || null;
  const resolvedSeed = seed ?? hashSeed(moduleId || "tabletop", "run", runKey ?? 0);
  const runId = stableId("run", moduleId || "tabletop", resolvedSeed, runKey ?? 0);
  const branchId = stableId("branch", runId, "main");
  const now = new Date().toISOString();

  const startingScene = (module?.scenes || []).find((s) => s.isStarting) || module?.scenes?.[0] || null;

  return {
    runId,
    moduleId,
    branchId,
    parentBranchId: null,
    seed: resolvedSeed,
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

  const slotIndex = Array.isArray(runState.saveSlots) ? runState.saveSlots.length : 0;
  const saveId = stableId("save", runState.runId, runState.branchId || "", runState.turnIndex || 0, label || "", slotIndex);
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

  const branchId = stableId("branch", saveSlot.runId || "", saveSlot.saveId, branchLabel || "", saveSlot.turnIndex || 0);

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
