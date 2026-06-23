// workflow-output-router.js — Route raw output to normalized result
import { createWorkflowResult, validateWorkflowResult } from "./workflow-result-schema.js";
export function routeWorkflowOutput(envelope, rawOutput, authorityDecision) {
  const result = createWorkflowResult({
    ok: rawOutput?.ok !== false, workflowType: envelope.workflowType, modeId: envelope.modeId,
    visibleText: rawOutput?.visibleText ?? rawOutput?.text ?? "",
    candidates: rawOutput?.candidates ?? [], proposals: rawOutput?.proposals ?? [],
    runtimeUpdates: rawOutput?.runtimeUpdates ?? [], canonWrites: rawOutput?.canonWrites ?? [],
    authorityDecision, warnings: rawOutput?.warnings ?? [], debugSummary: rawOutput?.debugSummary ?? null
  });
  if (authorityDecision?.candidateOnly && result.canonWrites.length > 0) {
    result.candidates.push(...result.canonWrites.map(c => ({ ...c, status: "candidate", movedFromCanon: true })));
    result.canonWrites = []; result.warnings.push("canonWrites moved to candidates: authority is candidate-only");
  }
  if (authorityDecision?.canWriteCanon !== true && result.canonWrites.length > 0) {
    result.canonWrites = []; result.errors.push("canon writes blocked: authority denies");
  }
  const v = validateWorkflowResult(result);
  if (!v.ok) result.errors.push(...v.errors);
  return result;
}
