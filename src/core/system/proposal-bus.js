import { existsSync } from "node:fs";
import { readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { readJsonSync, writeJson, appendJsonl } from "../../server/fs-utils.js";
import { pathWithinRoot } from "../../server/path-security.js";

/**
 * 安全的 proposal patch：仅支持 replace shallow fields / merge object fields / append array items。
 * 不支持 eval、function、path traversal。
 */
export function applyProposalPatch(document, proposal) {
  const patch = proposal.patch || {};

  if (patch.replace && typeof patch.replace === "object") {
    return { ...document, ...patch.replace };
  }

  if (patch.merge && typeof patch.merge === "object") {
    const next = { ...document };
    for (const [key, value] of Object.entries(patch.merge)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof next[key] === "object" && next[key] !== null && !Array.isArray(next[key])) {
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

export function createProposal(input = {}, options = {}) {
  return {
    id: input.id || `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type || "world_state_update",
    summary: input.summary || "",
    patch: input.patch || {},
    targetFile: input.targetFile || "",
    status: "pending",
    modeId: input.modeId || "",
    projectId: input.projectId || "",
    reason: input.reason || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function validateProposal(proposal = {}) {
  const errors = [];
  if (!proposal.type) errors.push("missing type");
  if (!["pending", "approved", "rejected"].includes(proposal.status)) errors.push("invalid status");
  if (proposal.status === "approved" && proposal.targetFile && !proposal.patch) {
    errors.push("approved proposal with targetFile must have patch");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 读取 proposal log（JSONL 格式）中的所有 proposal。
 */
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

/**
 * 写入 proposal log（全量重写 JSONL）。
 */
async function writeProposalLog(logPath, proposals) {
  const lines = proposals.map(p => JSON.stringify(p)).join("\n") + (proposals.length ? "\n" : "");
  const { writeFile, rename } = await import("node:fs/promises");
  const tmpPath = `${logPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, lines, "utf-8");
  await rename(tmpPath, logPath);
}

/**
 * 真实 approve proposal：
 * 1. 读取 proposal log → 2. 找到 proposalId → 3. 应用 safe patch 到 shared
 * → 4. 更新 status=approved → 5. 写回 proposal log
 */
export async function approveProposal(project = {}, proposalId, services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const readJsonFn = services.readJsonSync || readJsonSync;
  const writeJsonFn = services.writeJson || writeJson;
  const appendJsonlFn = services.appendJsonl || appendJsonl;
  const pathCheck = services.pathWithinRoot || pathWithinRoot;

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

  // 如果有 targetFile，应用 safe patch
  // 安全规则：targetFile 必须位于 shared/ 目录下
  let patchApplied = false;
  let trackingBefore = null;
  let trackingAfter = null;
  if (proposal.targetFile && proposal.patch && Object.keys(proposal.patch).length > 0) {
    // 隔离检查：proposal 只能修改 shared/ 下的文件
    if (!proposal.targetFile.startsWith("shared/")) {
      return { ok: false, proposalId, status: "error", message: `Proposal targetFile must be under shared/: ${proposal.targetFile}` };
    }
    const targetPath = join(projectRoot, proposal.targetFile);
    if (!pathCheck(projectRoot, targetPath)) {
      return { ok: false, proposalId, status: "error", message: `Target file outside project root: ${proposal.targetFile}` };
    }
    try {
      const document = readJsonFn(targetPath, {});
      const patched = applyProposalPatch(document, proposal);
      await writeJsonFn(targetPath, patched);
      trackingBefore = document;
      trackingAfter = patched;
      patchApplied = true;
    } catch (err) {
      return { ok: false, proposalId, status: "error", message: `Patch apply failed: ${err.message}` };
    }
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
        id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(), modeId: proposal.modeId || "", sceneId: proposal.sceneId || "",
        source: "proposal-bus", proposalId: proposal.id, moduleId: proposal.moduleId || "",
        targetFile: proposal.targetFile, fieldPath: proposal.fieldPath || "", oldValue: proposal.oldValue ?? trackingBefore,
        newValue: proposal.newValue ?? trackingAfter, reason: proposal.reason || proposal.summary || "",
        changeType: proposal.changeType || "state_update", impactLevel: proposal.impactLevel || "medium",
        rippleDepth: Number(proposal.rippleDepth || 0), causedBy: proposal.causedBy || null
      });
    } catch (err) {
      return { ok: false, proposalId, status: "error", patchApplied, message: `Tracking append failed: ${err.message}` };
    }
  }

  return { ok: true, proposalId, status: "approved", patchApplied, message: "proposal approved and patch applied" };
}

/**
 * 真实 reject proposal：只改状态，不改 shared。
 */
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

  return { ok: true, proposalId, status: "rejected", message: "proposal rejected, shared files unchanged" };
}

export function listPendingProposals(project = {}, options = {}) {
  return {
    proposals: Array.isArray(project.proposals)
      ? project.proposals.filter(p => p.status === "pending")
      : []
  };
}

export function createProposalSummary(proposal = {}) {
  return { id: proposal.id, type: proposal.type, status: proposal.status };
}
