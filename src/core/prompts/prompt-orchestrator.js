// prompt-orchestrator.js — Main entry point for Prompt Orchestration Layer
// Part of World Tree Prompt Orchestration Layer v1
//
// This module combines prompt-builder, prompt-blocks, prompt-contract,
// prompt-budget, prompt-activation-log, prompt-output-schemas,
// prompt-visibility-policy, and prompt-inspector into a single orchestrator.

export { createPromptBlock, createPromptContract, validatePromptBlock, GLOBAL_RULES_V2, GENERATION_TYPES, POSITIONS, LAYERS, OUTPUT_FORMATS } from "./prompt-contract.js";
export { resolveBlocks, getBlock, ALL_BLOCKS } from "./prompt-blocks.js";
export { buildPromptOrchestrationPacket, buildInternalTaskPrompt } from "./prompt-builder.js";
export { applyBudget, getBudget, estimateTokens, BUDGET_CONFIG } from "./prompt-budget.js";
export { createActivationLog, logBlockActivation, logBlockOmission, logHiddenFieldFilter, finalizeActivationLog, summarizeActivationLog } from "./prompt-activation-log.js";
export { getModeOutputSections, getTaskSchema, validateTaskOutput, MODE_OUTPUT_SECTIONS, TASK_SCHEMAS } from "./prompt-output-schemas.js";
export { deepFilterHiddenFields, isHiddenField, isHiddenPath, getVisibilityRules, buildVisibilityInstruction } from "./prompt-visibility-policy.js";
export { buildPromptInspector, validateInspectorSafety } from "./prompt-inspector.js";

// ═══════════════════════════════════════════════════════════════
//  Backward-compatible wrapper for old mode-prompt-registry
// ═══════════════════════════════════════════════════════════════

import { buildPromptOrchestrationPacket } from "./prompt-builder.js";

/**
 * Drop-in replacement for the old buildModePromptResult.
 * Uses the new orchestrator internally but keeps the same output shape
 * for backward compatibility with mode-runner.
 */
export function buildOrchestratedModePrompt(inputPacket = {}, options = {}) {
  const modeId = options.profileId ? modeIdFromProfile(options.profileId) : (inputPacket.modeId || "");
  const packet = buildPromptOrchestrationPacket({
    modeId,
    taskId: "writer",
    userInput: inputPacket.userInput?.text || "",
    generationType: "normal"
  });
  if (!packet.ok || !packet.promptText) {
    return { ok: false, prompt: "", errors: [{ code: "ORCHESTRATION_FAILED", message: "Failed to build prompt" }] };
  }
  return {
    ok: true,
    prompt: packet.promptText,
    profileId: options.profileId,
    orchestrated: true,
    debug: packet.debug
  };
}

function modeIdFromProfile(profileId = "") {
  const map = {
    grand_world_v1: "world-rpg",
    character_v1: "character",
    tabletop_v1: "tabletop",
    mystery_puzzle_v1: "mystery-puzzle",
    strategy_sim_v1: "strategy-sim",
    murder_mystery_v1: "murder-mystery",
    creation_forge_v1: "creation-forge",
    quick_setting_v1: "quick-setting"
  };
  return map[profileId] || "";
}
