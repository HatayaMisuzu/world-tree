import { createProposal } from "../system/proposal-bus.js";

export function createWorldStateProposal(_projectRoot, change = {}, context = {}) {
  if (!change.stateId) throw new Error("stateId is required");
  return {
    ...createProposal({
      type: "world_state_update",
      targetFile: "shared/world_state.json",
      modeId: context.modeId,
      projectId: context.projectId,
      summary: change.summary || `Update world state ${change.stateId}`,
      reason: change.reason || context.reason || "",
      patch: {}
    }),
    impactLevel: change.impactLevel || "medium",
    worldStateChange: { ...change }
  };
}
