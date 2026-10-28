/**
 * proposal-bus — external interface name for the proposal pipeline (S4-1).
 *
 * Implementation of record: ../engine/proposal-system.js
 *   (adopt / commit / reject / reverse + stop-loss queries)
 *
 * Canon writes go through overlay-store WRITE_POLICY via buildOverlayWriteSet +
 * applyOverlayWriteSet. This facade does not invent a third write path and does
 * not write shared/ directly (archived implementation did).
 *
 * Archived prior implementation: archive/src/core/system/proposal-bus.js
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendJsonl } from "../../shared/fs-utils.js";
import { openStopLossWindow } from "../content/stop-loss-window.js";
import {
  WRITE_POLICY,
  buildOverlayWriteSet,
  splitWriteSet,
  OVERLAY_FILES,
  addToPending
} from "../engine/overlay-store.js";
import { readJsonSync, writeJson } from "../../shared/fs-utils.js";
import {
  adoptProposal,
  commitProposal,
  rejectProposal as rejectRecordProposal,
  reverseProposal,
  getStopLossWindow,
  getReversibleProposals,
  getPendingUserConfirmations,
  getByStatus,
  getProposalStats,
  createProposal as createRecordProposal,
  ingestBusProposal,
  exportProposalSnapshot,
  importProposalSnapshot,
  resetProposalStore,
  tickProposals,
  proposalsFromSections,
  getAutoCommitLog
} from "../engine/proposal-system.js";

export {
  adoptProposal,
  commitProposal,
  reverseProposal,
  getStopLossWindow,
  getReversibleProposals,
  getPendingUserConfirmations,
  getByStatus,
  getProposalStats,
  createRecordProposal,
  ingestBusProposal,
  exportProposalSnapshot,
  importProposalSnapshot,
  resetProposalStore,
  tickProposals,
  proposalsFromSections,
  getAutoCommitLog,
  rejectRecordProposal,
  WRITE_POLICY
};

/** Pure patch helper retained for callers/tests (no I/O). */
export function applyProposalPatch(document, proposal) {
  const patch = proposal.patch || {};

  if (patch.replace && typeof patch.replace === "object") {
    return { ...document, ...patch.replace };
  }

  if (patch.merge && typeof patch.merge === "object") {
    const next = { ...document };
    for (const [key, value] of Object.entries(patch.merge)) {
      if (
        typeof value === "object" && value !== null && !Array.isArray(value)
        && typeof next[key] === "object" && next[key] !== null && !Array.isArray(next[key])
      ) {
        next[key] = { ...next[key], ...value };
      } else {
        next[key] = value;
      }
    }
    return next;
  }

  if (patch.append && typeof patch.append === "object") {
    const next = { ...document };
    for (const [key, value] of Object.entries(patch.append)) {
      if (!Array.isArray(next[key])) next[key] = [];
      next[key] = [...next[key], value];
    }
    return next;
  }

  throw new Error("Unsupported proposal patch type");
}

/**
 * External createProposal.
 * - Record shape ({ typeId, change }) → proposal-system createProposal
 * - Bus shape (type/summary/patch/targetFile) → factory object + ingest into record store
 */
export function createProposal(input = {}, options = {}) {
  if (input && typeof input === "object" && input.typeId && input.change) {
    return createRecordProposal(input, options);
  }

  const bus = {
    id: input.id || `prop_${++busIdSeq}`,
    type: input.type || "world_state_update",
    summary: input.summary || "",
    patch: input.patch || {},
    targetFile: input.targetFile || "",
    status: "pending",
    modeId: input.modeId || "",
    projectId: input.projectId || "",
    reason: input.reason || "",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    impactLevel: input.impactLevel || null,
    reversible: input.reversible === true || input.oldValue !== undefined || Boolean(input.rollbackPatch),
    requiresSecondConfirm: Boolean(input.requiresSecondConfirm),
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    affectedFiles: Array.isArray(input.affectedFiles) ? input.affectedFiles : [],
    affectedEntities: Array.isArray(input.affectedEntities) ? input.affectedEntities : [],
    affectedModes: Array.isArray(input.affectedModes) ? input.affectedModes : [],
    changeCategory: input.changeCategory || "description",
    rollbackPatch: input.rollbackPatch || null,
    stopLossWindow: input.stopLossWindow || { enabled: false, status: "none", expiresAtTurn: null },
    round: input.round || 0,
    source: input.source || "proposal-bus",
    moduleKey: input.moduleKey || input.modeId || "unknown"
  };

  // Record of truth: mirror into proposal-system (no auto-commit).
  ingestBusProposal(bus);
  return bus;
}

let busIdSeq = 0;

export function validateProposal(proposal = {}) {
  const errors = [];
  if (!proposal.type && !proposal.typeId) errors.push("missing type");
  const status = proposal.status || "pending";
  if (!["pending", "approved", "rejected", "adopted", "committed", "expired", "reversed"].includes(status)) {
    errors.push("invalid status");
  }
  if (status === "approved" && proposal.targetFile && !proposal.patch) {
    errors.push("approved proposal with targetFile must have patch");
  }
  return { ok: errors.length === 0, errors };
}

