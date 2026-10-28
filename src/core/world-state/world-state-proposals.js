import { createProposal } from "../system/proposal-bus.js";

/**
 * World-state change → proposal-bus (S4-1 facade → proposal-system).
 * Ripple depth≥2 enqueue (S4-2) relies on this so id/type/depth land in the shared queue.
 */
export function createWorldStateProposal(_projectRoot, change = {}, context = {}) {
  if (!change.stateId) throw new Error("stateId is required");
  const impactLevel = change.impactLevel || "medium";
  const newValue = change.newValue ?? change.value ?? null;
  const worldStateChange = { ...change };
  const hasPatch = change.patch && typeof change.patch === "object" && Object.keys(change.patch).length > 0;
  const patch = hasPatch
    ? change.patch
    : (newValue !== null && newValue !== undefined
      ? { merge: { [change.stateId]: newValue } }
      : (change.summary
        ? { merge: { [change.stateId]: { summary: change.summary, status: "pending_ripple" } } }
        : {}));

  return createProposal({
    type: "world_state_update",
    targetFile: "shared/world_state.json",
    modeId: context.modeId,
    projectId: context.projectId,
    summary: change.summary || `Update world state ${change.stateId}`,
    reason: change.reason || context.reason || "",
    patch,
    impactLevel,
    newValue,
    oldValue: change.oldValue ?? null,
    rippleDepth: Number(change.rippleDepth || 0),
    causedBy: change.causedBy || null,
    worldStateChange,
    source: change.source || context.source || "world-state",
    moduleKey: context.moduleKey || context.modeId || "world-state",
    round: Number(context.round || 0)
  });
}
