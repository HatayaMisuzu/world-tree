// adapters/console-workflow-adapter.js — WSD-7 safe console workflow summary
import { buildWorkflowTrace } from "../workflow-observability.js";
const REDACT = "[REDACTED]";
function redactValue(v) {
  if (typeof v !== "string") return v;
  if (v.includes("hiddenTruth") || v.includes("answerLock") || v.includes("private") || v.includes("system_only")) return REDACT;
  if (v.includes(":\\") || v.includes("C:\\Users")) return REDACT;
  return v;
}
export function buildConsoleWorkflowSummary(result) {
  const trace = result?.debugSummary || {};
  return {
    workflowType: redactValue(trace.workflowType || "unknown"),
    modeId: redactValue(trace.modeId || ""), branchId: trace.activeBranchId || "main",
    authorityReason: trace.authorityReason || "default",
    counts: { candidates: trace.candidateCount || 0, proposals: trace.proposalCount || 0, runtime: trace.runtimeUpdateCount || 0, canon: 0 },
    warnings: (trace.warnings || []).slice(0, 5).map(redactValue),
    safe: true
  };
}
export function redactConsoleWorkflowSummary(summary) {
  if (!summary) return summary;
  const s = JSON.stringify(summary);
  if (s.includes("hiddenTruth") || s.includes("D:\\\\")) return { redacted: true, safe: false };
  return summary;
}
