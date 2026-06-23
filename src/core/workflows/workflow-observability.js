// workflow-observability.js — Safe workflow trace
const REDACT = "[REDACTED]";
function redact(o) {
  if (typeof o !== "object" || !o) return o;
  const s = JSON.stringify(o);
  if (s.includes("hiddenTruth") || s.includes("answerLock") || s.includes("D:\\\\") || s.includes("C:\\\\Users")) return REDACT;
  return o;
}
export function buildWorkflowTrace(envelope, result, extra = {}) {
  return {
    workflowId: envelope.workflowId, workflowType: envelope.workflowType, modeId: envelope.modeId, activeBranchId: envelope.activeBranchId,
    authorityReason: result?.authorityDecision?.reason ?? null, candidateCount: result?.candidates?.length ?? 0,
    proposalCount: result?.proposals?.length ?? 0, runtimeUpdateCount: result?.runtimeUpdates?.length ?? 0,
    canonWriteCount: result?.canonWrites?.length ?? 0, warnings: (result?.warnings ?? []).slice(0, 10),
    promptBlocks: redact(extra.promptBlocks ?? []), p3Services: extra.p3Services ?? [], filteredFields: extra.filteredFields ?? [],
    timestamp: new Date().toISOString()
  };
}
