// prompt-builder.js — Build final prompt text from blocks and context
// Part of World Tree Prompt Orchestration Layer v1

import { resolveBlocks } from "./prompt-blocks.js";
import { applyBudget, getBudget } from "./prompt-budget.js";
import {
  createActivationLog, logBlockActivation, logBlockOmission,
  logHiddenFieldFilter, finalizeActivationLog, summarizeActivationLog
} from "./prompt-activation-log.js";
import { deepFilterHiddenFields, buildVisibilityInstruction } from "./prompt-visibility-policy.js";

/**
 * Build a complete prompt orchestration packet.
 *
 * @param {Object} input
 * @param {string} input.modeId - current mode
 * @param {string} input.taskId - current task (writer/director/guardian/etc.)
 * @param {string} input.userInput - user input text
 * @param {string} input.generationType - normal/continue/regenerate/quiet/internal
 * @param {Object} [input.kernelContext] - from kernel-turn-context
 * @param {Object} [input.worldbookContext] - injected worldbook entries
 * @param {Object} [input.characterContext] - character card data
 * @param {Object} [input.extraBlocks] - additional custom blocks
 * @param {number} [input.overrideBudget] - override token budget
 * @returns {Object} orchestration packet
 */
export function buildPromptOrchestrationPacket(input = {}) {
  const {
    modeId = "",
    taskId = "",
    userInput = "",
    generationType = "normal",
    kernelContext = null,
    worldbookContext = null,
    characterContext = null,
    extraBlocks = [],
    overrideBudget = 0
  } = input;

  // 1. Create activation log
  const log = createActivationLog(modeId, taskId, generationType);

  // 2. Resolve blocks for this mode + task
  const resolved = resolveBlocks({ modeId, taskId, generationType });
  for (const block of resolved) {
    logBlockActivation(log, block, `resolved:${block.layer}.${block.id}`);
  }

  // 3. Add extra blocks (e.g., kernel sidecar, worldbook context)
  const allBlocks = [...resolved, ...extraBlocks.filter(Boolean)];

  // 4. Apply budget
  const budget = overrideBudget || getBudget(generationType);
  log.budget = budget;
  const { kept, omitted } = applyBudget(allBlocks, budget);
  for (const block of omitted) {
    logBlockOmission(log, block, "budget_exceeded");
  }

  // 5. Filter hidden fields from kernel/character context
  const safeKernel = kernelContext ? deepFilterHiddenFields(kernelContext) : null;
  const safeCharacter = characterContext ? deepFilterHiddenFields(characterContext) : null;
  if (kernelContext) {
    // Count what was filtered
    const orig = JSON.stringify(kernelContext);
    const filtered = JSON.stringify(safeKernel);
    if (orig !== filtered) logHiddenFieldFilter(log, "kernelContext");
  }
  if (characterContext && JSON.stringify(characterContext) !== JSON.stringify(safeCharacter)) {
    logHiddenFieldFilter(log, "characterContext");
  }

  // 6. Build prompt text from kept blocks
  const sections = { pre_context: [], context: [], post_history: [], in_chat: [], final_guard: [] };
  for (const block of kept) {
    const pos = block.position || "context";
    if (sections[pos]) sections[pos].push(block.content);
  }

  // 7. Add visibility instruction at context level
  if (modeId) {
    sections.context.unshift(buildVisibilityInstruction(modeId));
  }

  // 8. Assemble final prompt
  const promptParts = [];
  if (sections.pre_context.length) promptParts.push(sections.pre_context.join("\n\n"));
  if (sections.context.length) promptParts.push(sections.context.join("\n\n"));

  // Inject user input at post_history position
  if (userInput) {
    sections.post_history.unshift(`【当前输入】\n${userInput}`);
  }
  if (sections.post_history.length) promptParts.push(sections.post_history.join("\n\n"));
  if (sections.in_chat.length) promptParts.push(sections.in_chat.join("\n\n"));
  if (sections.final_guard.length) promptParts.push(sections.final_guard.join("\n\n"));

  const promptText = promptParts.join("\n\n---\n\n");

  // 9. Finalize activation log
  const finalizedLog = finalizeActivationLog(log, promptText);

  // 10. Build debug summary (no prompt text for regular users)
  const debug = summarizeActivationLog(finalizedLog);

  return {
    ok: true,
    promptText,
    blocks: kept,
    activationLog: finalizedLog,
    budget,
    withinBudget: omitted.length === 0,
    warnings: finalizedLog.warnings || [],
    debug
  };
}

/**
 * Lightweight version for internal JSON tasks (director/guardian/proposal-extractor).
 * Returns a compact system prompt with task-specific contract.
 */
export function buildInternalTaskPrompt({ modeId, taskId, generationType = "internal" } = {}) {
  return buildPromptOrchestrationPacket({
    modeId,
    taskId,
    userInput: "",
    generationType,
    overrideBudget: getBudget("internal")
  });
}
