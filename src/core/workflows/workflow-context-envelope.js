// workflow-context-envelope.js — W0 unified envelope
import { WORKFLOW_TYPES } from "./workflow-types.js";
import { createHash } from "node:crypto";

export function inferWorkflowType(input = {}) {
  const { explicitWorkflowType, modeId, action, endpoint = "" } = input;
  if (explicitWorkflowType) return explicitWorkflowType;
  if (endpoint.includes("/create") || action === "create") return WORKFLOW_TYPES.CREATION_START;
  if (endpoint.includes("/refine") || action === "refine") return WORKFLOW_TYPES.CREATION_REFINE;
  if (endpoint.includes("/instantiate") || action === "instantiate") return WORKFLOW_TYPES.CREATION_INSTANTIATE;
  if (endpoint.includes("/import") || action === "import") return WORKFLOW_TYPES.ALCHEMY_IMPORT;
  if (endpoint.includes("/digest") || action === "digest") return WORKFLOW_TYPES.ALCHEMY_DIGEST;
  if (endpoint.includes("/deliver") || action === "deliver") return WORKFLOW_TYPES.ALCHEMY_DELIVER;
  if (modeId === "creation-forge") return WORKFLOW_TYPES.CREATION_START;
  const input_ = String(input.userInput || input.input || "");
  if (/继续|下一[幕步]|接着|推进/.test(input_)) return WORKFLOW_TYPES.PLAY_CONTINUE;
  if (/自动|auto/i.test(input_)) return WORKFLOW_TYPES.PLAY_AUTO_LIGHT;
  if (modeId === "character") return WORKFLOW_TYPES.CHARACTER_CHAT;
  if (modeId === "mystery-puzzle" && /搜[索查]|调查|检查|观察/.test(input_)) return WORKFLOW_TYPES.MYSTERY_INVESTIGATE;
  if (modeId === "murder-mystery" && /审[问讯]|盘问|质问/.test(input_)) return WORKFLOW_TYPES.MYSTERY_INTERROGATE;
  if ((modeId === "mystery-puzzle" || modeId === "murder-mystery") && /推理|推断|结论/.test(input_)) return WORKFLOW_TYPES.MYSTERY_DEDUCE;
  if (modeId === "strategy-sim" && /外交|谈判|交涉/.test(input_)) return WORKFLOW_TYPES.STRATEGY_DIPLOMACY;
  if (modeId === "strategy-sim" && /资源|更新/.test(input_)) return WORKFLOW_TYPES.STRATEGY_RESOURCE_UPDATE;
  if (modeId === "strategy-sim") return WORKFLOW_TYPES.STRATEGY_TURN;
  return WORKFLOW_TYPES.PLAY_TURN;
}

function createStableWorkflowId(input) {
  const seed = `${input.modeId || ""}${input.userInput || ""}${Date.now()}`;
  return `wf_${createHash("sha256").update(seed).digest("hex").slice(0, 8)}`;
}

export function createWorkflowContextEnvelope(input = {}) {
  const workflowType = inferWorkflowType(input);
  return {
    version: 1, workflowId: input.workflowId || createStableWorkflowId(input), workflowType,
    modeId: input.modeId || "unknown", moduleKey: input.moduleKey || null,
    projectRoot: input.projectRoot || null, branchRoot: input.branchRoot || null, activeBranchId: input.activeBranchId || "main",
    userInput: input.userInput || "", dataMode: input.dataMode || null, generationType: input.generationType || "writer",
    authority: input.authority || null,
    context: { p0p2Kernel: input.kernelContext || null, p3Mechanisms: input.p3Context || null, prompt: input.promptContext || null, worldbook: input.worldbookContext || null, character: input.characterContext || null, factions: input.factionContext || null, rules: input.rulesContext || null, telemetry: input.telemetryContext || null },
    visibility: input.visibility || { playerKnown: [], characterKnown: [], hiddenFiltered: [], systemOnlyBlocked: [] },
    outputContract: input.outputContract || null, runtime: input.runtime || {}, debug: input.debug || {}
  };
}
