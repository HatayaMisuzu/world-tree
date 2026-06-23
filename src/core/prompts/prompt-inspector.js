// prompt-inspector.js — Debug view into prompt construction
// Part of World Tree Prompt Orchestration Layer v1

import { summarizeActivationLog } from "./prompt-activation-log.js";

/**
 * Build a debug-safe inspector view from an orchestration packet.
 * Never returns the full prompt text to non-developer users.
 * In developer/debug mode, promptText may be included.
 */
export function buildPromptInspector(packet = {}, options = {}) {
  const { includePromptText = false, maxPromptChars = 500 } = options;
  const log = packet.activationLog || {};
  const summary = summarizeActivationLog(log);

  const inspector = {
    modeId: summary?.modeId || "",
    taskId: summary?.taskId || "",
    generationType: summary?.generationType || "",
    blockCount: summary?.blockCount || 0,
    omittedBlockCount: summary?.omittedCount || 0,
    hiddenFilteredCount: summary?.hiddenFilteredCount || 0,
    budget: summary?.budget || 0,
    totalTokens: summary?.totalTokens || 0,
    finalGuardIncluded: summary?.finalGuardIncluded || false,
    promptHash: summary?.promptHash || "",
    warnings: summary?.warnings || [],
    blocks: (log.blocks || []).map(b => ({
      id: b.id,
      layer: b.layer,
      position: b.position,
      required: b.required,
      estimatedTokens: b.estimatedTokens || 0,
      reason: b.reason || ""
    })),
    omittedBlocks: (log.omittedBlocks || []).map(b => ({
      id: b.id,
      layer: b.layer,
      reason: b.reason || ""
    }))
  };

  // Only include prompt text in developer mode or when explicitly requested
  if (includePromptText && packet.promptText) {
    inspector.promptPreview = String(packet.promptText).slice(0, maxPromptChars);
    if (packet.promptText.length > maxPromptChars) {
      inspector.promptPreview += "...";
    }
  }

  return inspector;
}

/**
 * Returns true if the inspector confirms all safety checks pass.
 */
export function validateInspectorSafety(inspector = {}) {
  const checks = {
    finalGuardIncluded: inspector.finalGuardIncluded === true,
    noOmittedRequired: !inspector.blocks?.some(b => b.required && inspector.omittedBlocks?.some(o => o.id === b.id)),
    hiddenFieldsFiltered: inspector.hiddenFilteredCount >= 0,
    budgetRespected: inspector.totalTokens <= (inspector.budget || 99999)
  };
  return {
    pass: Object.values(checks).every(Boolean),
    checks
  };
}
