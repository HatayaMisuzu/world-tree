import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSingleInstanceRuntime, dataRootFingerprint } from "../../src/server/single-instance-runtime.js";

function liveProcess(pid = 4242) {
  return { pid, kill() {} };
}

async function withTempRoot(run) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-instance-unit-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("single-instance runtime publishes and health-verifies its existing owner", async () => {
  await withTempRoot(async (root) => {
    const owner = createSingleInstanceRuntime({ dataRoot: root, processRef: liveProcess() });
    assert.equal((await owner.acquire()).status, "acquired");
    const publicInfo = await owner.publish({ port: 3011 });
    const contender = createSingleInstanceRuntime({
      dataRoot: root,
      processRef: liveProcess(),
      fetchImpl: async () => ({ ok: true, json: async () => ({ status: "ok", instance: publicInfo }) })
    });
    assert.deepEqual(await contender.acquire(), {
      status: "existing",
      url: "http://127.0.0.1:3011",
      instanceId: publicInfo.instanceId
    });
    assert.equal(await owner.release(), true);
  });
});

test("single-instance runtime replaces a stale lock and preserves an unverifiable live lock", async () => {
  await withTempRoot(async (root) => {
    const lockPath = join(root, ".runtime", "world-tree-instance.json");
    await mkdir(join(root, ".runtime"), { recursive: true });
    const stale = {
      instanceId: "stale",
      pid: 9,
      port: 3012,
      host: "127.0.0.1",
      dataRootFingerprint: dataRootFingerprint(root)
    };
    await writeFile(lockPath, JSON.stringify(stale));
    const staleProcess = { pid: 11, kill() { const error = new Error("gone"); error.code = "ESRCH"; throw error; } };
    const replacement = createSingleInstanceRuntime({ dataRoot: root, processRef: staleProcess });
    assert.equal((await replacement.acquire()).status, "acquired");
    assert.notEqual(JSON.parse(await readFile(lockPath, "utf8")).instanceId, stale.instanceId);
    await replacement.release();

    const live = { ...stale, instanceId: "live", pid: 12 };
    await writeFile(lockPath, JSON.stringify(live));
    const blocked = createSingleInstanceRuntime({ dataRoot: root, processRef: liveProcess(12), fetchImpl: async () => { throw new Error("offline"); } });
    assert.deepEqual(await blocked.acquire(), { status: "unverified", reason: "health_unavailable" });
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).instanceId, "live");
  });
});
