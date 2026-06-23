// prompt-activation-log.js — Record which blocks activated and why
// Part of World Tree Prompt Orchestration Layer v1

import { createHash } from "node:crypto";

/**
 * Create a fresh activation log.
 */
export function createActivationLog(modeId = "", taskId = "", generationType = "normal") {
  return {
    modeId,
    taskId,
    generationType,
    blocks: [],
    omittedBlocks: [],
    hiddenFieldsFiltered: [],
    budget: 0,
    totalTokens: 0,
    finalGuardIncluded: false,
    promptHash: "",
    warnings: [],
    startedAt: new Date().toISOString()
  };
}

/**
 * Record a block activation.
 */
export function logBlockActivation(log, block, reason = "") {
  if (!log || !block) return log;
  log.blocks.push({
    id: block.id,
    layer: block.layer,
    position: block.position,
    priority: block.priority,
    required: block.required,
    estimatedTokens: Math.ceil(String(block.content || "").length / 1.3),
    reason: reason || `trigger:${block.layer}.${block.id}`
  });
  return log;
}

/**
 * Record a block omission (budget removal).
 */
export function logBlockOmission(log, block, reason = "budget") {
  if (!log || !block) return log;
  log.omittedBlocks.push({
    id: block.id,
    layer: block.layer,
    priority: block.priority,
    reason
  });
  return log;
}

/**
 * Record hidden field filtering.
 */
export function logHiddenFieldFilter(log, fieldPath) {
  if (!log || !fieldPath) return log;
  log.hiddenFieldsFiltered.push(fieldPath);
  return log;
}

/**
 * Finalize the log: compute prompt hash and summary.
 */
export function finalizeActivationLog(log, promptText = "") {
  if (!log) return null;
  log.promptHash = createHash("sha256").update(String(promptText)).digest("hex").slice(0, 16);
  log.totalTokens = log.blocks.reduce((sum, b) => sum + (b.estimatedTokens || 0), 0);
  log.finalGuardIncluded = log.blocks.some(b => b.id.includes("final_guard") || b.position === "final_guard");
  return log;
}

/**
 * Extract a debug-safe summary (no prompt content).
 */
export function summarizeActivationLog(log) {
  if (!log) return null;
  return {
    modeId: log.modeId,
    taskId: log.taskId,
    generationType: log.generationType,
    blockCount: log.blocks.length,
    omittedCount: log.omittedBlocks.length,
    hiddenFilteredCount: log.hiddenFieldsFiltered.length,
    budget: log.budget,
    totalTokens: log.totalTokens,
    finalGuardIncluded: log.finalGuardIncluded,
    promptHash: log.promptHash,
    warnings: log.warnings
  };
}
