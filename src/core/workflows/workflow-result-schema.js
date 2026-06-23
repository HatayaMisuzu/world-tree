// workflow-result-schema.js — Normalized workflow result
export function createWorkflowResult(input = {}) {
  return {
    ok: input.ok !== undefined ? Boolean(input.ok) : true, workflowType: input.workflowType ?? "unknown", modeId: input.modeId ?? null,
    visibleText: input.visibleText ?? "", candidates: Array.isArray(input.candidates) ? input.candidates : [],
    proposals: Array.isArray(input.proposals) ? input.proposals : [], runtimeUpdates: Array.isArray(input.runtimeUpdates) ? input.runtimeUpdates : [],
    canonWrites: Array.isArray(input.canonWrites) ? input.canonWrites : [], authorityDecision: input.authorityDecision ?? null,
    outputContract: input.outputContract ?? null, warnings: Array.isArray(input.warnings) ? input.warnings : [],
    errors: Array.isArray(input.errors) ? input.errors : [], debugSummary: input.debugSummary ?? null
  };
}
export function validateWorkflowResult(result) {
  const e = [];
  if (typeof result.visibleText !== "string") e.push("visibleText must be string");
  if (!Array.isArray(result.candidates)) e.push("candidates must be array");
  if (!Array.isArray(result.canonWrites)) e.push("canonWrites must be array");
  if (result.canonWrites.length > 0 && result.authorityDecision?.canWriteCanon !== true) e.push("canonWrites require canWriteCanon=true");
  if (result.debugSummary && typeof result.debugSummary === "object") {
    const s = JSON.stringify(result.debugSummary);
    if (s.includes("hiddenTruth") || s.includes("D:\\\\")) e.push("debugSummary contains unsafe data");
  }
  return { ok: e.length === 0, errors: e };
}
