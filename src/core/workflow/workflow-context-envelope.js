// workflow-context-envelope.js — Unified workflow context for safe turn orchestration
import { summarizeKernelTurnContext } from "../kernel/kernel-turn-context.js";
import { createAuthorityContext, validateAuthorityForWrite, AUTHORITY_ACTION } from "../authority/asset-authority-policy.js";

export function createWorkflowContextEnvelope(input = {}) {
  const { modeId = "", taskId = "writer", generationType = "normal", moduleKey = "", projectRoot = "", branchRoot = "", activeBranchId = "main", userInput = "", dataMode = "worldbook", kernelContext = null, p3Context = null, promptSummary = null } = input;
  const p0p2 = kernelContext ? summarizeKernelTurnContext(kernelContext) : null;
  const authority = createAuthorityContext({
    action: generationType === "internal" ? AUTHORITY_ACTION.CANDIDATE_ONLY : AUTHORITY_ACTION.RUNTIME_ONLY,
    source: "workflow-envelope", moduleKey, targetFile: "", reason: "standard turn"
  });
  return {
    version: 1, workflowId: `wf_${Date.now()}`, workflowType: inferWorkflowType(input),
    modeId, taskId, generationType, moduleKey, projectRoot, branchRoot, activeBranchId,
    userInput, dataMode, p0p2, p3: p3Context, prompt: promptSummary,
    authority: { defaultAction: authority.action, canonWriteAllowed: false, candidateOnly: true, initializationWriteAllowed: false, requiresProposal: true },
    visibility: { filteredFieldsCount: 0, hiddenPolicy: "strict", playerKnownOnly: true },
    warnings: [], debug: {}
  };
}
export function inferWorkflowType({ modeId, userInput, action, endpoint } = {}) {
  if (action === "create" || endpoint?.includes("create")) return "creation_wizard";
  if (action === "import" || endpoint?.includes("alchemy")) return "alchemy_import";
  if (modeId === "character") return "character_chat";
  if (modeId === "murder-mystery") return "murder_interrogation";
  if (modeId === "mystery-puzzle") return "mystery_investigation";
  if (modeId === "strategy-sim") return "strategy_turn";
  if (String(userInput || "").includes("继续")) return "continue_turn";
  return "play_turn";
}
export function summarizeWorkflowEnvelope(env) { return { workflowId: env.workflowId, workflowType: env.workflowType, modeId: env.modeId, taskId: env.taskId }; }
export function validateWorkflowEnvelope(env) { const e = []; if (!env.modeId) e.push("missing modeId"); return { ok: e.length === 0, errors: e }; }
