// src/core/strategy-sim/strategy-v2-ready.js — v2-ready strategy slice
// Stage 4: display stats, variables, probability policy. NOT full 4X.
import { createDefaultDisplayStats } from "./strategy-numeric-system.js";

export function normalizeStrategyV2Ready(input = {}) {
  return Object.freeze({
    controlledEntityId: String(input?.controlledEntityId || ""),
    displayStats: Array.isArray(input?.displayStats) ? [...input.displayStats] : createDefaultDisplayStats(),
    strategicVariables: Array.isArray(input?.strategicVariables) ? [...input.strategicVariables] : [],
    probabilityEvents: Array.isArray(input?.probabilityEvents) ? [...input.probabilityEvents] : [],
    numericState: input?.numericState !== undefined ? { ...input.numericState } : { bounded: true, softCapped: true },
    probabilityPolicy: String(input?.probabilityPolicy || "hint"),
  });
}
