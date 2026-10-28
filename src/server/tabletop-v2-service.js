// Tabletop V2 Service
// Server-side service for tabletop runs: start, turn, save, branch, end.
// Local-first persistence under data/engine/tabletop-v2/.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAdventureModule, validateAdventureModule, validatePlayerIntentAgainstBook } from "../core/tabletop/tabletop-v2-adventure-module.js";
import { normalizeRulesetProfile } from "../core/tabletop/tabletop-v2-ruleset-profile.js";
import { createTabletopRun, createSaveSlot, restoreSaveSlot, forkBranchFromSave, recordTurn, validateRunState, stripHiddenState } from "../core/tabletop/tabletop-v2-save-branch.js";
import { createRulingRequest, resolveRulingWithoutLlm, buildGmNarrationPacket, buildDeterministicGmTurnText } from "../core/tabletop/tabletop-v2-turn-ruling.js";
import { detectEndingAvailable, buildEndingSummary } from "../core/tabletop/tabletop-v2-ending-summary.js";
import { assertRuntimeNamespaceIsolation } from "../core/mode/mode-asset-linkage-contract.js";
import { executeTabletopGmLoop } from "../core/tabletop/tabletop-v2-gm-loop.js";
import { createTabletopV2PolishClient } from "../core/tabletop/tabletop-v2-llm-polish.js";
import { assertTabletopV2RuntimePath, moduleDir, runsDir, runDir, savesDir, branchesDir, ensureDir } from "./tabletop-v2-paths.js";
export { previewTabletopV2Import, commitTabletopV2Import } from "./tabletop-v2-import-service.js";

// ── LLM polish client ──

async function createTabletopV2PolishClientFromDeps(deps = {}) {
  if (!deps.config || !deps.apiKey) return null;
  try {
    const { callLLMByRole } = await import("../adapters/llm.js");
    return createTabletopV2PolishClient({ callLLMByRole, config: deps.config, apiKey: deps.apiKey });
  } catch {
    return null;
  }
}

// ── Start run ──

export async function startTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const module = normalizeAdventureModule(body.module || {});
    const validation = validateAdventureModule(module);
    if (!validation.valid) {
      return { status: "error", code: "INVALID_MODULE", errorMsg: validation.errors.join("; ") };
    }

    const ruleset = body.rulesetProfileId
      ? normalizeRulesetProfile({ kind: body.rulesetProfileId })
      : normalizeRulesetProfile({ kind: module.rulesetProfileId || "d20_fantasy" });

    module.ruleset = ruleset;
    module.rulesetProfileId = ruleset.rulesetId;

    // Persist module
    const mDir = moduleDir(dataRoot, module.moduleId);
    ensureDir(mDir);
    writeFileSync(join(mDir, "module.json"), JSON.stringify(module, null, 2));

    // Create run
    const runState = createTabletopRun({
      module,
      playerCharacter: body.playerCharacter || null,
      seed: body.seed || Date.now(),
    });

    // Persist run
    const rDir = runDir(dataRoot, runState.runId);
    ensureDir(rDir);
    writeFileSync(join(rDir, "run-state.json"), JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      run: stripHiddenState(runState),
      moduleId: module.moduleId,
      rulesetKind: ruleset.kind,
    };
  } catch (err) {
    return { status: "error", code: "START_FAILED", errorMsg: err.message };
  }
}

// ── Import preview ──

// ── Process turn ──

