import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { SLASH_WRITE_OP, isSlashWriteOp } from "../core/engine/slash-persistence.js";
import { stableId, withoutWallClock } from "../shared/determinism.js";
import { OVERLAY_FILES, WRITE_POLICY, splitWriteSet } from "../core/engine/overlay-store.js";
import { appendJsonl, readJsonSync, writeJson } from "./fs-utils.js";

export const ALLOWED_OVERLAY_FILES = new Set(Object.values(OVERLAY_FILES));

function payloadOf(op = {}) {
  return op.payload ?? op.value ?? {};
}

function modeOf(op = {}) {
  return op.op || op.mode || "merge-json";
}

function reviewRecordFromOverlay(entry = {}, status = "pending", index = 0, context = {}) {
  const now = new Date().toISOString();
  const payload = payloadOf(entry);
  return {
    id: entry.id || stableId("review", status, index, entry.id || "", context.round ?? ""),
    status,
    createdAt: entry.createdAt || entry.queuedAt || now,
    source: entry.source || "overlay-write-set",
    moduleId: context.moduleId || entry.moduleId || "",
    targetType: entry.targetType || "overlay",
    operation: modeOf(entry),
    confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : 0.5,
    file: entry.file || "",
    before: entry.before || null,
    after: entry.after ?? payload,
    sourceSnippet: entry.sourceSnippet || entry.reason || "",
    reason: entry.reason || "",
    overlay: entry
  };
}

export function resolveOverlayPath(runtimeDir, op = {}) {
  const file = String(op.file || "");
  if (!ALLOWED_OVERLAY_FILES.has(file)) {
    const err = new Error(`Unknown overlay file: ${file || "(missing)"}`);
    err.code = "OVERLAY_FILE_NOT_ALLOWED";
    throw err;
  }
  return join(runtimeDir, "overlay", file);
}

export async function applyOverlayOperation(runtimeDir, op = {}) {
  const filePath = resolveOverlayPath(runtimeDir, op);
  const mode = modeOf(op);
  const payload = payloadOf(op);

  if (mode === "append-json-array") {
    const existing = readJsonSync(filePath, []);
    const next = Array.isArray(existing) ? existing : [];
    next.push(...(Array.isArray(payload) ? payload : [payload]));
    await writeJson(filePath, next.slice(-200));
    return { file: op.file, mode, status: "written" };
  }
  if (mode === "merge-json") {
    const existing = readJsonSync(filePath, {});
    await writeJson(filePath, { ...(existing && typeof existing === "object" ? existing : {}), ...(payload || {}) });
    return { file: op.file, mode, status: "written" };
  }
  if (mode === "write-json") {
    await writeJson(filePath, payload || {});
    return { file: op.file, mode, status: "written" };
  }
  if (mode === "append-jsonl") {
    await appendJsonl(filePath, payload || {});
    return { file: op.file, mode, status: "written" };
  }

  const err = new Error(`Unsupported overlay operation mode: ${mode}`);
  err.code = "OVERLAY_MODE_NOT_SUPPORTED";
  throw err;
}

async function appendQueue(runtimeDir, file, entries, context = {}) {
  for (const [index, entry] of entries.entries()) {
    const id = entry.id || stableId("overlay", file, context.round ?? context.turnId ?? "", index, withoutWallClock(entry));
    const queued = { ...entry, id };
    await appendJsonl(join(runtimeDir, "overlay", file), {
      ...queued
    });
    if (file === OVERLAY_FILES.PENDING) {
      await appendJsonl(join(runtimeDir, "pending.jsonl"), reviewRecordFromOverlay(queued, "pending", index, context));
    }
    if (file === OVERLAY_FILES.MANUAL) {
      await appendJsonl(join(runtimeDir, "manual.jsonl"), reviewRecordFromOverlay(queued, "manual", index, context));
    }
  }
}

function safeFileStem(name = "") {
  return String(name || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\.\.+/g, "_").slice(0, 120) || "archive";
}

/** Deterministic, never-overwriting allocation: stem, stem-2, stem-3 … against what is on disk. */
export function allocateFreePath(dir, stem, ext = "") {
  let candidate = join(dir, `${stem}${ext}`);
  for (let n = 2; existsSync(candidate); n += 1) candidate = join(dir, `${stem}-${n}${ext}`);
  return candidate;
}

/** Writes archive-save / world-copy slash results. Auto-named archives and world copies never overwrite. */
export function applySlashWriteOps(runtimeDir, ops = [], context = {}) {
  const written = [];
  for (const op of ops) {
    if (op.op === SLASH_WRITE_OP.ARCHIVE) {
      const dir = join(runtimeDir, "archives");
      mkdirSync(dir, { recursive: true });
      const stem = safeFileStem(op.name);
      const target = op.overwrite ? join(dir, `${stem}.json`) : allocateFreePath(dir, stem, ".json");
      const finalName = basename(target, ".json");
      writeFileSync(target, `${JSON.stringify({ ...op.payload, name: finalName, requestedName: op.name, round: context.round ?? op.payload?.round }, null, 2)}\n`, { flag: op.overwrite ? "w" : "wx" });
      written.push({ op: op.op, path: target, name: finalName, receipt: `【系统】存档「${finalName}」已保存（文件 archives/${finalName}.json）。` });
    } else if (op.op === SLASH_WRITE_OP.WORLD_COPY) {
      const worldsRoot = context.projectRoot ? dirname(context.projectRoot) : "";
      const source = safeFileStem(op.source);
      const sourceDir = worldsRoot ? join(worldsRoot, source) : "";
      if (!sourceDir || source !== op.source || !existsSync(join(sourceDir, "world.json"))) {
        written.push({ op: op.op, skipped: "source-world-not-found", source: op.source, receipt: `【系统】世界复制未执行：找不到源世界「${op.source}」。` });
        continue;
      }
      const target = allocateFreePath(worldsRoot, safeFileStem(op.target));
      cpSync(sourceDir, target, { recursive: true, errorOnExist: true, force: false });
      written.push({ op: op.op, path: target, name: basename(target), receipt: `【系统】世界「${source}」已复制为「${basename(target)}」。` });
    }
  }
  return written;
}

export async function applyOverlayWriteSet(runtimeDir, writeSet = [], context = {}) {
  const slashOps = writeSet.filter(isSlashWriteOp);
  const { auto, pending, manual } = splitWriteSet(writeSet.filter((op) => !isSlashWriteOp(op)));
  const written = applySlashWriteOps(runtimeDir, slashOps, context);

  for (const op of auto) {
    written.push(await applyOverlayOperation(runtimeDir, {
      ...op,
      policy: WRITE_POLICY.AUTO.level
    }));
  }

  await appendQueue(runtimeDir, OVERLAY_FILES.PENDING, pending.map((op) => ({
    ...op,
    policy: WRITE_POLICY.CONFIRM.level,
    queuedAt: new Date().toISOString()
  })), context);
  await appendQueue(runtimeDir, OVERLAY_FILES.MANUAL, manual.map((op) => ({
    ...op,
    policy: WRITE_POLICY.MANUAL_ONLY.level,
    queuedAt: new Date().toISOString(),
    reason: "manual-only or unknown overlay file"
  })), context);

  return {
    auto: auto.length,
    pending: pending.length,
    manual: manual.length,
    written
  };
}
