// src/core/strategy-sim/strategy-probability-system.js — v2 probability substrate
// Real probability only. LLM may describe results, never invent rolls.

export const VISIBILITY_POLICIES = Object.freeze(["exact", "range", "hint", "hidden", "public", "partial", "secret"]);

function clampChance(value, min = 0, max = 1) {
  const n = Number(value);
  const v = Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, v));
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function hashSeed(seed) {
  const text = String(seed || "strategy-sim-v2");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRngState(seed = "strategy-sim-v2", counter = 0) {
  return Object.freeze({
    seed: String(seed || "strategy-sim-v2"),
    counter: Math.max(0, Number(counter) || 0)
  });
}

export function nextSeededRandom(rngState = createSeededRngState()) {
  const state = createSeededRngState(rngState.seed, rngState.counter);
  const numericSeed = hashSeed(`${state.seed}:${state.counter}`);
  const value = mulberry32(numericSeed)();
  return Object.freeze({ value, rngState: createSeededRngState(state.seed, state.counter + 1) });
}

export function normalizeProbabilityEvent(input = {}) {
  const base = Number(input?.baseChance ?? 0.5);
  const minC = Math.max(0, Math.min(1, Number(input?.minChance ?? 0)));
  const maxC = Math.max(minC, Math.min(1, Number(input?.maxChance ?? 1)));

  return Object.freeze({
    id: String(input?.id || `prob_${Date.now()}`),
    label: String(input?.label || "event"),
    baseChance: Math.max(minC, Math.min(maxC, base)),
    modifiers: Array.isArray(input?.modifiers) ? [...input.modifiers] : [],
    minChance: minC,
    maxChance: maxC,
    hiddenModifiers: Array.isArray(input?.hiddenModifiers) ? [...input.hiddenModifiers] : [],
    visibility: VISIBILITY_POLICIES.includes(input?.visibility) ? input.visibility : "hint",
    publicDisclosure: input?.publicDisclosure ? { ...input.publicDisclosure } : {},
    outcomeTable: Array.isArray(input?.outcomeTable) ? [...input.outcomeTable] : [],
    riskLevel: ["low", "medium", "high", "critical"].includes(input?.riskLevel) ? input.riskLevel : "medium",
    triggerTags: Array.isArray(input?.triggerTags) ? [...input.triggerTags] : []
  });
}

export function calculateEffectiveChance(event) {
  if (!event) return { ok: false, error: "null event", finalChance: 0, modifiers: [] };

  const appliedModifiers = [];
  let chance = Number(event.baseChance ?? 0);

  for (const mod of (event.modifiers || [])) {
    const delta = typeof mod?.value === "number" ? mod.value : Number(mod?.delta ?? 0);
    if (!Number.isFinite(delta)) continue;
    chance += delta;
    appliedModifiers.push({ source: String(mod.source || mod.id || "modifier"), delta, visibility: "public" });
  }

  for (const mod of (event.hiddenModifiers || [])) {
    const delta = typeof mod?.value === "number" ? mod.value : Number(mod?.delta ?? 0);
    if (!Number.isFinite(delta)) continue;
    chance += delta;
    appliedModifiers.push({ source: String(mod.source || mod.id || "hidden_modifier"), delta, visibility: "hidden" });
  }

  const finalChance = clampChance(chance, event.minChance ?? 0, event.maxChance ?? 1);
  return Object.freeze({
    ok: true,
    baseChance: event.baseChance,
    finalChance,
    modifiers: Object.freeze(appliedModifiers),
    wasModified: finalChance !== event.baseChance
  });
}

export function createProbabilityRollRecord(event, rollResult, meta = {}) {
  return Object.freeze({
    turn: Number(meta.turn ?? 0),
    checkId: String(meta.checkId || event?.id || "probability_check"),
    type: "probability_check",
    baseChance: rollResult.baseChance,
    modifiers: rollResult.modifiers || [],
    finalChance: rollResult.finalChance,
    rngSeed: String(meta.rngSeed || rollResult.rngStateBefore?.seed || ""),
    rngCounter: Number(meta.rngCounter ?? rollResult.rngStateBefore?.counter ?? 0),
    roll: rollResult.rawRoll,
    result: rollResult.success ? "success" : "failure",
    visibility: event?.visibility || "hint",
    publicDisclosure: event?.publicDisclosure || {},
    createdAt: meta.createdAt || new Date().toISOString()
  });
}

export function rollProbabilityEvent(event, rng = Math.random, meta = {}) {
  if (!event) return { rolled: false, error: "null event" };

  const calculated = calculateEffectiveChance(event);
  if (!calculated.ok) return { rolled: false, error: calculated.error };

  let rawRoll;
  let nextRngState = null;
  let rngStateBefore = null;

  if (typeof rng === "function") {
    rawRoll = rng();
  } else {
    rngStateBefore = createSeededRngState(rng?.seed, rng?.counter);
    const next = nextSeededRandom(rngStateBefore);
    rawRoll = next.value;
    nextRngState = next.rngState;
  }

  rawRoll = clampChance(rawRoll, 0, 1);
  const success = rawRoll <= calculated.finalChance;

  const baseResult = Object.freeze({
    rolled: true,
    success,
    roll: round2(rawRoll),
    rawRoll,
    effectiveChance: round2(calculated.finalChance),
    finalChance: calculated.finalChance,
    baseChance: calculated.baseChance,
    modifiers: calculated.modifiers,
    wasModified: calculated.wasModified,
    rngStateBefore,
    rngState: nextRngState
  });

  const rollRecord = createProbabilityRollRecord(event, baseResult, {
    ...meta,
    rngSeed: meta.rngSeed ?? rngStateBefore?.seed,
    rngCounter: meta.rngCounter ?? rngStateBefore?.counter
  });

  return Object.freeze({ ...baseResult, rollRecord });
}

export function getPlayerVisibleProbability(event, policy = "hint") {
  if (!event) return { visible: false, reason: "null event" };

  const vis = policy || event.visibility || "hint";
  const chance = event.baseChance;

  switch (vis) {
    case "exact":
    case "public":
      return { visible: true, display: `${Math.round(chance * 100)}%`, style: "exact" };
    case "range":
    case "partial": {
      const low = Math.max(0, Math.round((chance - 0.15) * 100));
      const high = Math.min(100, Math.round((chance + 0.15) * 100));
      return { visible: true, display: `大约 ${low}-${high}%`, style: "range" };
    }
    case "hint": {
      if (chance >= 0.8) return { visible: true, display: "成功率较高", style: "hint" };
      if (chance >= 0.5) return { visible: true, display: "有一定把握", style: "hint" };
      if (chance >= 0.2) return { visible: true, display: "风险很高", style: "hint" };
      return { visible: true, display: "机会渺茫", style: "hint" };
    }
    case "hidden":
    case "secret":
      return { visible: false, display: "??", style: vis, reason: "hidden by policy" };
    default:
      return { visible: false, reason: "unknown visibility" };
  }
}