export async function handleTabletopV2Turn(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, playerIntent } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };
    if (!playerIntent || typeof playerIntent !== "string" || playerIntent.trim().length === 0) {
      return { status: "error", code: "NO_INTENT", errorMsg: "playerIntent is required" };
    }

    // Load run
    const rDir = runDir(dataRoot, runId);
    const statePath = join(rDir, "run-state.json");
    assertTabletopV2RuntimePath(statePath);  // path guard
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    // Runtime isolation check
    if (runState.runtimeIsolation?.modeId !== "tabletop") {
      return { status: "error", code: "RUNTIME_ISOLATION_VIOLATION", errorMsg: "run state is not a Tabletop V2 runtime" };
    }

    // Load module
    const mDir = moduleDir(dataRoot, runState.moduleId);
    const modulePath = join(mDir, "module.json");
    assertTabletopV2RuntimePath(modulePath);
    if (!existsSync(modulePath)) {
      return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: `module ${runState.moduleId} not found` };
    }
    const module = JSON.parse(readFileSync(modulePath, "utf-8"));
    const llmClient = await createTabletopV2PolishClientFromDeps(deps);

    // Use the full GM loop
    const loopResult = await executeTabletopGmLoop({
      module,
      runState,
      playerIntent,
      llmClient,
    });

    // Handle blocked/warned/error statuses from the loop
    if (loopResult.status === "blocked" || loopResult.status === "blocked_by_book") {
      return {
        status: loopResult.status,
        code: loopResult.code || "ACTION_BLOCKED",
        bookCheck: loopResult.bookCheck,
        narrative: loopResult.playerNarrative,
        run: loopResult.runState,
      };
    }

    if (loopResult.status === "warned") {
      return {
        status: "ok",
        code: "ACTION_WARNED_INLINE",
        bookCheck: loopResult.bookCheck,
        narrative: loopResult.playerNarrative || loopResult.narrative,
        run: loopResult.runState,
      };
    }

    if (loopResult.status === "error") {
      return {
        status: "error",
        code: loopResult.code || "GM_LOOP_ERROR",
        errorMsg: loopResult.error?.message || loopResult.playerNarrative || "GM loop error",
        run: loopResult.runState,
      };
    }

    // Check endings
    const endingCheck = detectEndingAvailable({ module, runState: loopResult.fullState });

    // Persist full state (includes hidden GM state)
    writeFileSync(statePath, JSON.stringify(loopResult.fullState, null, 2));

    return {
      status: "ok",
      run: loopResult.runState,
      narrative: loopResult.narrative,
      ruling: loopResult.ruling,
      endingAvailable: endingCheck.available,
      endings: publicEndingInfo(endingCheck.endings || [], loopResult.fullState),
      sceneTitle: loopResult.sceneTitle,
      publicClocks: loopResult.publicClocks,
      loopLog: (loopResult.loopLog || []).slice(-3),  // last 3 steps for transparency
    };
  } catch (err) {
    return { status: "error", code: "TURN_FAILED", errorMsg: err.message };
  }
}

// ── Save ──

export async function saveTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, label } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    const runState = JSON.parse(readFileSync(statePath, "utf-8"));
    const saveSlot = createSaveSlot(runState, label);

    // Persist save
    const sDir = savesDir(dataRoot, runId);
    ensureDir(sDir);
    writeFileSync(join(sDir, `${saveSlot.saveId}.json`), JSON.stringify(saveSlot, null, 2));

    // Update run with save slot reference
    runState.saveSlots = [...(runState.saveSlots || []), saveSlot.saveId];
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      saveId: saveSlot.saveId,
      label: saveSlot.label,
      turnIndex: saveSlot.turnIndex,
    };
  } catch (err) {
    return { status: "error", code: "SAVE_FAILED", errorMsg: err.message };
  }
}

// ── Branch ──

export async function branchTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, saveId, branchLabel } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };
    if (!saveId) return { status: "error", code: "NO_SAVE_ID", errorMsg: "saveId is required" };

    const savePath = join(savesDir(dataRoot, runId), `${saveId}.json`);
    if (!existsSync(savePath)) {
      return { status: "error", code: "SAVE_NOT_FOUND", errorMsg: `save ${saveId} not found` };
    }

    const saveSlot = JSON.parse(readFileSync(savePath, "utf-8"));
    const branch = forkBranchFromSave(saveSlot, branchLabel);

    // Persist branch
    const bDir = branchesDir(dataRoot, runId);
    ensureDir(bDir);
    writeFileSync(join(bDir, `${branch.branchId}.json`), JSON.stringify(branch, null, 2));

    // Update run
    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    const runState = JSON.parse(readFileSync(statePath, "utf-8"));
    runState.branches = [...(runState.branches || []), branch];
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      branchId: branch.branchId,
      label: branch.label,
      parentBranchId: branch.parentBranchId,
    };
  } catch (err) {
    return { status: "error", code: "BRANCH_FAILED", errorMsg: err.message };
  }
}

