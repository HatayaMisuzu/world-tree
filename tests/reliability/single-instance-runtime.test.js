import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

import { dataRootFingerprint } from "../../src/server/single-instance-runtime.js";
import { api, createTempDataDir, randomPort, removeTempDir, startWorldTreeServer } from "../integration/helpers/server-process.js";

function serverEnv(dataDir, port = randomPort(), userDataDir = join(dataDir, ".userData")) {
  return {
    ...process.env,
    PORT: String(port),
    WORLD_TREE_HOST: "127.0.0.1",
    WORLD_TREE_DATA_DIR: dataDir,
    WORLD_TREE_USER_DATA_DIR: userDataDir,
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

async function managedState(userDataDir) {
  const paths = ["config.json", "secrets.json", "connections.json"].map((name) => join(userDataDir, name));
  return Promise.all(paths.map(async (path) => {
    try { return await readFile(path, "utf8"); } catch { return null; }
  }));
}

test("a second Node process reuses the healthy instance for the same data root without writes", async () => {
  const dataDir = await createTempDataDir("world-tree-single-instance-");
  const first = await startWorldTreeServer({ dataDir });
  try {
    const before = await managedState(join(dataDir, ".userData"));
    const lockPath = join(dataDir, ".runtime", "world-tree-instance.json");
    const firstLock = JSON.parse(await readFile(lockPath, "utf8"));

    const second = await runServerToExit(serverEnv(dataDir));
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, new RegExp(`WORLD_TREE_EXISTING_INSTANCE_URL=${first.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    const launcher = await runProcessToExit({ ...serverEnv(dataDir), WORLD_TREE_NO_BROWSER: "1" }, ["scripts/start-local.mjs"]);
    assert.equal(launcher.code, 0, launcher.stderr);
    assert.match(launcher.stdout, /WORLD_TREE_EXISTING_INSTANCE_URL=/);
    assert.equal((await api(first, "/api/health")).body.status, "ok");
    assert.deepEqual(await managedState(join(dataDir, ".userData")), before);
    const afterLock = JSON.parse(await readFile(lockPath, "utf8"));
    assert.equal(afterLock.instanceId, firstLock.instanceId);
    assert.equal(afterLock.pid, first.child.pid);
  } finally {
    await first.stop();
    await removeTempDir(dataDir);
  }
});

test("twelve simultaneous processes elect exactly one owner for a data root", async () => {
  const dataDir = await createTempDataDir("world-tree-instance-contention-");
  const children = [];
  try {
    const env = serverEnv(dataDir, randomPort());
    for (let index = 0; index < 12; index += 1) {
      const child = spawn(process.execPath, ["server.js"], { cwd: resolve("."), env, stdio: ["ignore", "pipe", "pipe"] });
      const result = { child, stdout: "", stderr: "" };
      child.stdout.on("data", (chunk) => { result.stdout += chunk.toString("utf8"); });
      child.stderr.on("data", (chunk) => { result.stderr += chunk.toString("utf8"); });
      children.push(result);
    }
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && !children.some(({ stdout }) => stdout.includes("World Tree Web 服务启动"))) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    }
    const owners = children.filter(({ stdout }) => stdout.includes("World Tree Web 服务启动"));
    assert.equal(owners.length, 1, children.map(({ stdout, stderr }) => `${stdout}\n${stderr}`).join("\n---\n"));
    const owner = owners[0].child;
    owner.kill("SIGTERM");
    await Promise.race([once(owner, "exit"), new Promise((resolveDelay) => setTimeout(resolveDelay, 1500))]);
    for (const { child } of children) {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  } finally {
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
      dataRootFingerprint: dataRootFingerprint(dataDir),
      userDataRootFingerprint: dataRootFingerprint(join(dataDir, ".userData"))
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
      dataRootFingerprint: dataRootFingerprint(dataDir),
      userDataRootFingerprint: dataRootFingerprint(join(dataDir, ".userData"))
    }));
    const before = await managedState(join(dataDir, ".userData"));
    const blocked = await runServerToExit(serverEnv(dataDir));
    assert.equal(blocked.code, 1);
    assert.match(blocked.stderr, /WORLD_TREE_INSTANCE_LOCK_UNVERIFIED=health_unavailable/);
    assert.deepEqual(await managedState(join(dataDir, ".userData")), before);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).instanceId, "live-unverified");
  } finally {
    await removeTempDir(dataDir);
  }
});

test("a shared user-data root rejects a second, different data root without writes", async () => {
  const dataA = await createTempDataDir("world-tree-data-a-");
  const dataB = await createTempDataDir("world-tree-data-b-");
  const sharedUserData = await createTempDataDir("world-tree-shared-user-");
  const first = await startWorldTreeServer({ dataDir: dataA, env: { WORLD_TREE_USER_DATA_DIR: sharedUserData } });
  try {
    const before = await managedState(sharedUserData);
    const second = await runServerToExit(serverEnv(dataB, randomPort(), sharedUserData));
    assert.equal(second.code, 1, second.stdout);
    assert.match(second.stderr, /WORLD_TREE_INSTANCE_LOCK_UNVERIFIED=lock_metadata_invalid/);
    assert.deepEqual(await managedState(sharedUserData), before);
  } finally {
    await first.stop();
    await removeTempDir(dataA);
    await removeTempDir(dataB);
    await removeTempDir(sharedUserData);
  }
});
