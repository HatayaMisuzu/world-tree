import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeJson, appendJsonl, ensureDir } from "../../server/fs-utils.js";
import { pathWithinRoot } from "../../server/path-security.js";
import { assertModeCanWrite } from "./mode-isolation-policy.js";

export function createWorldTreeSaveSnapshot(project = {}, options = {}) {
  return {
    snapshotVersion: 1,
    projectId: project.id || "",
    mode: project.mode || "",
    files: {
      "world.json": project.world || {},
      "runtime/state.json": project.state || {},
      "runtime/chat.jsonl": project.chat || "",
      "shared/": project.shared || {}
    },
    exportedAt: new Date().toISOString()
  };
}

export function validateWorldTreeSaveSnapshot(snapshot = {}) {
  return {
    ok: Boolean(snapshot.snapshotVersion && snapshot.projectId),
    errors: snapshot.snapshotVersion ? [] : ["invalid snapshot"]
  };
}

/**
 * 真实写入 turn 到 chat.jsonl。
 * 写 user input / assistantMessage / modeId / turnId / createdAt。
 */
export async function writeModeTurnToSave(project = {}, outputPacket = {}, services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const appendJsonlFn = services.appendJsonl || appendJsonl;
  const ensureDirFn = services.ensureDir || ensureDir;

  if (!projectRoot) {
    return { ok: false, error: { code: "NO_PROJECT_ROOT", message: "projectRoot required" } };
  }

  const chatPath = join(projectRoot, "runtime", "chat.jsonl");
  const entry = {
    turnId: outputPacket.turnId || `turn_${Date.now()}`,
    modeId: outputPacket.modeId || project.mode || "",
    userInput: outputPacket.userInput || "",
    assistantMessage: outputPacket.assistantMessage?.text || "",
    proposals: (outputPacket.proposals || []).map(p => p.id),
    createdAt: new Date().toISOString()
  };

  try {
    ensureDirFn(join(projectRoot, "runtime"));
    await appendJsonlFn(chatPath, entry);
    return { ok: true, chatEntry: entry, chatPath };
  } catch (err) {
    return { ok: false, error: { code: "CHAT_WRITE_FAILED", message: err.message } };
  }
}

/**
 * 真实写入 runtime/cache 文件。
 * cacheWrites 每项必须包含 relativePath 和 json。
 */
export async function writeModeCache(project = {}, cacheWrites = [], services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const writeJsonFn = services.writeJson || writeJson;
  const pathCheck = services.pathWithinRoot || pathWithinRoot;
  const ensureDirFn = services.ensureDir || ensureDir;

  if (!projectRoot) {
    return { ok: false, error: { code: "NO_PROJECT_ROOT", message: "projectRoot required" } };
  }

  const written = [];
  const errors = [];

  for (const entry of cacheWrites) {
    if (!entry.relativePath) {
      errors.push({ code: "MISSING_PATH", entry });
      continue;
    }
    if (!entry.json) {
      errors.push({ code: "MISSING_JSON", entry });
      continue;
    }

    const targetPath = join(projectRoot, entry.relativePath);
    if (!pathCheck(projectRoot, targetPath)) {
      errors.push({ code: "PATH_UNSAFE", path: entry.relativePath });
      continue;
    }

    // 模式隔离检查：不允许跨模式写 cache（仅当 modeId 已知时检查）
    const modeId = options.modeId || project.mode || "";
    if (modeId) {
      const writeCheck = assertModeCanWrite(modeId, entry.relativePath, {
        allowedNamespaces: options.cacheNamespaces || []
      });
      if (!writeCheck.allowed) {
        errors.push({ code: "ISOLATION_BLOCKED", path: entry.relativePath, reason: writeCheck.reason });
        continue;
      }
    }

    try {
      ensureDirFn(join(targetPath, ".."));
      await writeJsonFn(targetPath, entry.json);
      written.push(entry.relativePath);
    } catch (err) {
      errors.push({ code: "WRITE_FAILED", path: entry.relativePath, message: err.message });
    }
  }

  return {
    ok: errors.length === 0,
    entriesWritten: written.length,
    written,
    errors
  };
}

/**
 * 真实 append proposal 到对应 proposal log。
 */
export async function appendModeProposal(project = {}, proposal = {}, services = {}, options = {}) {
  const projectRoot = services.projectRoot || project.projectRoot || "";
  const appendJsonlFn = services.appendJsonl || appendJsonl;
  const ensureDirFn = services.ensureDir || ensureDir;

  if (!projectRoot) {
    return { ok: false, error: { code: "NO_PROJECT_ROOT", message: "projectRoot required" } };
  }

  const logPath = project.proposalLog || join(projectRoot, "runtime", "world-proposals.jsonl");
  const entry = {
    ...proposal,
    id: proposal.id || `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: proposal.status || "pending",
    createdAt: proposal.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    ensureDirFn(join(logPath, ".."));
    await appendJsonlFn(logPath, entry);
    return { ok: true, proposalId: entry.id, status: entry.status, logPath };
  } catch (err) {
    return { ok: false, error: { code: "PROPOSAL_WRITE_FAILED", message: err.message } };
  }
}

export function exportWorldTreeSave(project = {}, options = {}) {
  const snapshot = createWorldTreeSaveSnapshot(project, options);
  return {
    ok: true,
    status: "partial",
    kind: "snapshot_bridge",
    snapshot,
    filename: `${project.id || "project"}.worldtree`,
    warnings: [
      "Full archive export is handled by legacy world-pack export APIs. This function provides a lightweight snapshot bridge."
    ]
  };
}

export function importWorldTreeSave(archive = {}, options = {}) {
  return {
    ok: true,
    projectId: archive.projectId || `imported_${Date.now().toString(36)}`,
    mode: archive.mode || ""
  };
}
