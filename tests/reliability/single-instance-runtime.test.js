import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { dataRootFingerprint } from "../../src/server/single-instance-runtime.js";
import { api, createTempDataDir, randomPort, removeTempDir, startWorldTreeServer } from "../integration/helpers/server-process.js";

function serverEnv(dataDir, port = randomPort()) {
  return {
    ...process.env,
    PORT: String(port),
    WORLD_TREE_HOST: "127.0.0.1",
    WORLD_TREE_DATA_DIR: dataDir,
    WORLD_TREE_USER_DATA_DIR: join(dataDir, ".userData"),
    WORLD_TREE_DISABLE_UPDATE_CHECK: "1"
  };
}

async function runProcessToExit(env, args = ["server.js"]) {
  const child = spawn(process.execPath, args, { cwd: resolve("."), env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  const outcome = await Promise.race([
    once(child, "exit").then(([code, signal]) => ({ code, signal })),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`process did not exit\nstdout:\n${stdout}\nstderr:\n${stderr}`)), 8000))
  ]);
  return { ...outcome, stdout, stderr };
}

function runServerToExit(env) {
  return runProcessToExit(env);
}

async function managedState(root) {
  const paths = ["config.json", "secrets.json", "connections.json"].map((name) => join(root, ".userData", name));
  return Promise.all(paths.map(async (path) => {
    try { return await readFile(path, "utf8"); } catch { return null; }
  }));
}

test("a second Node process reuses the healthy instance for the same data root without writes", async () => {
  const dataDir = await createTempDataDir("world-tree-single-instance-");
  const first = await startWorldTreeServer({ dataDir });
  try {
    const before = await managedState(dataDir);
    const lockPath = join(dataDir, ".runtime", "world-tree-instance.json");
    const firstLock = JSON.parse(await readFile(lockPath, "utf8"));

    const second = await runServerToExit(serverEnv(dataDir));
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, new RegExp(`WORLD_TREE_EXISTING_INSTANCE_URL=${first.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    const launcher = await runProcessToExit({ ...serverEnv(dataDir), WORLD_TREE_NO_BROWSER: "1" }, ["scripts/start-local.mjs"]);
    assert.equal(launcher.code, 0, launcher.stderr);
    assert.match(launcher.stdout, /WORLD_TREE_EXISTING_INSTANCE_URL=/);
    assert.equal((await api(first, "/api/health")).body.status, "ok");
    assert.deepEqual(await managedState(dataDir), before);
    const afterLock = JSON.parse(await readFile(lockPath, "utf8"));
    assert.equal(afterLock.instanceId, firstLock.instanceId);
    assert.equal(afterLock.pid, first.child.pid);
  } finally {
    await first.stop();
    await removeTempDir(dataDir);
  }
});

test("a stale lock is replaced by a newly started instance", async () => {
  const dataDir = await createTempDataDir("world-tree-stale-instance-");
  try {
    const lockPath = join(dataDir, ".runtime", "world-tree-instance.json");
    await mkdir(join(dataDir, ".runtime"), { recursive: true });
    await writeFile(lockPath, JSON.stringify({
      version: 1,
      instanceId: "stale-instance",
      pid: 99999999,
      port: randomPort(),
      host: "127.0.0.1",
      startedAt: "2000-01-01T00:00:00.000Z",
      dataRootFingerprint: dataRootFingerprint(dataDir)
    }));
    const server = await startWorldTreeServer({ dataDir });
    try {
      const lock = JSON.parse(await readFile(lockPath, "utf8"));
      assert.notEqual(lock.instanceId, "stale-instance");
      assert.equal(lock.pid, server.child.pid);
      assert.equal((await api(server, "/api/health")).body.instance.instanceId, lock.instanceId);
    } finally {
      await server.stop();
    }
  } finally {
    await removeTempDir(dataDir);
  }
});

test("a live but unverified lock fails safe without touching managed state", async () => {
  const dataDir = await createTempDataDir("world-tree-live-lock-");
  try {
    const lockPath = join(dataDir, ".runtime", "world-tree-instance.json");
    await mkdir(join(dataDir, ".runtime"), { recursive: true });
    await mkdir(join(dataDir, ".userData"), { recursive: true });
    await writeFile(lockPath, JSON.stringify({
      version: 1,
      instanceId: "live-unverified",
      pid: process.pid,
      port: randomPort(),
      host: "127.0.0.1",
      startedAt: new Date().toISOString(),
      dataRootFingerprint: dataRootFingerprint(dataDir)
    }));
    const before = await managedState(dataDir);
    const blocked = await runServerToExit(serverEnv(dataDir));
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /WORLD_TREE_INSTANCE_LOCK_UNVERIFIED=health_unavailable/);
    assert.deepEqual(await managedState(dataDir), before);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).instanceId, "live-unverified");
  } finally {
    await removeTempDir(dataDir);
  }
});
