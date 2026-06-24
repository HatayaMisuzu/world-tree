// src/core/strategy-sim/strategy-numeric-system.js — v2-ready numeric substrate
// Stage 4: clamp, soft cap, maxDelta, diminishing returns. NOT a full strategy game.

export function clampStrategicValue(value, min = 0, max = 100) {
  const v = Number(value);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function applyStrategicDelta(variable, delta, options = {}) {
  if (!variable) return { value: 0, warning: "null variable" };

  const maxDelta = options?.maxDelta ?? 25;
  const softMin = options?.softMin ?? variable.softMin ?? 0;
  const softMax = options?.softMax ?? variable.softMax ?? (variable.max ?? 100);
  const hardMin = variable.min ?? 0;
  const hardMax = variable.max ?? 100;
  const current = Number(variable.currentValue ?? variable.value ?? 0);

  // Clamp delta
  let effectiveDelta = Number(delta);
  if (Number.isNaN(effectiveDelta)) effectiveDelta = 0;
  if (Math.abs(effectiveDelta) > Math.abs(maxDelta)) {
    effectiveDelta = Math.sign(effectiveDelta) * Math.abs(maxDelta);
  }

  let newValue = current + effectiveDelta;

  // Soft cap: diminishing returns when approaching limits
  if (newValue > softMax && softMax < hardMax) {
    const excess = newValue - softMax;
    newValue = softMax + excess * 0.3; // 30% efficiency beyond soft cap
  }
  if (newValue < softMin && softMin > hardMin) {
    const deficit = softMin - newValue;
    newValue = softMin - deficit * 0.3;
  }

  // Hard clamp
  newValue = clampStrategicValue(newValue, hardMin, hardMax);

  const warning = Math.abs(effectiveDelta) >= Math.abs(maxDelta) ? "delta_capped" : null;

  return {
    value: newValue,
    originalDelta: delta,
    effectiveDelta,
    warning,
    softCapped: newValue !== current + delta,
  };
}

export function normalizeStrategicVariable(input = {}) {
  const min = Number(input?.min ?? 0);
  const max = Number(input?.max ?? 100);
  const value = clampStrategicValue(input?.currentValue ?? input?.value ?? 50, min, max);

  return Object.freeze({
    id: String(input?.id || `var_${Date.now()}`),
    label: String(input?.label || "variable"),
    kind: ["stock", "flow", "pressure", "risk", "leverage", "capacity", "legitimacy", "knowledge", "relationship", "clock", "territory", "rule"].includes(input?.kind) ? input.kind : "stock",
    role: String(input?.role || "general"),
    scope: ["actor", "region", "system", "global"].includes(input?.scope) ? input.scope : "actor",
    currentValue: value,
    min,
    max,
    softMin: Number(input?.softMin ?? min),
    softMax: Number(input?.softMax ?? max),
    direction: ["higher_is_better", "lower_is_better", "target_range", "contextual"].includes(input?.direction) ? input.direction : "higher_is_better",
    visibility: ["player_visible", "partial", "hidden"].includes(input?.visibility) ? input.visibility : "player_visible",
    volatility: Number(input?.volatility ?? 0),
    decay: Number(input?.decay ?? 0),
    growthLimit: Number(input?.growthLimit ?? max),
    thresholds: Array.isArray(input?.thresholds) ? [...input.thresholds] : [],
  });
}

export function detectNumericDrift(variables, history = []) {
  if (!Array.isArray(variables)) return { drift: false, warnings: [] };
  const warnings = [];
  for (const v of variables) {
    if (!v) continue;
    const val = v.currentValue ?? v.value ?? 0;
    const max = v.max ?? 100;
    const min = v.min ?? 0;
    if (val > max) warnings.push(`${v.id || "?"}: value ${val} exceeds max ${max}`);
    if (val < min) warnings.push(`${v.id || "?"}: value ${val} below min ${min}`);
    if (v.volatility > 0 && history.length > 0) {
      const prev = history[history.length - 1]?.find(h => h?.id === v.id);
      if (prev) {
        const prevVal = prev.currentValue ?? prev.value ?? 0;
        const change = Math.abs(val - prevVal);
        if (change > (v.maxDelta || 25)) warnings.push(`${v.id || "?"}: large swing ${prevVal}→${val} (${change})`);
      }
    }
  }
  return { drift: warnings.length > 0, warnings };
}

// Fixed panel default — NOT hardcoded resource names
export function createDefaultDisplayStats() {
  return Object.freeze([
    { id: "material", label: "物资", value: 50, max: 100, role: "stock", direction: "higher_is_better" },
    { id: "stability", label: "稳定", value: 50, max: 100, role: "stability", direction: "higher_is_better" },
    { id: "capacity", label: "产能", value: 50, max: 100, role: "capacity", direction: "higher_is_better" },
    { id: "relation", label: "关系", value: 50, max: 100, role: "relationship", direction: "higher_is_better" },
    { id: "risk", label: "风险", value: 30, max: 100, role: "risk", direction: "lower_is_better" },
  ]);
}
