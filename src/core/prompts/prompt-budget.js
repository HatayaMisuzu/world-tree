// prompt-budget.js — Token budget management for prompt blocks
// Part of World Tree Prompt Orchestration Layer v1

/**
 * Budget configuration per generation type.
 * Values are maximum estimated token counts for prompt blocks.
 */
export const BUDGET_CONFIG = {
  normal: 2400,
  continue: 2000,
  regenerate: 1800,
  quiet: 800,
  internal: 1200
};

/**
 * Estimate token count from text. Conservative: ~1.3 chars per token for Chinese.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 1.3);
}

/**
 * Apply budget to a list of blocks.
 * required blocks are never removed.
 * Optional blocks are removed (lowest priority first) until within budget.
 *
 * @param {Array} blocks - sorted blocks (highest priority first)
 * @param {number} budget - max token budget
 * @returns {{kept: Array, omitted: Array, totalTokens: number, withinBudget: boolean}}
 */
export function applyBudget(blocks, budget) {
  if (!Array.isArray(blocks)) return { kept: [], omitted: [], totalTokens: 0, withinBudget: true };
  const required = [];
  const optional = [];
  for (const block of blocks) {
    if (block.required) required.push(block);
    else optional.push(block);
  }
  // Always keep required blocks
  let total = 0;
  for (const b of required) total += estimateTokens(b.content);
  const omitted = [];
  // Add optional blocks, highest priority first
  const sorted = [...optional].sort((a, b) => b.priority - a.priority);
  const kept = [...required];
  for (const block of sorted) {
    const t = estimateTokens(block.content);
    if (total + t <= budget) {
      kept.push(block);
      total += t;
    } else {
      omitted.push(block);
    }
  }
  // Re-sort kept by position then priority
  kept.sort((a, b) => {
    const pa = POSITION_ORDER[a.position] ?? 50;
    const pb = POSITION_ORDER[b.position] ?? 50;
    if (pa !== pb) return pa - pb;
    return b.priority - a.priority;
  });
  return { kept, omitted, totalTokens: total, withinBudget: omitted.length === 0 };
}

const POSITION_ORDER = {
  pre_context: 10,
  context: 20,
  post_history: 30,
  in_chat: 40,
  final_guard: 50
};

/**
 * Get budget for a generation type.
 */
export function getBudget(generationType = "normal") {
  return BUDGET_CONFIG[generationType] || BUDGET_CONFIG.normal;
}
