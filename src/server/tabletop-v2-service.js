// Tabletop V2 Service
// Server-side service for tabletop runs: start, turn, save, branch, end.
// Local-first persistence under data/engine/tabletop-v2/.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeAdventureModule, validateAdventureModule } from "../core/tabletop/tabletop-v2-adventure-module.js";
import { normalizeRulesetProfile } from "../core/tabletop/tabletop-v2-ruleset-profile.js";
import { createTabletopRun, createSaveSlot, restoreSaveSlot, forkBranchFromSave, recordTurn, validateRunState, stripHiddenState } from "../core/tabletop/tabletop-v2-save-branch.js";
import { createRulingRequest, resolveRulingWithoutLlm, buildGmNarrationPacket } from "../core/tabletop/tabletop-v2-turn-ruling.js";
import { detectEndingAvailable, buildEndingSummary } from "../core/tabletop/tabletop-v2-ending-summary.js";

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

    // Load module
    const mDir = moduleDir(dataRoot, runState.moduleId);
    const modulePath = join(mDir, "module.json");
    if (!existsSync(modulePath)) {
      return { status: "error", code: "MODULE_NOT_FOUND", errorMsg: `module ${runState.moduleId} not found` };
    }
    const module = JSON.parse(readFileSync(modulePath, "utf-8"));

    // Create ruling request
    const rulingRequest = createRulingRequest({
      module,
      runState,
      playerIntent,
      actor: runState.publicState?.playerCharacter,
    });

    if (rulingRequest.error) {
      return { status: "error", code: "RULING_REQUEST_FAILED", errorMsg: rulingRequest.error };
    }

    // Resolve ruling (deterministic, no LLM)
    const ruling = resolveRulingWithoutLlm(rulingRequest);

    // Build GM narration packet
    const narrationPacket = buildGmNarrationPacket(ruling);

    // Record turn
    const turnRecord = {
      roll: ruling.roll,
      publicStateUpdate: {
        lastNarrative: "", // filled by LLM later
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
      ruling: {
        classification: ruling.classification,
        consequences: ruling.consequences,
        roll: ruling.roll
          ? ruling.roll.visibility === "public"
            ? {
                expression: ruling.roll.expression,
                total: ruling.roll.total,
                outcome: ruling.roll.outcome,
                probabilityEstimate: ruling.roll.probabilityEstimate,
              }
            : { expression: "???", total: null, outcome: "???", visibility: "hidden" }
          : null,
        noRoll: ruling.noRoll,
      },
      narrationPacket,
      endingAvailable: endingCheck.available,
      endings: endingCheck.endings?.filter((e) => e.source !== "clock" || e.source === "book"),
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
