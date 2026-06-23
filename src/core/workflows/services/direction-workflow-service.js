// services/direction-workflow-service.js + observability-workflow-service.js — W4
import { WORKFLOW_TYPES } from "../workflow-types.js";
export const directionWorkflowService = {
  async run(envelope, { authorityDecision }) {
    if (envelope.workflowType === WORKFLOW_TYPES.PLAY_CONTINUE || envelope.workflowType === WORKFLOW_TYPES.PLAY_AUTO_LIGHT) {
      return { ok: true, visibleText: "[Auto-light] 推进一个 beat", candidates: [], proposals: [], runtimeUpdates: [{ key: "auto_light_beat" }], canonWrites: [], warnings: authorityDecision.candidateOnly ? [] : [] };
    }
    return { ok: true, visibleText: "[Direction] stub", candidates: [], canonWrites: [], warnings: [] };
  }
};
export const observabilityWorkflowService = {
  async run(envelope, { authorityDecision }) {
    return { ok: true, visibleText: `[Debug] workflow=${envelope.workflowType} mode=${envelope.modeId}`, candidates: [], canonWrites: [], runtimeUpdates: [], warnings: [], debugSummary: { modeId: envelope.modeId, branchId: envelope.activeBranchId } };
  }
};
