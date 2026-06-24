// src/core/strategy-sim/strategy-probability-system.js — v2-ready probability substrate
// Stage 4: probability events with visibility policies, NOT full stochastic engine.

const VISIBILITY_POLICIES = Object.freeze(["exact", "range", "hint", "hidden"]);

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
    outcomeTable: Array.isArray(input?.outcomeTable) ? [...input.outcomeTable] : [],
    riskLevel: ["low", "medium", "high", "critical"].includes(input?.riskLevel) ? input.riskLevel : "medium",
  });
}

export function rollProbabilityEvent(event, rng = Math.random) {
  if (!event) return { rolled: false, error: "null event" };

  let chance = event.baseChance;

  // Apply visible modifiers
  for (const mod of (event.modifiers || [])) {
    if (typeof mod?.value === "number") chance += mod.value;
  }

  // Apply hidden modifiers (server-side only)
  for (const mod of (event.hiddenModifiers || [])) {
    if (typeof mod?.value === "number") chance += mod.value;
  }

  // Clamp
  chance = Math.max(event.minChance, Math.min(event.maxChance, chance));

  const roll = rng();
  const success = roll <= chance;

  return Object.freeze({
    rolled: true,
    success,
    roll: Math.round(roll * 100) / 100,
    effectiveChance: Math.round(chance * 100) / 100,
    wasModified: chance !== event.baseChance,
  });
}

export function getPlayerVisibleProbability(event, policy = "hint") {
  if (!event) return { visible: false, reason: "null event" };

  const vis = policy || event.visibility || "hint";
  const chance = event.baseChance;

  switch (vis) {
    case "exact":
      return { visible: true, display: `${Math.round(chance * 100)}%`, style: "exact" };
    case "range": {
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
      return { visible: false, display: "??", style: "hidden", reason: "hidden by policy" };
    default:
      return { visible: false, reason: "unknown visibility" };
  }
}

export { VISIBILITY_POLICIES };
