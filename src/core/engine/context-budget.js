export const BUDGETS = {
  tiny: { sceneCount: 2, worldbookEntries: 4, knowledgeMode: "summary", historyTurns: 8 },
  balanced: { sceneCount: 5, worldbookEntries: 10, knowledgeMode: "rules", historyTurns: 20 },
  rich: { sceneCount: 8, worldbookEntries: 16, knowledgeMode: "full-card", historyTurns: 36 },
  emergency: { sceneCount: 1, worldbookEntries: 2, knowledgeMode: "names-only", historyTurns: 4 }
};

export function budgetFor(value = "balanced") {
  return BUDGETS[value] || BUDGETS.balanced;
}

export function clipList(list = [], max = 10) {
  return list.slice(Math.max(0, list.length - max));
}
