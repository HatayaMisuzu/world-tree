// adapters/server-workflow-adapter.js — WSD-6 minimal server workflow API
import { runWorkflowAction } from "../workflow-runner.js";
import { WORKFLOW_TYPES } from "../workflow-types.js";

export async function handleWorkflowApiRequest(body = {}, deps = {}) {
  const { workflowType, modeId, projectId, branchId, userInput, options } = body || {};
  const result = await runWorkflowAction({
    explicitWorkflowType: workflowType, modeId: modeId || "unknown",
    moduleKey: projectId, activeBranchId: branchId || "main", userInput: userInput || "",
    options: options || {}, kernelContext: deps.kernelContext || null
  });
  const safe = { ...result };
  if (safe.debugSummary) {
    const s = JSON.stringify(safe.debugSummary);
    if (s.includes("hiddenTruth") || s.includes("D:\\\\")) safe.debugSummary = { redacted: true };
  }
  return { ok: safe.ok, workflowType: safe.workflowType, visibleText: safe.visibleText, routed: { candidates: safe.candidates || [], proposals: safe.proposals || [], runtimeUpdates: safe.runtimeUpdates || [], debug: safe.debugSummary || {} }, warnings: safe.warnings || [], errors: safe.errors || [] };
}

export function getWorkflowTypesResponse() {
  const active = Object.entries(WORKFLOW_TYPES).filter(([k]) => !k.includes("HIDDEN")).map(([k, v]) => ({ key: k, type: v }));
  return { ok: true, types: active, count: active.length, note: "Only active types. Prototype/declared workflows are not exposed." };
}

export function getWorkflowStatus() {
  return { ok: true, workflowLayer: "active", preflightProtected: true, services: ["creation", "alchemy", "play-turn", "character", "mystery", "strategy", "direction", "observability"] };
}
