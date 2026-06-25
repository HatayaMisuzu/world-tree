// Detective V2 Service
// Server-side service: import, start, investigate, interrogate, notebook, deduction.
// Local-first persistence under engine/detective-v2/. Isolated from tabletop/character runtime.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { normalizeDetectiveCaseCapsule, validateDetectiveCaseCapsule, extractDetectivePlayerCaseView } from "../core/detective/detective-case-capsule.js";
import { classifyDetectiveCaseInput, parseDetectiveCaseJson, createDetectiveCaseDraftFromExternalText, validateExternalDetectiveCaseCompleteness, buildDetectiveImportPreview } from "../core/detective/detective-case-importer.js";
import { createDetectiveRunState, stripDetectiveRunForPlayer, recordDetectiveDiscovery, recordDetectiveInterview, recordDetectiveNotebookChange, recordDetectiveDeduction, validateDetectiveRunState } from "../core/detective/detective-run-state.js";
import { investigateDetectiveLocation, interrogateDetectiveCharacter, extractDetectiveNotebookEntry, updateDetectiveNotebook, submitDetectiveDeduction } from "../core/detective/detective-runtime-engine.js";
import { assertDetectiveRuntimeIsolation } from "../core/detective/detective-asset-links.js";

// ── Paths ──

function casesDir(dataRoot) { return join(dataRoot, "engine", "detective-v2", "cases"); }
function runsDir(dataRoot) { return join(dataRoot, "engine", "detective-v2", "runs"); }
function caseDir(dataRoot, caseId) { return join(casesDir(dataRoot), caseId); }
function runDir(dataRoot, runId) { return join(runsDir(dataRoot), runId); }
function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function assertDetectiveV2Path(path) {
  if (!String(path).includes(`${sep}detective-v2${sep}`)) throw new Error(`Detective V2 path escaped namespace: ${path}`);
}

// ── Import preview ──

export async function previewDetectiveV2Import(body = {}, deps = {}) {
  try {
    const preview = buildDetectiveImportPreview(body, { sourceKind: body.sourceKind || "paste", fileName: body.fileName });
    return { status: preview.status, inputType: preview.inputType, preview: preview.preview, playerCaseView: preview.playerCaseView, sections: preview.sections };
  } catch (err) {
    return { status: "error", code: "PREVIEW_FAILED", errorMsg: err.message };
  }
}

// ── Import commit ──

export async function commitDetectiveV2Import(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const text = body.text || "";
    let caseCapsule;

    // Try JSON first
    const jsonResult = parseDetectiveCaseJson(body);
    if (jsonResult.status === "ok") {
      caseCapsule = jsonResult.caseCapsule;
    } else {
      // Build from text
      caseCapsule = createDetectiveCaseDraftFromExternalText(text, body);
      const completeness = validateExternalDetectiveCaseCompleteness(caseCapsule);
      if (!completeness.playable) return { status: "needs_completion", missing: completeness.missing };
    }

    const validation = validateDetectiveCaseCapsule(caseCapsule);
    if (!validation.valid) return { status: "error", code: "INVALID_CASE", errorMsg: validation.errors.join("; ") };

    const isoCheck = assertDetectiveRuntimeIsolation(caseCapsule.runtimeIsolation || {});
    if (!isoCheck.ok) return { status: "error", code: "ISOLATION_VIOLATION", errorMsg: isoCheck.errors.join("; ") };

    // Persist
    const cDir = caseDir(dataRoot, caseCapsule.caseId);
    ensureDir(cDir);
    writeFileSync(join(cDir, "case.json"), JSON.stringify(caseCapsule, null, 2));
    writeFileSync(join(cDir, "source-metadata.json"), JSON.stringify(caseCapsule._extra?.externalImport || {}, null, 2));

    return { status: "ok", caseId: caseCapsule.caseId, case: extractDetectivePlayerCaseView(caseCapsule) };
  } catch (err) {
    return { status: "error", code: "COMMIT_FAILED", errorMsg: err.message };
  }
}

// ── Start run ──

export async function startDetectiveV2Run(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    let caseCapsule;
    if (body.caseId) {
      const cPath = join(caseDir(dataRoot, body.caseId), "case.json");
      if (!existsSync(cPath)) return { status: "error", code: "CASE_NOT_FOUND", errorMsg: `case ${body.caseId} not found` };
      caseCapsule = JSON.parse(readFileSync(cPath, "utf-8"));
    } else if (body.caseCapsule) {
      caseCapsule = normalizeDetectiveCaseCapsule(body.caseCapsule);
      const validation = validateDetectiveCaseCapsule(caseCapsule);
      if (!validation.valid) return { status: "error", code: "INVALID_CASE", errorMsg: validation.errors.join("; ") };
    } else {
      return { status: "error", code: "NO_CASE", errorMsg: "caseId or caseCapsule required" };
    }

    const runState = createDetectiveRunState({ caseCapsule, playerProfile: body.playerProfile });
    const rDir = runDir(dataRoot, runState.runId);
    ensureDir(rDir);
    writeFileSync(join(rDir, "run-state.json"), JSON.stringify(runState, null, 2));

    return { status: "ok", run: stripDetectiveRunForPlayer(runState), case: extractDetectivePlayerCaseView(caseCapsule) };
  } catch (err) {
    return { status: "error", code: "START_FAILED", errorMsg: err.message };
  }
}

