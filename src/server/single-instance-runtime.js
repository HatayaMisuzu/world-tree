import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ensureDir, writeJson } from "../shared/fs-utils.js";

const HEALTH_TIMEOUT_MS = 900;
const INCOMPLETE_LOCK_RETRIES = 3;
const INCOMPLETE_LOCK_RETRY_MS = 25;

export function dataRootFingerprint(root) {
  return createHash("sha256").update(resolve(root)).digest("hex");
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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

/** Enforces one owner for both the engine data root and shared user-data root. */
export function createSingleInstanceRuntime({
  dataRoot,
  userDataRoot = dataRoot,
  host = "127.0.0.1",
  fetchImpl = fetch,
  processRef = process,
  onLockFileCreated = null
} = {}) {
  if (!dataRoot || !userDataRoot) throw new TypeError("dataRoot and userDataRoot are required");
  const dataFingerprint = dataRootFingerprint(dataRoot);
  const userDataFingerprint = dataRootFingerprint(userDataRoot);
  const lockPaths = [...new Set([resolve(dataRoot), resolve(userDataRoot)])]
    .sort()
    .map((root) => join(root, ".runtime", "world-tree-instance.json"));
  const instanceId = randomUUID();
  let ownedLockPaths = [];
  let record = null;

  function publicInfo() {
    return ownedLockPaths.length === lockPaths.length
      ? { instanceId, dataRootFingerprint: dataFingerprint, userDataRootFingerprint: userDataFingerprint }
      : null;
  }

  async function readLock(lockPath) {
    let text;
    try {
      text = await readFile(lockPath, "utf8");
    } catch (error) {
      return error?.code === "ENOENT" ? { kind: "missing" } : { kind: "invalid", reason: "read_error" };
    }
    if (!text.trim()) return { kind: "invalid", reason: "empty" };
    try {
      return { kind: "valid", record: JSON.parse(text) };
    } catch {
      return { kind: "invalid", reason: "invalid_json" };
    }
  }

  async function verifyExisting(existing) {
    const pid = Number(existing?.pid);
    if (!isPidAlive(pid, processRef)) return { status: "stale", reason: "pid_not_alive" };
    const url = localUrl(String(existing?.host || ""), Number(existing?.port));
    if (!url || !existing?.instanceId || existing.dataRootFingerprint !== dataFingerprint || existing.userDataRootFingerprint !== userDataFingerprint) {
      return { status: "unverified", reason: "lock_metadata_invalid" };
    }
    try {
      const response = await fetchImpl(`${url}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      const health = response.ok ? await response.json() : null;
      const instance = health?.instance;
      if (health?.status === "ok" && instance?.instanceId === existing.instanceId && instance.dataRootFingerprint === dataFingerprint && instance.userDataRootFingerprint === userDataFingerprint) {
        return { status: "existing", url, instanceId: existing.instanceId };
      }
      return { status: "unverified", reason: "health_identity_mismatch" };
    } catch {
      return { status: "unverified", reason: "health_unavailable" };
    }
  }

  async function createExclusive(lockPath) {
    ensureDir(join(lockPath, ".."));
    const handle = await open(lockPath, "wx", 0o600);
    try {
      await onLockFileCreated?.({ lockPath, instanceId });
      await handle.writeFile(JSON.stringify(record, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async function releaseLocks(lockPathsToRelease = ownedLockPaths) {
    for (const lockPath of [...lockPathsToRelease].reverse()) {
      const state = await readLock(lockPath);
      if (state.kind === "valid" && state.record.instanceId === instanceId) await rm(lockPath, { force: true });
    }
    ownedLockPaths = ownedLockPaths.filter((lockPath) => !lockPathsToRelease.includes(lockPath));
  }

  async function inspectExisting(lockPath) {
    for (let retry = 0; retry <= INCOMPLETE_LOCK_RETRIES; retry += 1) {
      const state = await readLock(lockPath);
      if (state.kind === "missing") return { status: "retry" };
      if (state.kind === "valid") return verifyExisting(state.record);
      if (retry < INCOMPLETE_LOCK_RETRIES) await delay(INCOMPLETE_LOCK_RETRY_MS);
      else return { status: "unverified", reason: `lock_${state.reason}` };
    }
    return { status: "unverified", reason: "lock_unreadable" };
  }

  async function acquire() {
    record = {
      version: 2,
      instanceId,
      pid: processRef.pid,
      port: null,
      host,
      startedAt: new Date().toISOString(),
      dataRootFingerprint: dataFingerprint,
      userDataRootFingerprint: userDataFingerprint
    };
    for (;;) {
      for (const lockPath of lockPaths) {
        try {
          await createExclusive(lockPath);
          ownedLockPaths.push(lockPath);
          continue;
        } catch (error) {
          if (error?.code !== "EEXIST") {
            await releaseLocks();
            throw error;
          }
        }
        const inspected = await inspectExisting(lockPath);
        if (inspected.status === "retry") {
          await releaseLocks();
          break;
        }
        if (inspected.status === "stale") {
          const state = await readLock(lockPath);
          if (state.kind === "valid" && !isPidAlive(Number(state.record.pid), processRef)) await rm(lockPath, { force: true });
          await releaseLocks();
          break;
        }
        await releaseLocks();
        return inspected;
      }
      if (ownedLockPaths.length === lockPaths.length) return { status: "acquired" };
    }
  }

  async function publish({ port }) {
    if (ownedLockPaths.length !== lockPaths.length || !record) throw new Error("Cannot publish an unowned instance lock");
    record = { ...record, port: Number(port) };
    await Promise.all(ownedLockPaths.map((lockPath) => writeJson(lockPath, record)));
    return publicInfo();
  }

  async function release() {
    if (!ownedLockPaths.length) return false;
    await releaseLocks();
    return true;
  }

  return {
    lockPath: lockPaths[0],
    lockPaths,
    dataRootFingerprint: dataFingerprint,
    userDataRootFingerprint: userDataFingerprint,
    publicInfo,
    acquire,
    publish,
    release
  };
}
