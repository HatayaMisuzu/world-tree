import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { OVERLAY_FILES, WRITE_POLICY, splitWriteSet } from "../core/engine/overlay-store.js";

export const ALLOWED_OVERLAY_FILES = new Set(Object.values(OVERLAY_FILES));

function payloadOf(op = {}) {
  return op.payload ?? op.value ?? {};
}

function modeOf(op = {}) {
  return op.op || op.mode || "merge-json";
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function readJsonSync(filePath, fallback) {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function appendJsonl(filePath, data) {
  await ensureDir(dirname(filePath));
  await appendFile(filePath, `${JSON.stringify(data)}\n`, "utf-8");
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

async function appendQueue(runtimeDir, file, entries) {
  for (const entry of entries) {
    await appendJsonl(join(runtimeDir, "overlay", file), entry);
  }
}

export async function applyOverlayWriteSet(runtimeDir, writeSet = []) {
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
  })));
  await appendQueue(runtimeDir, OVERLAY_FILES.MANUAL, manual.map((op) => ({
    ...op,
    policy: WRITE_POLICY.MANUAL_ONLY.level,
    queuedAt: new Date().toISOString(),
    reason: "manual-only or unknown overlay file"
  })));

  return {
    auto: auto.length,
    pending: pending.length,
    manual: manual.length,
    written
  };
}
