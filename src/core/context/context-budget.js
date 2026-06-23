import { CONTEXT_BUDGETS } from "./context-policy.js";
export function applyContextBudget(blocks = {}, overrides = {}) {
  const budget = { ...CONTEXT_BUDGETS, ...overrides };
  const limits = { recentSceneSummaries: budget.maxSceneSummaries, trackingDigest: budget.maxTrackingItems, worldbookBase: budget.maxWorldbookEntries, worldbookContext: budget.maxWorldbookEntries, worldbookInstant: budget.maxWorldbookEntries, proximityEntities: budget.maxProximityEntities, emotionalInertia: budget.maxInertiaItems };
  const result = {}; const droppedByBudget = [];
  for (const [key, value] of Object.entries(blocks)) { const list = Array.isArray(value) ? value : value == null ? [] : [value]; const limit = limits[key] ?? budget.maxBlocks; result[key] = list.slice(0, limit); if (list.length > limit) droppedByBudget.push({ block: key, count: list.length - limit }); }
  return { blocks: result, budget, droppedByBudget };
}
