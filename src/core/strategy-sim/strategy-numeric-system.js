// src/core/strategy-sim/strategy-numeric-system.js — v2 numeric substrate
// Bounded numeric changes only. No canon writes. No archetype assumptions.

export function clampStrategicValue(value, min = 0, max = 100) {
  const v = Number(value);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function normalizeRange(input, min, max) {
  if (!Array.isArray(input) || input.length < 2) return [min, max];
  const a = clampStrategicValue(input[0], min, max);
  const b = clampStrategicValue(input[1], min, max);
  return [Math.min(a, b), Math.max(a, b)];
}

export function classifyStrategicRange(variable = {}) {
  const min = Number(variable.min ?? 0);
  const max = Number(variable.max ?? 100);
  const value = clampStrategicValue(variable.currentValue ?? variable.value ?? 0, min, max);
  const safeRange = normalizeRange(variable.safeRange, min, max);
  const warningRange = normalizeRange(variable.warningRange, min, max);
  const collapseRange = normalizeRange(variable.collapseRange, min, min);

  if (collapseRange[0] !== collapseRange[1] && value >= collapseRange[0] && value <= collapseRange[1]) return "collapse";
  if (warningRange[0] !== min || warningRange[1] !== max) {
    if (value >= warningRange[0] && value <= warningRange[1]) return "warning";
  }
  if (value >= safeRange[0] && value <= safeRange[1]) return "safe";
  return "unstable";
}

export function applyStrategicDelta(variable, delta, options = {}) {
  if (!variable) return { value: 0, warning: "null variable" };

  const maxDelta = options?.maxDelta ?? variable.maxDeltaPerTurn ?? variable.maxDelta ?? 25;
  const softMin = options?.softMin ?? variable.softMin ?? 0;
  const softMax = options?.softMax ?? variable.softMax ?? (variable.max ?? 100);
  const hardMin = variable.min ?? 0;
  const hardMax = variable.max ?? 100;
  const current = Number(variable.currentValue ?? variable.value ?? 0);

  let effectiveDelta = Number(delta);
  if (Number.isNaN(effectiveDelta)) effectiveDelta = 0;
  if (Math.abs(effectiveDelta) > Math.abs(maxDelta)) {
    effectiveDelta = Math.sign(effectiveDelta) * Math.abs(maxDelta);
  }

  let newValue = current + effectiveDelta;

  if (newValue > softMax && softMax < hardMax) {
    const excess = newValue - softMax;
    newValue = softMax + excess * 0.3;
  }
  if (newValue < softMin && softMin > hardMin) {
    const deficit = softMin - newValue;
    newValue = softMin - deficit * 0.3;
  }

  newValue = clampStrategicValue(newValue, hardMin, hardMax);

  const warnings = [];
  if (Math.abs(effectiveDelta) >= Math.abs(maxDelta) && Math.abs(delta) > Math.abs(maxDelta)) warnings.push("delta_capped");

  const safeRange = variable.safeRange || [hardMin, hardMax];
  const warningRange = variable.warningRange || [hardMin, hardMax];
  const collapseRange = variable.collapseRange || [hardMin, hardMin];

  if (newValue < safeRange[0] || newValue > safeRange[1]) warnings.push("outside_safe_range");
  if (newValue >= warningRange[0] && newValue <= warningRange[1] && (warningRange[0] !== hardMin || warningRange[1] !== hardMax)) warnings.push("inside_warning_range");
  if (newValue >= collapseRange[0] && newValue <= collapseRange[1] && collapseRange[0] !== collapseRange[1]) warnings.push("inside_collapse_range");

  return {
    value: newValue,
    originalDelta: delta,
    effectiveDelta,
    warning: warnings[0] || null,
    warnings,
    softCapped: newValue !== current + delta,
    rangeState: classifyStrategicRange({ ...variable, currentValue: newValue })
  };
}

export function normalizeStrategicVariable(input = {}) {
  const min = Number(input?.min ?? 0);
  const max = Number(input?.max ?? 100);
  const value = clampStrategicValue(input?.currentValue ?? input?.value ?? input?.initial ?? 50, min, max);

  return Object.freeze({
    id: String(input?.id || `var_${Date.now()}`),
    label: String(input?.label || "variable"),
    kind: ["stock", "flow", "pressure", "risk", "leverage", "capacity", "legitimacy", "knowledge", "relationship", "clock", "territory", "rule", "morale", "finance", "quality"].includes(input?.kind) ? input.kind : "stock",
    role: String(input?.role || "general"),
    scope: ["actor", "region", "system", "global"].includes(input?.scope) ? input.scope : "actor",
    currentValue: value,
    min,
    max,
    softMin: Number(input?.softMin ?? min),
    softMax: Number(input?.softMax ?? max),
    safeRange: normalizeRange(input?.safeRange, min, max),
    warningRange: normalizeRange(input?.warningRange, min, max),
    collapseRange: normalizeRange(input?.collapseRange, min, min),
    maxDeltaPerTurn: Number(input?.maxDeltaPerTurn ?? input?.maxDelta ?? 25),
    recoveryActions: Array.isArray(input?.recoveryActions) ? [...input.recoveryActions] : [],
    direction: ["higher_is_better", "lower_is_better", "target_range", "contextual"].includes(input?.direction) ? input.direction : "higher_is_better",
    visibility: ["player_visible", "public", "partial", "hidden", "secret"].includes(input?.visibility) ? input.visibility : "player_visible",
    volatility: Number(input?.volatility ?? 0),
    decay: Number(input?.decay ?? input?.naturalDrift ?? 0),
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
    const rangeState = classifyStrategicRange(v);
    if (rangeState === "collapse") warnings.push(`${v.id || "?"}: inside collapse range`);
    if (v.volatility > 0 && history.length > 0) {
      const prev = history[history.length - 1]?.find(h => h?.id === v.id);
      if (prev) {
        const prevVal = prev.currentValue ?? prev.value ?? 0;
        const change = Math.abs(val - prevVal);
        if (change > (v.maxDeltaPerTurn ?? v.maxDelta ?? 25)) warnings.push(`${v.id || "?"}: large swing ${prevVal}→${val} (${change})`);
      }
    }
  }
  return { drift: warnings.length > 0, warnings };
}

// Fixed fallback panel default — not the V2 runtime rule source.
export function createDefaultDisplayStats() {
  return Object.freeze([
    { id: "material", label: "物资", value: 50, max: 100, role: "stock", direction: "higher_is_better" },
    { id: "stability", label: "稳定", value: 50, max: 100, role: "stability", direction: "higher_is_better" },
    { id: "capacity", label: "产能", value: 50, max: 100, role: "capacity", direction: "higher_is_better" },
    { id: "relation", label: "关系", value: 50, max: 100, role: "relationship", direction: "higher_is_better" },
    { id: "risk", label: "风险", value: 30, max: 100, role: "risk", direction: "lower_is_better" },
  ]);
}
