import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ensureDir, writeJson } from "../shared/fs-utils.js";

const HEALTH_TIMEOUT_MS = 900;

export function dataRootFingerprint(dataRoot) {
  return createHash("sha256").update(resolve(dataRoot)).digest("hex");
}

function isPidAlive(pid, processRef = process) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    processRef.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function localUrl(host, port) {
  const safeHost = ["127.0.0.1", "localhost", "::1"].includes(host) ? host : "";
  if (!safeHost || !Number.isInteger(port) || port < 1 || port > 65535) return "";
  return `http://${safeHost === "::1" ? "[::1]" : safeHost}:${port}`;
}

/** Enforces one World Tree HTTP server per data root across Node processes. */
export function createSingleInstanceRuntime({ dataRoot, host = "127.0.0.1", fetchImpl = fetch, processRef = process } = {}) {
  if (!dataRoot) throw new TypeError("dataRoot is required");
  const rootFingerprint = dataRootFingerprint(dataRoot);
  const lockPath = join(resolve(dataRoot), ".runtime", "world-tree-instance.json");
  const instanceId = randomUUID();
  let owned = false;
  let record = null;

  function publicInfo() {
    return owned ? { instanceId, dataRootFingerprint: rootFingerprint } : null;
  }

  async function readLock() {
    try {
      return JSON.parse(await readFile(lockPath, "utf8"));
    } catch {
      return null;
    }
  }

  async function verifyExisting(existing) {
    const pid = Number(existing?.pid);
    if (!isPidAlive(pid, processRef)) return { status: "stale", reason: "pid_not_alive" };
    const url = localUrl(String(existing?.host || ""), Number(existing?.port));
    if (!url || !existing?.instanceId || existing?.dataRootFingerprint !== rootFingerprint) {
      return { status: "unverified", reason: "lock_metadata_invalid" };
    }
    try {
      const response = await fetchImpl(`${url}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      const health = response.ok ? await response.json() : null;
      if (health?.status === "ok" && health?.instance?.instanceId === existing.instanceId && health?.instance?.dataRootFingerprint === rootFingerprint) {
        return { status: "existing", url, instanceId: existing.instanceId };
      }
      return { status: "unverified", reason: "health_identity_mismatch" };
    } catch {
      return { status: "unverified", reason: "health_unavailable" };
    }
  }

  async function createExclusive() {
    ensureDir(join(resolve(dataRoot), ".runtime"));
    const next = {
      version: 1,
      instanceId,
      pid: processRef.pid,
      port: null,
      host,
      startedAt: new Date().toISOString(),
      dataRootFingerprint: rootFingerprint
    };
    const handle = await open(lockPath, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(next, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    owned = true;
    record = next;
    return { status: "acquired" };
  }

  async function acquire() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await createExclusive();
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
      const existing = await readLock();
      const inspected = await verifyExisting(existing);
      if (inspected.status === "existing" || inspected.status === "unverified") return inspected;
      await rm(lockPath, { force: true });
    }
    return { status: "unverified", reason: "lock_race" };
  }

  async function publish({ port }) {
    if (!owned || !record) throw new Error("Cannot publish an unowned instance lock");
    record = { ...record, port: Number(port) };
    await writeJson(lockPath, record);
    return publicInfo();
  }

  async function release() {
    if (!owned) return false;
    const existing = await readLock();
    if (existing?.instanceId !== instanceId) return false;
    await rm(lockPath, { force: true });
    owned = false;
    return true;
  }

  return { lockPath, dataRootFingerprint: rootFingerprint, publicInfo, acquire, publish, release };
}