async function readProposalLog(logPath) {
  if (!existsSync(logPath)) return [];
  try {
    const text = await readFile(logPath, "utf-8");
    return text.trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeProposalLog(logPath, proposals) {
  const { writeFile, rename } = await import("node:fs/promises");
  const lines = proposals.map(p => JSON.stringify(p)).join("\n") + (proposals.length ? "\n" : "");
  const tmpPath = `${logPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, lines, "utf-8");
  await rename(tmpPath, logPath);
}

function overlayPatchFromBus(proposal = {}) {
  const patch = proposal.patch || {};
  const target = String(proposal.targetFile || "");
  const payload = patch.replace || patch.merge || patch.append || patch;
  if (target.includes("character")) return { characters: payload };
  if (target.includes("worldbook")) return { worldbook: payload };
  // Default canon lane for shared/world_state and other shared targets
  return { canon: payload };
}


async function applyWriteSetViaPolicy(projectRoot, writeSet, context = {}) {
  const runtimeDir = join(projectRoot, "runtime");
  const { auto, pending, manual } = splitWriteSet(writeSet);
  const written = [];
  for (const op of auto) {
    const file = op.file;
    if (!file) continue;
    const filePath = join(runtimeDir, "overlay", file);
    const mode = op.op || op.mode || "merge-json";
    const payload = op.payload ?? op.value ?? {};
    if (mode === "append-jsonl") {
      await appendJsonl(filePath, payload || {});
    } else if (mode === "append-json-array") {
      const existing = readJsonSync(filePath, []);
      const next = Array.isArray(existing) ? existing : [];
      next.push(...(Array.isArray(payload) ? payload : [payload]));
      await writeJson(filePath, next.slice(-200));
    } else if (mode === "write-json") {
      await writeJson(filePath, payload || {});
    } else {
      const existing = readJsonSync(filePath, {});
      await writeJson(filePath, { ...(existing && typeof existing === "object" ? existing : {}), ...(payload || {}) });
    }
    written.push({ file, mode, status: "written", level: WRITE_POLICY.AUTO.level });
  }
  for (const op of pending) {
    addToPending(context.moduleKey || "proposal-bus", op, { round: context.round || 0 });
  }
  return { written, pendingCount: pending.length, manualCount: manual.length, writePolicy: WRITE_POLICY };
}

/**
 * Approve a bus/JSONL proposal through the record implementation:
 * ingest → adopt → commit, with canon writes via overlay-store WRITE_POLICY.
 */
export async function approveProposal(project = {}, proposalId, services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const appendJsonlFn = services.appendJsonl || appendJsonl;

  if (!projectRoot) {
    return { ok: false, proposalId, status: "error", message: "projectRoot is required for approveProposal" };
  }

  const logPath = project.proposalLog || join(projectRoot, "runtime", "world-proposals.jsonl");
  let proposals;
  if (existsSync(logPath)) {
    proposals = await readProposalLog(logPath);
  } else {
    proposals = Array.isArray(project.proposals) ? [...project.proposals] : [];
  }

  const idx = proposals.findIndex(p => p.id === proposalId);
  if (idx === -1) {
    return { ok: false, proposalId, status: "not_found", message: `Proposal not found: ${proposalId}` };
  }

  const proposal = { ...proposals[idx] };
  if (proposal.status !== "pending") {
    return { ok: false, proposalId, status: proposal.status, message: `Proposal is not pending: ${proposal.status}` };
  }
  if ((proposal.impactLevel === "critical" || proposal.requiresSecondConfirm) && options.secondConfirm !== true) {
    return { ok: false, proposalId, status: "second_confirmation_required", message: "Critical proposal requires second confirmation" };
  }

  // Isolation: bus proposals that declare targetFile must stay under shared/
  if (proposal.targetFile && !String(proposal.targetFile).startsWith("shared/")) {
    return { ok: false, proposalId, status: "error", message: `Proposal targetFile must be under shared/: ${proposal.targetFile}` };
  }

  // Record path: ingest + adopt + commit
  const record = ingestBusProposal(proposal);
  if (record.status === "pending") {
    const a = adoptProposal(record.id);
    if (a.error) return { ok: false, proposalId, status: "error", message: a.error };
  }
  if (record.status === "adopted" || record.status === "pending") {
    // pending only if adopt was skipped because ingest restored adopted; commit accepts adopted|pending(auto)
    const c = commitProposal(record.id, options.committedBy || "user");
    if (c.error) return { ok: false, proposalId, status: "error", message: c.error };
  }

  let patchApplied = false;
  let overlayResult = null;
  if (proposal.targetFile && proposal.patch && Object.keys(proposal.patch).length > 0) {
    const overlayPatch = overlayPatchFromBus(proposal);
    const moduleKey = proposal.modeId || proposal.moduleKey || "proposal-bus";
    const writeSet = buildOverlayWriteSet(
      moduleKey,
      {
        ...overlayPatch,
        audit: { proposalId: proposal.id, source: "proposal-bus" },
        createdAt: new Date().toISOString()
      }
    );
    overlayResult = await applyWriteSetViaPolicy(projectRoot, writeSet, {
      moduleKey,
      round: Number(options.currentTurn || proposal.round || 0)
    });
    patchApplied = true;
  }

  proposal.status = "approved";
  proposal.updatedAt = new Date().toISOString();
  proposals[idx] = proposal;

  try {
    if (existsSync(logPath)) {
      await writeProposalLog(logPath, proposals);
    } else {
      await appendJsonlFn(logPath, proposal);
    }
  } catch (err) {
    return { ok: false, proposalId, status: "error", message: `Failed to write proposal log: ${err.message}` };
  }

  if (patchApplied) {
    try {
      await appendJsonlFn(join(projectRoot, "runtime", "tracking", "change-log.jsonl"), {
        id: `chg_${proposal.id}`,
        timestamp: new Date().toISOString(),
        modeId: proposal.modeId || "",
        sceneId: proposal.sceneId || "",
        source: "proposal-bus",
        proposalId: proposal.id,
        moduleId: proposal.moduleId || "",
        targetFile: proposal.targetFile,
        fieldPath: proposal.fieldPath || "",
        oldValue: proposal.oldValue ?? null,
        newValue: proposal.newValue ?? proposal.patch ?? null,
        reason: proposal.reason || proposal.summary || "",
        changeType: proposal.changeType || "state_update",
        impactLevel: proposal.impactLevel || "medium",
        rippleDepth: Number(proposal.rippleDepth || 0),
        causedBy: proposal.causedBy || null,
        writePath: "overlay-store",
        overlayFiles: Array.isArray(overlayResult?.written)
          ? overlayResult.written.map(w => w.file)
          : [OVERLAY_FILES.CANON]
      });
    } catch (err) {
      return { ok: false, proposalId, status: "error", patchApplied, message: `Tracking append failed: ${err.message}` };
    }
  }

  let stopLossWindow = null;
  if (["major", "critical"].includes(proposal.impactLevel)) {
    stopLossWindow = await openStopLossWindow(projectRoot, proposal, Number(options.currentTurn || 0));
  }

  return {
    ok: true,
    proposalId,
    status: "approved",
    patchApplied,
    stopLossWindow,
    writePath: "overlay-store",
    writePolicy: WRITE_POLICY.AUTO.level,
    overlay: overlayResult,
    message: "proposal approved via proposal-system; canon write through overlay-store WRITE_POLICY"
  };
}

/** Reject: update JSONL + record store; never writes canon/overlay. */
export async function rejectProposal(project = {}, proposalId, services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const appendJsonlFn = services.appendJsonl || appendJsonl;

  if (!projectRoot) {
    return { ok: false, proposalId, status: "error", message: "projectRoot is required for rejectProposal" };
  }

  const logPath = project.proposalLog || join(projectRoot, "runtime", "world-proposals.jsonl");
  let proposals;
  if (existsSync(logPath)) {
    proposals = await readProposalLog(logPath);
  } else {
    proposals = Array.isArray(project.proposals) ? [...project.proposals] : [];
  }

  const idx = proposals.findIndex(p => p.id === proposalId);
  if (idx === -1) {
    return { ok: false, proposalId, status: "not_found", message: `Proposal not found: ${proposalId}` };
  }

  const proposal = { ...proposals[idx] };
  if (proposal.status !== "pending") {
    return { ok: false, proposalId, status: proposal.status, message: `Proposal is not pending: ${proposal.status}` };
  }

  const record = ingestBusProposal(proposal);
  if (record.status === "pending") {
    rejectRecordProposal(record.id, options.reason || "");
  }

  proposal.status = "rejected";
  proposal.updatedAt = new Date().toISOString();
  proposals[idx] = proposal;

  try {
    if (existsSync(logPath)) {
      await writeProposalLog(logPath, proposals);
    } else {
      await appendJsonlFn(logPath, proposal);
    }
  } catch (err) {
    return { ok: false, proposalId, status: "error", message: `Failed to write proposal log: ${err.message}` };
  }

  return { ok: true, proposalId, status: "rejected", message: "proposal rejected, canon/overlay unchanged" };
}

export function listPendingProposals(project = {}, options = {}) {
  const fromProject = Array.isArray(project.proposals)
    ? project.proposals.filter(p => p.status === "pending")
    : [];
  if (fromProject.length) return { proposals: fromProject };
  // Fall back to record store
  return { proposals: getByStatus("pending") };
}

export function createProposalSummary(proposal = {}) {
  return {
    id: proposal.id,
    type: proposal.type || proposal.typeId,
    status: proposal.status
  };
}