// ── End summary ──

export async function endTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, endingId } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    const runState = JSON.parse(readFileSync(statePath, "utf-8"));
    const modulePath = join(moduleDir(dataRoot, runState.moduleId), "module.json");
    const module = existsSync(modulePath) ? JSON.parse(readFileSync(modulePath, "utf-8")) : null;

    const summary = buildEndingSummary({ module, runState, endingId });

    // Mark run as ended and persist
    runState.endingState = { endedAt: new Date().toISOString(), endingId, summary };
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      summary: stripHiddenState(summary),
    };
  } catch (err) {
    return { status: "error", code: "END_FAILED", errorMsg: err.message };
  }
}

// ── Public response helpers ──

function publicRollInfo(roll) {
  if (!roll) return null;
  if (roll.visibility === "hidden") {
    return { expression: "暗骰", total: null, outcome: "暗骰已记录", visibility: "hidden" };
  }
  return {
    expression: roll.expression,
    total: roll.total,
    outcome: roll.outcome,
    probabilityEstimate: roll.probabilityEstimate,
    visibility: "public",
  };
}

function publicEndingInfo(endings = [], runState) {
  if (!Array.isArray(endings)) return [];
  return endings.filter((e) => {
    // Book and scene endings are always public
    if (e.source === "book" || e.source === "scene") return true;
    // Clock endings: only if the clock is public
    if (e.source === "clock") {
      const clock = (runState?.publicState?.clocks || []).find((c) => c.id === e.endingId?.replace("clock_", ""));
      return clock?.visibility === "public";
    }
    return false;
  });
}

// ── List runs ──

export async function listTabletopV2Runs(deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const rDir = runsDir(dataRoot);
    if (!existsSync(rDir)) return { status: "ok", runs: [], total: 0 };

    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(rDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const statePath = join(rDir, e.name, "run-state.json");
        if (!existsSync(statePath)) return null;
        try {
          const state = JSON.parse(readFileSync(statePath, "utf-8"));
          return {
            runId: state.runId || e.name,
            moduleId: state.moduleId,
            title: state.publicState?.sceneTitle || "",
            turnIndex: state.turnIndex || 0,
            createdAt: state.createdAt,
            updatedAt: state.updatedAt,
            ended: !!state.endingState,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return { status: "ok", runs: entries, total: entries.length };
  } catch (err) {
    return { status: "error", code: "LIST_RUNS_FAILED", errorMsg: err.message };
  }
}

// ── Load run ──

export async function loadTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    const runState = JSON.parse(readFileSync(statePath, "utf-8"));

    // Load module for additional context
    const modulePath = join(moduleDir(dataRoot, runState.moduleId), "module.json");
    const module = existsSync(modulePath) ? JSON.parse(readFileSync(modulePath, "utf-8")) : null;

    return {
      status: "ok",
      run: stripHiddenState(runState),
      module: module ? {
        moduleId: module.moduleId,
        title: module.title,
        rulesetProfileId: module.rulesetProfileId,
        sceneCount: module.scenes?.length || 0,
      } : null,
      saveSlots: runState.saveSlots || [],
      branches: (runState.branches || []).map((b) => ({
        branchId: b.branchId,
        label: b.label,
        status: b.status,
      })),
    };
  } catch (err) {
    return { status: "error", code: "LOAD_RUN_FAILED", errorMsg: err.message };
  }
}

// ── Restore save ──

