import { join } from "node:path";
import { readJson, writeJson } from "../../shared/fs-utils.js";
import { appendChange } from "../tracking/tracking-store.js";

const statePath = (root) => join(root, "shared", "world_state.json");

export async function readWorldState(projectRoot) {
  const value = await readJson(statePath(projectRoot), { version: 1, updatedAt: null, states: {} });
  return { version: 1, updatedAt: null, states: {}, ...value, states: value?.states || {} };
}

export async function queryWorldState(projectRoot, query = {}) {
  const state = await readWorldState(projectRoot);
  return Object.values(state.states).filter((item) => (!query.type || item.type === query.type) && (!query.targetId || item.targetId === query.targetId));
}

export async function applyWorldStateChange(projectRoot, approvedProposal = {}) {
  if (approvedProposal.status !== "approved") throw new Error("World state change requires an approved proposal");
  const change = approvedProposal.worldStateChange || approvedProposal.change;
  if (!change?.stateId) throw new Error("approved proposal requires worldStateChange.stateId");
  const state = await readWorldState(projectRoot);
  const before = state.states[change.stateId] || null;
  const next = { ...(before || {}), ...change, id: change.stateId, lastChangeRef: approvedProposal.id, updatedAt: new Date().toISOString() };
  state.states[change.stateId] = next;
  state.updatedAt = next.updatedAt;
  await writeJson(statePath(projectRoot), state);
  const tracking = await appendChange(projectRoot, {
    source: "proposal-bus", proposalId: approvedProposal.id, modeId: approvedProposal.modeId,
    targetFile: "shared/world_state.json", fieldPath: `states.${change.stateId}`,
    oldValue: before, newValue: next, reason: approvedProposal.reason || approvedProposal.summary,
    impactLevel: approvedProposal.impactLevel || change.impactLevel || "medium", rippleDepth: 0
  });
  return { state, previous: before, current: next, tracking };
}
