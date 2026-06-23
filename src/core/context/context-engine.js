import { deepFilterHiddenFields } from "../system/mode-isolation-policy.js";
import { routeContext } from "./context-router.js";
import { assembleContextBlocks } from "./context-assembler.js";
import { applyContextBudget } from "./context-budget.js";

export function createContextPacket(input = {}) {
  const route = routeContext(input);
  const raw = assembleContextBlocks(input);
  const filtered = deepFilterHiddenFields(raw);
  const budgeted = applyContextBudget(filtered, input.policy?.budget);
  return { ...route, blocks: budgeted.blocks, budget: budgeted.budget, hidden: { filteredSecrets: [], filteredSpoilers: [], reason: route.contextProfile === "mystery_safe" ? ["mystery_safe"] : [] }, debug: { selectedBy: { profile: route.contextProfile }, droppedByBudget: budgeted.droppedByBudget, droppedByPolicy: [] } };
}