// ── Investigate ──

export async function investigateDetectiveV2(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const { runId, locationId, target } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId required" };
    if (!locationId) return { status: "error", code: "NO_LOCATION", errorMsg: "locationId required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    const casePath = join(caseDir(dataRoot, runState.caseId), "case.json");
    if (!existsSync(casePath)) return { status: "error", code: "CASE_NOT_FOUND", errorMsg: "case not found" };
    const caseCapsule = JSON.parse(readFileSync(casePath, "utf-8"));

    const result = investigateDetectiveLocation({ caseCapsule, runState, locationId, target });
    if (result.status !== "ok") return result;

    runState = recordDetectiveDiscovery(runState, { locationId, newEvidenceIds: result.newEvidenceIds });
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return { ...result, run: stripDetectiveRunForPlayer(runState) };
  } catch (err) {
    return { status: "error", code: "INVESTIGATE_FAILED", errorMsg: err.message };
  }
}

// ── Interrogate ──

export async function interrogateDetectiveV2(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const { runId, characterId, question, presentedEvidenceIds } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId required" };
    if (!characterId) return { status: "error", code: "NO_CHARACTER", errorMsg: "characterId required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    const casePath = join(caseDir(dataRoot, runState.caseId), "case.json");
    if (!existsSync(casePath)) return { status: "error", code: "CASE_NOT_FOUND", errorMsg: "case not found" };
    const caseCapsule = JSON.parse(readFileSync(casePath, "utf-8"));

    const result = interrogateDetectiveCharacter({ caseCapsule, runState, characterId, question, presentedEvidenceIds });
    if (result.status !== "ok") return result;

    runState = recordDetectiveInterview(runState, { characterId, newTestimonyIds: result.newTestimonyIds });
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return { ...result, run: stripDetectiveRunForPlayer(runState) };
  } catch (err) {
    return { status: "error", code: "INTERROGATE_FAILED", errorMsg: err.message };
  }
}

// ── Notebook extract ──

export async function extractDetectiveV2Notebook(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const { runId, selection, options } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    const result = extractDetectiveNotebookEntry({ runState, selection, options });
    if (result.status !== "ok") return result;

    runState = recordDetectiveNotebookChange(runState, { notebook: result.notebook });
    writeFileSync(statePath, JSON.stringify(runState, null, 2));
    writeFileSync(join(runDir(dataRoot, runId), "notebook.json"), JSON.stringify(result.notebook, null, 2));

    return { ...result, run: stripDetectiveRunForPlayer(runState) };
  } catch (err) {
    return { status: "error", code: "NOTEBOOK_EXTRACT_FAILED", errorMsg: err.message };
  }
}

// ── Notebook update ──

export async function updateDetectiveV2Notebook(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const { runId, entryId, patch } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId required" };
    if (!entryId) return { status: "error", code: "NO_ENTRY_ID", errorMsg: "entryId required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    const result = updateDetectiveNotebook({ runState, entryId, patch });
    if (result.status !== "ok") return result;

    runState = recordDetectiveNotebookChange(runState, { notebook: result.notebook });
    writeFileSync(statePath, JSON.stringify(runState, null, 2));
    writeFileSync(join(runDir(dataRoot, runId), "notebook.json"), JSON.stringify(result.notebook, null, 2));

    return { ...result, run: stripDetectiveRunForPlayer(runState) };
  } catch (err) {
    return { status: "error", code: "NOTEBOOK_UPDATE_FAILED", errorMsg: err.message };
  }
}

// ── Deduction submit ──

export async function submitDetectiveV2Deduction(body = {}, deps = {}) {
  const { dataRoot } = deps;
  if (!dataRoot) return { status: "error", code: "NO_DATA_ROOT", errorMsg: "dataRoot required" };

  try {
    const { runId, report } = body;
    if (!runId) return { status: "error", code: "NO_RUN_ID", errorMsg: "runId required" };
    if (!report) return { status: "error", code: "NO_REPORT", errorMsg: "report required" };

    const statePath = join(runDir(dataRoot, runId), "run-state.json");
    if (!existsSync(statePath)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: `run ${runId} not found` };
    let runState = JSON.parse(readFileSync(statePath, "utf-8"));

    const casePath = join(caseDir(dataRoot, runState.caseId), "case.json");
    if (!existsSync(casePath)) return { status: "error", code: "CASE_NOT_FOUND", errorMsg: "case not found" };
    const caseCapsule = JSON.parse(readFileSync(casePath, "utf-8"));

    const result = submitDetectiveDeduction({ caseCapsule, runState, report });
    if (result.status !== "ok") return result;

    runState = recordDetectiveDeduction(runState, { ...result, ended: body.endRun !== false });
    writeFileSync(statePath, JSON.stringify(runState, null, 2));

    return { ...result, run: stripDetectiveRunForPlayer(runState) };
  } catch (err) {
    return { status: "error", code: "DEDUCTION_FAILED", errorMsg: err.message };
  }
}
