import { createProposal } from "../system/proposal-bus.js";

export function createReverseProposal(original = {}, window = {}) {
  if (!original.id || !window || window.status !== "open") throw new Error("open stop-loss window required");
  return { ...createProposal({ type: "reverse_change", targetFile: original.targetFile, modeId: original.modeId, projectId: original.projectId, summary: `Reverse: ${original.summary || original.id}`, reason: `stop-loss reversal of ${original.id}`, patch: window.rollbackPatch || { replace: window.oldValue || {} } }), impactLevel: original.impactLevel === "critical" ? "major" : "medium", reversible: false, reversesProposalId: original.id, changeType: "reversal" };
}
