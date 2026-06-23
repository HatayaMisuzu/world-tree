import { join } from "node:path";
import { readJson, writeJson } from "../../server/fs-utils.js";

const pathFor = (root) => join(root, "runtime", "stop-loss-windows.json");
const empty = () => ({ version: 1, updatedAt: null, windows: [] });

export async function readStopLossWindows(projectRoot) { const data = await readJson(pathFor(projectRoot), empty()); return { ...empty(), ...data, windows: Array.isArray(data?.windows) ? data.windows : [] }; }
export async function openStopLossWindow(projectRoot, proposal = {}, currentTurn = 0) {
  if (!["major", "critical"].includes(proposal.impactLevel)) return null;
  const data = await readStopLossWindows(projectRoot);
  const duration = proposal.impactLevel === "critical" ? 5 : 3;
  const window = { id: `slw_${proposal.id}`, proposalId: proposal.id, status: "open", openedAtTurn: currentTurn, expiresAtTurn: currentTurn + duration, oldValue: proposal.oldValue ?? null, rollbackPatch: proposal.rollbackPatch ?? null, targetFile: proposal.targetFile || "" };
  data.windows = data.windows.filter((item) => item.proposalId !== proposal.id).concat(window);
  data.updatedAt = new Date().toISOString();
  await writeJson(pathFor(projectRoot), data);
  return window;
}
export function isStopLossOpen(window, currentTurn = 0) { return window?.status === "open" && Number(currentTurn) <= Number(window.expiresAtTurn); }
export async function markStopLossReversed(projectRoot, proposalId) { const data = await readStopLossWindows(projectRoot); const window = data.windows.find((item) => item.proposalId === proposalId); if (window) window.status = "reversed"; data.updatedAt = new Date().toISOString(); await writeJson(pathFor(projectRoot), data); return window || null; }
