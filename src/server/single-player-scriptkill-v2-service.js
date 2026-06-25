// Single Player ScriptKill V2 Service
// Service for existing “单人剧本杀” entry V2. Not a new product entry.
// Local-first persistence under engine/single-player-scriptkill-v2/.

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { buildSinglePlayerScriptKillImportPreview, commitSinglePlayerScriptKillImport } from "../core/single-player-scriptkill/single-player-scriptkill-importer.js";
import { validateSinglePlayerScriptKillPackage } from "../core/single-player-scriptkill/single-player-scriptkill-package.js";
import { createSinglePlayerScriptKillRun, stripSinglePlayerScriptKillRunForPlayer, validateSinglePlayerScriptKillRunState } from "../core/single-player-scriptkill/single-player-scriptkill-runtime-state.js";
import { readCurrentRoleAct, performPublicTalk, performPrivateChat, performSearch, performRevealClue, performVote, performDebrief, advanceSinglePlayerScriptKillPhase } from "../core/single-player-scriptkill/single-player-scriptkill-solo-runtime.js";

function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }
function readJson(path, fallback = null) { try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return fallback; } }
function writeJson(path, data) { ensureDir(path.split(sep).slice(0, -1).join(sep)); writeFileSync(path, JSON.stringify(data, null, 2)); }

function assertScriptKillV2Path(path) {
  if (!String(path).includes(`${sep}single-player-scriptkill-v2${sep}`)) throw new Error(`Single Player ScriptKill V2 path escaped namespace: ${path}`);
}

function rootDir(dataRoot) { return join(dataRoot, "engine", "single-player-scriptkill-v2"); }
function packagesDir(dataRoot) { return join(rootDir(dataRoot), "packages"); }
function runsDir(dataRoot) { return join(rootDir(dataRoot), "runs"); }
function packageDir(dataRoot, scriptId) { return join(packagesDir(dataRoot), scriptId); }
function runDir(dataRoot, runId) { return join(runsDir(dataRoot), runId); }
function packagePath(dataRoot, scriptId) { return join(packageDir(dataRoot, scriptId), "package.json"); }
function runPath(dataRoot, runId) { return join(runDir(dataRoot, runId), "run-state.json"); }

export async function previewSinglePlayerScriptKillV2Import(body = {}, deps = {}) {
  try {
    const preview = buildSinglePlayerScriptKillImportPreview(body);
    return preview;
  } catch (err) {
    return { status: "error", code: "SINGLE_PLAYER_SCRIPTKILL_IMPORT_PREVIEW_FAILED", errorMsg: err.message };
  }
}

export async function commitSinglePlayerScriptKillV2Import(body = {}, deps = {}) {
  try {
    const dataRoot = deps.dataRoot;
    if (!dataRoot) throw new Error("dataRoot required");
    const result = commitSinglePlayerScriptKillImport(body);
    if (result.status !== "ok") return result;
    const pkg = result.package;
    const dir = packageDir(dataRoot, pkg.scriptId);
    assertScriptKillV2Path(dir);
    ensureDir(dir);
    writeJson(packagePath(dataRoot, pkg.scriptId), pkg);
    return { status: "ok", scriptId: pkg.scriptId, package: pkg, validation: result.validation };
  } catch (err) {
    return { status: "error", code: "SINGLE_PLAYER_SCRIPTKILL_IMPORT_COMMIT_FAILED", errorMsg: err.message };
  }
}

export async function startSinglePlayerScriptKillV2(body = {}, deps = {}) {
  try {
    const dataRoot = deps.dataRoot;
    const scriptId = body.scriptId;
    if (!dataRoot || !scriptId) return { status: "error", code: "MISSING_PARAMS" };
    const pkg = readJson(packagePath(dataRoot, scriptId));
    if (!pkg) return { status: "error", code: "PACKAGE_NOT_FOUND" };
    const validation = validateSinglePlayerScriptKillPackage(pkg);
    if (!validation.playable && body.forceStart !== true) return { status: "not_playable", validation, errorMsg: "剧本结构不完整，不能完整开局。" };
    const run = createSinglePlayerScriptKillRun(pkg, { realPlayerRoleId: body.realPlayerRoleId, runId: body.runId });
    const runValidation = validateSinglePlayerScriptKillRunState(run);
    if (!runValidation.ok) return { status: "error", code: "RUN_INVALID", validation: runValidation };
    const dir = runDir(dataRoot, run.runId);
    assertScriptKillV2Path(dir);
    ensureDir(dir);
    writeJson(runPath(dataRoot, run.runId), run);
    return { status: "ok", runId: run.runId, scriptId, playerRun: stripSinglePlayerScriptKillRunForPlayer(pkg, run) };
  } catch (err) {
    return { status: "error", code: "SINGLE_PLAYER_SCRIPTKILL_START_FAILED", errorMsg: err.message };
  }
}