export async function restoreTabletopV2Save(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, saveId } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };
    if (!saveId) return { status: "error", code: "NO_SAVE_ID", errorMsg: "saveId is required" };

    const savePath = join(savesDir(dataRoot, runId), `${saveId}.json`);
    if (!existsSync(savePath)) {
      return { status: "error", code: "SAVE_NOT_FOUND", errorMsg: `save ${saveId} not found` };
    }

    const saveSlot = JSON.parse(readFileSync(savePath, "utf-8"));
    const restored = restoreSaveSlot(saveSlot);

    // Load current run state to preserve moduleId/branchId etc.
    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    const currentState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf-8")) : null;

    const updatedState = {
      ...currentState,
      ...restored,
      runId,
      moduleId: currentState?.moduleId,
      branchId: currentState?.branchId || `branch_restored_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(statePath, JSON.stringify(updatedState, null, 2));

    return {
      status: "ok",
      run: stripHiddenState(updatedState),
      restoredFromSaveId: saveId,
      restoredTurnIndex: saveSlot.turnIndex,
    };
  } catch (err) {
    return { status: "error", code: "RESTORE_SAVE_FAILED", errorMsg: err.message };
  }
}

// ── Switch branch ──

export async function switchTabletopV2Branch(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId, branchId } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };
    if (!branchId) return { status: "error", code: "NO_BRANCH_ID", errorMsg: "branchId is required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    const runState = JSON.parse(readFileSync(statePath, "utf-8"));
    const branch = (runState.branches || []).find((b) => b.branchId === branchId);
    if (!branch) {
      return { status: "error", code: "BRANCH_NOT_FOUND", errorMsg: `branch ${branchId} not found` };
    }

    // Restore the branch's forked game state so the run actually continues from
    // the branch's divergence point instead of keeping the old lineage state.
    // Degrades gracefully (label-only switch) if the branch/save file is missing or corrupt.
    const branchFilePath = join(branchesDir(dataRoot, runId), `${branchId}.json`);
    let forkStateRestored = false;
    try {
      if (existsSync(branchFilePath)) {
        const branchRecord = JSON.parse(readFileSync(branchFilePath, "utf-8"));
        const forkedSaveId = branchRecord.forkedFromSaveId;
        if (forkedSaveId) {
          const forkedSavePath = join(savesDir(dataRoot, runId), `${forkedSaveId}.json`);
          if (existsSync(forkedSavePath)) {
            const forkedSave = JSON.parse(readFileSync(forkedSavePath, "utf-8"));
            const restored = restoreSaveSlot(forkedSave);
            Object.assign(runState, restored);
            forkStateRestored = true;
          }
        }
      }
    } catch (err) {
      console.warn(`[tabletop-v2] branch ${branchId} forked state not restored: ${err?.message || err}`);
    }

    // Update run state to reflect active branch switch
    runState.activeBranchId = branchId;
    runState.branchSwitchHistory = [
      ...(runState.branchSwitchHistory || []),
      { from: runState.branchId, to: branchId, at: new Date().toISOString() },
    ];
    runState.branchId = branchId;
    runState.updatedAt = new Date().toISOString();

    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      activeBranchId: branchId,
      branchLabel: branch.label,
      forkStateRestored,
      run: stripHiddenState(runState),
    };
  } catch (err) {
    return { status: "error", code: "SWITCH_BRANCH_FAILED", errorMsg: err.message };
  }
}

// ── Export run ──

export async function exportTabletopV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot is required" };

  try {
    const { runId } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId is required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) {
      return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    }

    const runState = JSON.parse(readFileSync(statePath, "utf-8"));
    const modulePath = join(moduleDir(dataRoot, runState.moduleId), "module.json");
    const module = existsSync(modulePath) ? JSON.parse(readFileSync(modulePath, "utf-8")) : null;

    // Build public-facing export (no hiddenGmState)
    const exportData = {
      exportedAt: new Date().toISOString(),
      runId: runState.runId,
      moduleId: runState.moduleId,
      moduleTitle: module?.title || "",
      branchId: runState.branchId,
      turnIndex: runState.turnIndex,
      createdAt: runState.createdAt,
      updatedAt: runState.updatedAt,
      publicState: runState.publicState,
      rollHistory: runState.rollHistory || [],
      endingState: runState.endingState || null,
      branches: (runState.branches || []).map((b) => ({
        branchId: b.branchId,
        label: b.label,
        status: b.status,
        divergenceTurnIndex: b.divergenceTurnIndex,
      })),
      saveSlots: (runState.saveSlots || []),
      sceneHistory: runState.sceneHistory || [],
    };

    // Also write export to file for persistence
    const exportPath = join(runDir(dataRoot, runId), `export-${Date.now()}.json`);
    writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    return { status: "ok", export: exportData, exportPath };
  } catch (err) {
    return { status: "error", code: "EXPORT_FAILED", errorMsg: err.message };
  }
}
