// tests/integration/user-data-isolation.test.js
// P0: Verify WORLD_TREE_USER_DATA_DIR test isolation — no real userData pollution
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

const ROOT = resolve(".");
const REAL_USERDATA_DIR = join(ROOT, "userData");

async function sha256(filePath) {
  try {
    const buf = await readFile(filePath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return "MISSING";
  }
}

const WATCHED_FILES = ["config.json", "connections.json", "secrets.json", "corrupt-files.jsonl"];

describe("P0 userData isolation", () => {
  let baselineHashes = {};
  let dataDir = null;
  let server = null;

  before(async () => {
    // Record baseline hashes BEFORE any server starts
    for (const f of WATCHED_FILES) {
      baselineHashes[f] = await sha256(join(REAL_USERDATA_DIR, f));
    }
    dataDir = await createTempDataDir("world-tree-isolation-");
  });

  after(async () => {
    if (server) await server.stop();
    await removeTempDir(dataDir);
    // also clean up the auto-created .userData sibling
    if (dataDir) {
      const siblingUserData = join(dataDir, "..", ".userData");
      await removeTempDir(siblingUserData);
    }
  });

  it("starts server with isolated userData dir", async () => {
    server = await startWorldTreeServer({ dataDir });
    assert.ok(server.port > 0, "server should start on a port");
    assert.ok(server.baseUrl, "server should have a baseUrl");
  });

  it("real userData files are unchanged after server start + basic API calls", async () => {
    const base = server.baseUrl;

    // health
    const h = await fetch(`${base}/api/health`);
    assert.equal(h.status, 200);

    // modules list (touches config/secrets read paths via module-service)
    const m = await fetch(`${base}/api/modules`);
    // may or may not return 200 depending on test data — just want to exercise paths
    await m.text();

    // debug/status (touches write-probe, connections, etc.)
    const s = await fetch(`${base}/api/debug/status`);
    await s.text();

    // Now verify all watched real userData files have unchanged hashes
    for (const f of WATCHED_FILES) {
      const current = await sha256(join(REAL_USERDATA_DIR, f));
      const baseline = baselineHashes[f];
      if (baseline === "MISSING" && current === "MISSING") continue;
      assert.equal(
        current,
        baseline,
        `real userData/${f} hash changed after isolated server run (baseline=${baseline?.slice(0, 12)}..., current=${current?.slice(0, 12)}...)`
      );
    }
  });

  it("test writes go to temp WORLD_TREE_USER_DATA_DIR, not real userData", async () => {
    // The server's getUserDataRoot() should point to the temp dir.
    // Verify by checking that the temp .userData directory exists and real userData unchanged.
    const userDataDir = join(dataDir, "..", ".userData");
    try {
      await access(userDataDir);
    } catch {
      assert.fail(`expected temp userData dir to exist at ${userDataDir}`);
    }

    // Final check: real userData hashes still unchanged
    for (const f of WATCHED_FILES) {
      const current = await sha256(join(REAL_USERDATA_DIR, f));
      const baseline = baselineHashes[f];
      if (baseline === "MISSING" && current === "MISSING") continue;
      assert.equal(current, baseline, `real userData/${f} hash changed`);
    }
  });
});