export async function readSinglePlayerScriptKillV2RoleAct(body = {}, deps = {}) {
  return withRun(body, deps, (pkg, run) => readCurrentRoleAct(pkg, run, body.roleId));
}
export async function publicTalkSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => performPublicTalk({ packageData: pkg, runState: run, realPlayerText: body.text || body.realPlayerText, simulatedRoleIds: body.simulatedRoleIds || [] }));
}
export async function privateChatSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => performPrivateChat({ packageData: pkg, runState: run, targetRoleId: body.targetRoleId, text: body.text }));
}
export async function searchSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => performSearch({ packageData: pkg, runState: run, locationId: body.locationId, clueId: body.clueId, keepPrivate: body.keepPrivate !== false }));
}
export async function revealClueSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => performRevealClue({ packageData: pkg, runState: run, clueId: body.clueId }));
}
export async function voteSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => performVote({ packageData: pkg, runState: run, targetRoleId: body.targetRoleId, reason: body.reason }));
}
export async function debriefSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRun(body, deps, (pkg, run) => performDebrief({ packageData: pkg, runState: run }));
}
export async function advancePhaseSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRunMutating(body, deps, (pkg, run) => advanceSinglePlayerScriptKillPhase({ packageData: pkg, runState: run, nextPhaseId: body.nextPhaseId, reason: body.reason || "manual" }));
}
export async function exportRunSinglePlayerScriptKillV2(body = {}, deps = {}) {
  return withRun(body, deps, (pkg, run) => ({ status: "ok", export: { package: { scriptId: pkg.scriptId, title: pkg.title }, playerRun: stripSinglePlayerScriptKillRunForPlayer(pkg, run), exportedAt: new Date().toISOString() } }));
}

export async function listSinglePlayerScriptKillV2Runs(body = {}, deps = {}) {
  const dataRoot = deps.dataRoot;
  const dir = runsDir(dataRoot);
  ensureDir(dir);
  return { status: "ok", runs: readdirSync(dir).map(runId => ({ runId, path: runPath(dataRoot, runId) })) };
}

export async function loadSinglePlayerScriptKillV2Run(body = {}, deps = {}) {
  return withRun(body, deps, (pkg, run) => ({ status: "ok", playerRun: stripSinglePlayerScriptKillRunForPlayer(pkg, run) }));
}

async function withRun(body, deps, fn) {
  try {
    const { pkg, run } = loadPackageAndRun(body, deps);
    return await fn(pkg, run);
  } catch (err) {
    return { status: "error", code: "SINGLE_PLAYER_SCRIPTKILL_RUN_OP_FAILED", errorMsg: err.message };
  }
}
async function withRunMutating(body, deps, fn) {
  try {
    const { pkg, run, runFile } = loadPackageAndRun(body, deps);
    const result = await fn(pkg, run);
    if (result.runState) writeJson(runFile, result.runState);
    return result;
  } catch (err) {
    return { status: "error", code: "SINGLE_PLAYER_SCRIPTKILL_RUN_MUTATION_FAILED", errorMsg: err.message };
  }
}
function loadPackageAndRun(body, deps) {
  const dataRoot = deps.dataRoot;
  const runId = body.runId;
  if (!dataRoot || !runId) throw new Error("dataRoot and runId required");
  const runFile = runPath(dataRoot, runId);
  assertScriptKillV2Path(runFile);
  const run = readJson(runFile);
  if (!run) throw new Error("run not found");
  const pkg = readJson(packagePath(dataRoot, run.scriptId));
  if (!pkg) throw new Error("package not found");
  return { pkg, run, runFile };
}
