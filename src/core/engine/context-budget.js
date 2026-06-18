export const BUDGETS = {
  tiny: { sceneCount: 2, worldbookEntries: 4, worldbookChars: 1800, maxContextChars: 6000, knowledgeMode: "summary", historyTurns: 8 },
  balanced: { sceneCount: 5, worldbookEntries: 10, worldbookChars: 4200, maxContextChars: 12000, knowledgeMode: "rules", historyTurns: 20 },
  rich: { sceneCount: 8, worldbookEntries: 16, worldbookChars: 7200, maxContextChars: 20000, knowledgeMode: "full-card", historyTurns: 36 },
  emergency: { sceneCount: 1, worldbookEntries: 2, worldbookChars: 900, maxContextChars: 3000, knowledgeMode: "names-only", historyTurns: 4 }
};

export function budgetFor(value = "balanced") {
  return BUDGETS[value] || BUDGETS.balanced;
}

export function clipList(list = [], max = 10) {
  return list.slice(Math.max(0, list.length - max));
}

export function estimateContextChars(value = "") {
  return String(value || "").length;
}
