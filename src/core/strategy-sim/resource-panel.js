export const STRATEGY_CHOICES = Object.freeze(["invest_military", "expand_trade", "fortify_defense", "diplomacy_focus"]);

const DEFAULTS = Object.freeze({
  food: { value: 50, max: 100, delta: 0, label: "粮草" },
  military: { value: 30, max: 100, delta: 0, label: "军力" },
  morale: { value: 70, max: 100, delta: 0, label: "民心" },
  diplomacy: { value: 50, max: 100, delta: 0, label: "外交" }
});

function clamp(value, max) { return Math.max(0, Math.min(max, Number(value) || 0)); }

export function createResourcePanel(input = {}) {
  return Object.fromEntries(Object.entries(DEFAULTS).map(([key, base]) => {
    const value = input[key] || {};
    const max = Math.max(1, Number(value.max || base.max));
    return [key, { ...base, ...value, max, value: clamp(value.value ?? base.value, max), delta: Number(value.delta || 0) }];
  }));
}
export function applyStrategyChoice(resources = {}, choice = "") {
  const next = createResourcePanel(resources);
  const changes = {
    invest_military: { food: -8, military: 12, morale: -2 },
    expand_trade: { food: 10, diplomacy: 8, military: -2 },
    fortify_defense: { food: -5, military: 7, morale: 4 },
    diplomacy_focus: { diplomacy: 12, morale: 3, military: -3 }
  }[choice];
  if (!changes) return { ok: false, resources: next, runtimeUpdate: null, error: "unknown strategy choice" };
  for (const [key, delta] of Object.entries(changes)) {
    const item = next[key];
    item.delta = delta;
    item.value = clamp(item.value + delta, item.max);
  }
  return { ok: true, resources: next, runtimeUpdate: { type: "strategy_resources", choice, resources: next, authority: "runtime", canonWrites: [] } };
}

export function buildStrategyResourceContext(resources = {}) {
  const safe = createResourcePanel(resources);
  return Object.entries(safe).map(([key, item]) => `${item.label}(${key}): ${item.value}/${item.max}${item.delta ? ` (${item.delta > 0 ? "+" : ""}${item.delta})` : ""}`).join("；");
}
