// Tabletop V2 Service
// Server-side service for tabletop runs: start, turn, save, branch, end.
// Local-first persistence under data/engine/tabletop-v2/.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAdventureModule, validateAdventureModule, validatePlayerIntentAgainstBook } from "../core/tabletop/tabletop-v2-adventure-module.js";
import { normalizeRulesetProfile } from "../core/tabletop/tabletop-v2-ruleset-profile.js";
import { createTabletopRun, createSaveSlot, restoreSaveSlot, forkBranchFromSave, recordTurn, validateRunState, stripHiddenState } from "../core/tabletop/tabletop-v2-save-branch.js";
import { createRulingRequest, resolveRulingWithoutLlm, buildGmNarrationPacket, buildDeterministicGmTurnText } from "../core/tabletop/tabletop-v2-turn-ruling.js";
import { detectEndingAvailable, buildEndingSummary } from "../core/tabletop/tabletop-v2-ending-summary.js";
import { assertRuntimeNamespaceIsolation } from "../core/mode/mode-asset-linkage-contract.js";

// ── Path guard ──

function assertTabletopV2RuntimePath(path) {
  if (!String(path).includes(`${sep}tabletop-v2${sep}`)) {
    throw new Error(`Tabletop V2 runtime path escaped namespace: ${path}`);
  }
}

// ── Paths ──

function moduleDir(dataRoot, moduleId) {
  return join(dataRoot, "engine", "tabletop-v2", "modules", moduleId);
}

function runsDir(dataRoot) {
  return join(dataRoot, "engine", "tabletop-v2", "runs");
}

function runDir(dataRoot, runId) {
  return join(runsDir(dataRoot), runId);
}

function savesDir(dataRoot, runId) {
  return join(runDir(dataRoot, runId), "saves");
}

function branchesDir(dataRoot, runId) {
  return join(runDir(dataRoot, runId), "branches");
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

export async function previewTabletopV2Import(body = {}, deps = {}) {
  try {
    const input = body.text || body.module || {};
    const module = normalizeAdventureModule(typeof input === "string" ? { title: "导入预览", playerBrief: { premise: input } } : input);

    return {
      status: "ok",
      preview: {
        title: module.title,
        sourceType: module.sourceType,
        rulesetProfileId: module.rulesetProfileId,
        playerBrief: {
          premise: module.playerBrief?.premise || "",
          objective: module.playerBrief?.objective || "",
          setting: module.playerBrief?.setting || "",
        },
        sceneCount: module.scenes.length,
        characterCount: module.characters.length,
        clockCount: module.clocks.length,
        hasHiddenGmBook: !!(module.gmBook?.hiddenTruth || module.gmBook?.gmScenes?.length),
        warnings: (!module.title || module.title === "未命名冒险") ? ["未提供标题"] : [],
      },
    };
  } catch (err) {
    return { status: "error", code: "PREVIEW_FAILED", errorMsg: err.message };
  }
}

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
    if (!existsSync(modulePath)) {
      return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: `module ${runState.moduleId} not found` };
    }
    const module = JSON.parse(readFileSync(modulePath, "utf-8"));

    // Create ruling request (classify first)
    const rulingRequest = createRulingRequest({
      module,
      runState,
      playerIntent,
      actor: runState.publicState?.playerCharacter,
    });

    if (rulingRequest.error) {
      return { status: "error", code: "RULING_REQUEST_FAILED", errorMsg: rulingRequest.error };
    }

    // Book validation (BEFORE dice/ruling)
    const bookCheck = validatePlayerIntentAgainstBook({
      module,
      scene: rulingRequest.scene,
      runState,
      intent: playerIntent,
      classification: rulingRequest.classification,
    });

    if (!bookCheck.allowed) {
      // Blocked by book — no dice roll, return explanation
      return {
        status: "blocked_by_book",
        code: bookCheck.severity === "warn" ? "ACTION_WARNED_BY_BOOK" : "ACTION_BLOCKED_BY_BOOK",
        bookCheck: {
          reason: bookCheck.reason,
          suggestion: bookCheck.suggestion,
          severity: bookCheck.severity,
          source: bookCheck.source,
        },
        run: stripHiddenState(runState),
      };
    }

    // Resolve ruling (deterministic, no LLM)
    const ruling = resolveRulingWithoutLlm(rulingRequest);

    // Build deterministic GM turn text
    const gmTurnText = buildDeterministicGmTurnText({
      request: rulingRequest,
      ruling,
      bookCheck,
      module,
      scene: rulingRequest.scene,
    });

    // Record turn
    const turnRecord = {
      roll: ruling.roll,
      publicStateUpdate: {
        lastNarrative: gmTurnText,
      },
      reviewCandidates: ruling.consequences.some((c) => c.type === "setback" || c.type === "bonus")
        ? [{ type: "major_choice", description: `${ruling.classification}: ${ruling.roll?.outcome || "no roll"}` }]
        : [],
    };

    runState = recordTurn(runState, turnRecord);

    // Check endings
    const endingCheck = detectEndingAvailable({ module, runState });

    // Persist updated state
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return {
      status: "ok",
      run: stripHiddenState(runState),
      narrative: gmTurnText,
      ruling: {
        classification: ruling.classification,
        consequences: ruling.consequences,
        roll: publicRollInfo(ruling.roll),
        noRoll: ruling.noRoll,
      },
      endingAvailable: endingCheck.available,
      endings: publicEndingInfo(endingCheck.endings || [], runState),
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
