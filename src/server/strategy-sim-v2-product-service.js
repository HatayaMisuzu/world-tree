import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { appendJsonl, ensureDir, readJsonSync, writeJson } from "./fs-utils.js";
import { normalizeStrategySimSpec, sealStrategySimSpec, validateStrategySimSpec } from "../core/strategy-sim/strategy-sim-spec.js";
import { createStrategyRunState } from "../core/strategy-sim/strategy-sim-run-state.js";
import { runStrategySimTurn } from "../core/strategy-sim/strategy-sim-turn-engine.js";
import { assertNoHiddenStrategyLeak, scrubStrategyPublicView } from "../core/strategy-sim/strategy-sim-public-view-scrubber.js";

export function safeStrategyRunId(input) {
  const raw = String(input || "").trim();
  if (!raw || raw === "." || raw === "..") return "";
  if (raw.includes("..")) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}$/.test(raw)) return "";
  return raw;
}

function productPublicView(spec, state) {
  const view = scrubStrategyPublicView(spec, state);
  const { omitted, ...safeView } = view;
  return safeView;
}

export function createStrategySimV2ProductService({ dataRoot } = {}) {
  const root = () => typeof dataRoot === "function" ? dataRoot() : dataRoot;
  const runsRoot = () => join(root(), "engine", "runs", "strategy-sim-v2");
  const invalidRunId = () => ({ status: "error", code: "INVALID_RUN_ID", errorMsg: "strategy runId is invalid." });
  const runDir = (runId) => join(runsRoot(), runId);

  async function validateSpec(body = {}) {
    const spec = normalizeStrategySimSpec(body.spec || body);
    const validation = validateStrategySimSpec(spec);
    return { status: validation.ok ? "ok" : "error", spec, validation };
  }

  async function sealSpec(body = {}) {
    const validation = await validateSpec(body);
    if (validation.status !== "ok") return { status: "error", code: "STRATEGY_SPEC_INVALID", validation: validation.validation };
    return { status: "ok", spec: sealStrategySimSpec(validation.spec, { sealedBy: "strategy-sim-v2-product-service" }) };
  }

  async function startRun(body = {}) {
    const sealed = body.sealedSpec || sealStrategySimSpec(normalizeStrategySimSpec(body.spec || {}), { sealedBy: "strategy-sim-v2-product-service" });
    const requestedRunId = body.runId === undefined || body.runId === null ? `strategy-run-${Date.now()}` : body.runId;
    const runId = safeStrategyRunId(requestedRunId);
    if (!runId) return invalidRunId();
    const state = createStrategyRunState(sealed, { runId, rngSeed: body.rngSeed || sealed.balanceProfile?.rngSeed });
    const dir = runDir(runId);
    ensureDir(dir);
    await writeJson(join(dir, "spec.json"), sealed);
    await writeJson(join(dir, "state.json"), state);
    const publicView = productPublicView(sealed, state);
    assertNoHiddenStrategyLeak(publicView, "strategy-start.publicView");
    return { status: "ok", runId, state, publicView };
  }

  async function turn(body = {}) {
    const runId = safeStrategyRunId(body.runId);
    if (!runId) return invalidRunId();
    const dir = runDir(runId);
    if (!existsSync(dir)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: "策略模拟存档不存在。" };
    const spec = readJsonSync(join(dir, "spec.json"), null);
    const state = readJsonSync(join(dir, "state.json"), null);
    const result = runStrategySimTurn({ spec, state, playerAction: body.action || body.playerAction || body.decision || "" });
    await writeJson(join(dir, "state.json"), result.state);
    await appendJsonl(join(dir, "turns.jsonl"), result.turnLog);
    for (const roll of result.turnLog.probabilityRolls || []) await appendJsonl(join(dir, "rolls.jsonl"), roll);
    const publicView = productPublicView(spec, result.state);
    assertNoHiddenStrategyLeak(publicView, "strategy-turn.publicView");
    return { status: "ok", runId, turn: result.turn, publicView, publicDelta: result.turnLog.publicDelta };
  }

  async function saveRun(body = {}) {
    const runId = safeStrategyRunId(body.runId);
    if (!runId) return invalidRunId();
    const dir = runDir(runId);
    if (!existsSync(dir)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: "策略模拟存档不存在。" };
    const state = body.state || readJsonSync(join(dir, "state.json"), {});
    await writeJson(join(dir, "state.json"), { ...state, updatedAt: new Date().toISOString() });
    return { status: "ok", runId };
  }

  async function loadRun(body = {}) {
    const runId = safeStrategyRunId(body.runId);
    if (!runId) return invalidRunId();
    const dir = runDir(runId);
    if (!existsSync(dir)) return { status: "error", code: "RUN_NOT_FOUND", errorMsg: "策略模拟存档不存在。" };
    const spec = readJsonSync(join(dir, "spec.json"), null);
    const state = readJsonSync(join(dir, "state.json"), null);
    const publicView = productPublicView(spec, state);
    assertNoHiddenStrategyLeak(publicView, "strategy-load.publicView");
    return { status: "ok", runId, state, publicView };
  }

  async function listRuns() {
    ensureDir(runsRoot());
    const items = await readdir(runsRoot(), { withFileTypes: true });
    return { status: "ok", runs: items.filter((item) => item.isDirectory()).map((item) => ({ runId: item.name })) };
  }

  async function exportRun(body = {}) {
    const runId = safeStrategyRunId(body.runId);
    if (!runId) return invalidRunId();
    const loaded = await loadRun(body);
    if (loaded.status !== "ok") return loaded;
    return {
      status: "ok",
      runId,
      export: {
        schema: "strategy-sim-v2-product-export",
        publicView: loaded.publicView,
        stateSummary: {
          runId: loaded.state.runId,
          specId: loaded.state.specId,
          currentTurn: loaded.state.currentTurn,
          phase: loaded.state.phase
        }
      }
    };
  }

  return { validateSpec, sealSpec, startRun, turn, saveRun, loadRun, listRuns, exportRun };
}

export async function handleStrategySimV2ProductRoute({ path, method, readBody, jsonResponse, deps }) {
  const service = createStrategySimV2ProductService(deps);
  if (path === "/api/strategy-sim-v2/spec/validate" && method === "POST") return jsonResponse(await service.validateSpec(await readBody()));
  if (path === "/api/strategy-sim-v2/spec/seal" && method === "POST") return jsonResponse(await service.sealSpec(await readBody()));
  if (path === "/api/strategy-sim-v2/start" && method === "POST") return jsonResponse(await service.startRun(await readBody()));
  if (path === "/api/strategy-sim-v2/turn" && method === "POST") return jsonResponse(await service.turn(await readBody()));
  if (path === "/api/strategy-sim-v2/save" && method === "POST") return jsonResponse(await service.saveRun(await readBody()));
  if (path === "/api/strategy-sim-v2/load-run" && method === "POST") return jsonResponse(await service.loadRun(await readBody()));
  if (path === "/api/strategy-sim-v2/runs" && method === "GET") return jsonResponse(await service.listRuns());
  if (path === "/api/strategy-sim-v2/export-run" && method === "POST") return jsonResponse(await service.exportRun(await readBody()));
  return false;
}
