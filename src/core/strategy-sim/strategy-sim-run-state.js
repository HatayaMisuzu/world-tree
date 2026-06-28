// src/core/strategy-sim/strategy-sim-run-state.js
// Strategy Sim V2 — runtime state.
// Spec is immutable. Run state is mutable through turn engine only.

import { assertSealedStrategySimSpec } from "./strategy-sim-spec.js";

function nowIso(input) {
  return input || new Date().toISOString();
}

function initialValueMap(items = []) {
  return Object.fromEntries(items.map((item) => [
    item.id,
    {
      id: item.id,
      label: item.label,
      value: item.initial,
      min: item.min,
      max: item.max,
      maxDeltaPerTurn: item.maxDeltaPerTurn,
      safeRange: item.safeRange,
      warningRange: item.warningRange,
      collapseRange: item.collapseRange,
      visibility: item.visibility,
      updatedAt: null
    }
  ]));
}

export function createStrategyRunState(spec, options = {}) {
  assertSealedStrategySimSpec(spec);
  const createdAt = nowIso(options.createdAt);

  return {
    schemaVersion: 2,
    mode: "strategy-sim",
    runId: String(options.runId || `strategy_run_${Date.now()}`),
    specId: spec.specId,
    specHash: spec.sealMetadata.specHash,
    currentTurn: Number(options.currentTurn ?? 0),
    phase: String(options.phase || "ready"),
    turnUnit: spec.turnUnit,
    actionBudget: Number(options.actionBudget ?? 1),
    rngState: {
      seed: String(options.rngSeed || spec.balanceProfile?.rngSeed || spec.specId),
      counter: Number(options.rngCounter ?? 0)
    },
    resources: initialValueMap(spec.resources),
    variables: initialValueMap(spec.variables),
    hiddenState: {},
    secretState: {},
    activeProjects: [],
    activeEvents: [],
    cooldowns: {},
    turnLog: [],
    createdAt,
    updatedAt: createdAt
  };
}

export function assertRunStateMatchesSpec(state, spec) {
  assertSealedStrategySimSpec(spec);
  if (!state || state.mode !== "strategy-sim") throw new Error("StrategyRunState is required");
  if (state.specId !== spec.specId) throw new Error(`runState specId mismatch: ${state.specId} !== ${spec.specId}`);
  if (state.specHash !== spec.sealMetadata.specHash) throw new Error("runState specHash mismatch");
  return state;
}

export function appendStrategyTurnLog(state, logEntry, options = {}) {
  if (!state || !Array.isArray(state.turnLog)) throw new Error("invalid StrategyRunState");
  const entry = Object.freeze({
    ...logEntry,
    turn: Number(logEntry.turn ?? state.currentTurn),
    createdAt: nowIso(options.createdAt)
  });
  state.turnLog.push(entry);
  state.updatedAt = entry.createdAt;
  return entry;
}

export function advanceStrategyTurn(state, options = {}) {
  if (!state) throw new Error("StrategyRunState is required");
  state.currentTurn = Number(state.currentTurn || 0) + 1;
  state.phase = String(options.phase || "complete");
  state.updatedAt = nowIso(options.updatedAt);
  return state;
}

export function cloneStrategyRunState(state) {
  return JSON.parse(JSON.stringify(state));
}
