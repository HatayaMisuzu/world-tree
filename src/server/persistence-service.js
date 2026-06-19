import { join } from "node:path";
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
    id: entry.id || `review-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
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
    const id = entry.id || `overlay-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
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

export async function applyOverlayWriteSet(runtimeDir, writeSet = [], context = {}) {
  const { auto, pending, manual } = splitWriteSet(writeSet);
  const written = [];

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
