// prompt-contract.js — Unified Prompt Block data model and contract types
// Part of World Tree Prompt Orchestration Layer v1

/**
 * @typedef {Object} PromptBlock
 * @property {string} id - unique block identifier (e.g. "mode.murder_mystery.truth_lock")
 * @property {string} title - human-readable title
 * @property {string} layer - "global" | "mode" | "task" | "kernel" | "worldbook" | "character" | "final_guard"
 * @property {string[]} modeIds - applicable modes (empty = all)
 * @property {string[]} taskIds - applicable tasks (empty = all)
 * @property {Object} trigger - activation condition
 * @property {string} role - "system" | "user" | "assistant"
 * @property {string} position - "pre_context" | "context" | "post_history" | "final_guard" | "in_chat"
 * @property {number} priority - higher = closer to generation point
 * @property {number} order - within same priority, lower = earlier
 * @property {number} budgetWeight - estimated token weight
 * @property {boolean} required - cannot be removed by budget
 * @property {string} content - the prompt text
 * @property {string[]} tags
 */

/**
 * @typedef {Object} PromptContract
 * @property {string} contractId
 * @property {string} modeId
 * @property {string} taskId
 * @property {string} generationType - "normal" | "continue" | "regenerate" | "quiet" | "internal"
 * @property {Object} outputFormat - "text" | "json" | "sections" | "packet"
 * @property {Object} outputSchema - expected output shape for JSON tasks
 * @property {string[]} requiredBlocks - block IDs that must be included
 * @property {string[]} forbiddenTopics
 * @property {string[]} allowedActions
 * @property {string[]} stopConditions
 * @property {Object} visibilityRules
 */

export const GENERATION_TYPES = ["normal", "continue", "regenerate", "quiet", "internal"];

export const POSITIONS = ["pre_context", "context", "post_history", "final_guard", "in_chat"];

export const LAYERS = ["global", "mode", "task", "kernel", "worldbook", "character", "final_guard"];

export const OUTPUT_FORMATS = ["text", "json", "sections", "packet"];

/**
 * Create a standard prompt block.
 */
export function createPromptBlock(spec = {}) {
  const { id, title, layer = "mode", modeIds = [], taskIds = [], trigger = {},
    role = "system", position = "context", priority = 500, order = 100,
    budgetWeight = 1, required = false, content = "", tags = [] } = spec;
  if (!id) throw new Error("PromptBlock requires id");
  return { id, title: title || id, layer, modeIds, taskIds, trigger, role,
    position, priority, order, budgetWeight: Math.max(1, budgetWeight),
    required: Boolean(required), content, tags };
}

/**
 * Create a standard prompt contract.
 */
export function createPromptContract(spec = {}) {
  const { contractId, modeId = "", taskId = "", generationType = "normal",
    outputFormat = "text", outputSchema = null, requiredBlocks = [],
    forbiddenTopics = [], allowedActions = [], stopConditions = [],
    visibilityRules = {} } = spec;
  if (!contractId) throw new Error("PromptContract requires contractId");
  return { contractId, modeId, taskId, generationType,
    outputFormat, outputSchema, requiredBlocks,
    forbiddenTopics, allowedActions, stopConditions, visibilityRules };
}

/**
 * Validate a prompt block has all required fields.
 */
export function validatePromptBlock(block) {
  const errors = [];
  if (!block.id) errors.push("missing id");
  if (!block.layer || !LAYERS.includes(block.layer)) errors.push(`invalid layer: ${block.layer}`);
  if (!block.position || !POSITIONS.includes(block.position)) errors.push(`invalid position: ${block.position}`);
  if (typeof block.priority !== "number") errors.push("priority must be number");
  if (typeof block.budgetWeight !== "number" || block.budgetWeight < 1) errors.push("budgetWeight must be >= 1");
  return { ok: errors.length === 0, errors };
}

export const GLOBAL_RULES_V2 = [
  "你是 World Tree 当前模式与当前任务的执行器。",
  "只完成当前任务，不闲聊、不解释系统、不 OOC。",
  "区分 canon（已确认事实）、runtime（运行时状态）、candidate（候选）。",
  "不能把候选当事实。不能直接修改 shared canon。",
  "正式世界状态/关系/时间线/真相/答案锁/角色命运变化 → proposal candidate。",
  "不能泄露 hiddenTruth/answerLock/private/systemOnly。",
  "信息不足时输出不确定/需要调查/缺失字段/candidate，不编造事实。",
  "最终输出前再次检查只输出当前任务要求的内容。"
];
