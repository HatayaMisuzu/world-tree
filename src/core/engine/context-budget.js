export const BUDGETS = {
  tiny: { sceneCount: 2, worldbookEntries: 4, worldbookTokens: 1800, worldbookChars: 1800, maxContextTokens: 6000, maxContextChars: 6000, budgetUnit: "estimated_tokens", knowledgeMode: "summary", historyTurns: 8 },
  balanced: { sceneCount: 5, worldbookEntries: 10, worldbookTokens: 4200, worldbookChars: 4200, maxContextTokens: 12000, maxContextChars: 12000, budgetUnit: "estimated_tokens", knowledgeMode: "rules", historyTurns: 20 },
  rich: { sceneCount: 8, worldbookEntries: 16, worldbookTokens: 7200, worldbookChars: 7200, maxContextTokens: 20000, maxContextChars: 20000, budgetUnit: "estimated_tokens", knowledgeMode: "full-card", historyTurns: 36 },
  emergency: { sceneCount: 1, worldbookEntries: 2, worldbookTokens: 900, worldbookChars: 900, maxContextTokens: 3000, maxContextChars: 3000, budgetUnit: "estimated_tokens", knowledgeMode: "names-only", historyTurns: 4 }
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

export function estimateContextTokens(value = "") {
  const text = String(value || "");
  if (!text) return 0;
  const cjkChars = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const asciiWords = (text.match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) || []).length;
  const punctuation = (text.match(/[^\sA-Za-z0-9_\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  return Math.max(1, Math.ceil(cjkChars + asciiWords * 1.3 + punctuation * 0.3));
}
