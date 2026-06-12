import { normalizeEngineState } from "./modules.js";

export function transition(engineState, status, extra = {}) {
  return normalizeEngineState({
    ...engineState,
    ...extra,
    status,
    updatedAt: new Date().toISOString()
  });
}

export function beginRun(engineState) {
  return transition(engineState, "running", { lastError: "" });
}

export function finishRun(engineState, parsedSections = {}) {
  return transition(engineState, "ready", { lastParsedSections: parsedSections });
}

export function blockRun(engineState, reason) {
  return transition(engineState, "blocked", { lastError: reason });
}

export function failRun(engineState, error) {
  return transition(engineState, "error", { lastError: error?.message || String(error) });
}
