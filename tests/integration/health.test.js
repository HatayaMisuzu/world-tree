import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("health defaults to lightweight local status and full detail computes size", async () => {
  const dataDir = await createTempDataDir("world-tree-health-");
  const server = await startWorldTreeServer({ dataDir });

  try {
    await writeFile(join(dataDir, "probe.txt"), "hello", "utf-8");

    const basic = await api(server, "/api/health");
    assert.equal(basic.status, 200);
    assert.equal(basic.body.status, "ok");
    assert.equal(basic.body.data.root, dataDir);
    assert.equal("sizeBytes" in basic.body.data, false);
    assert.equal(["configured", "not_configured"].includes(basic.body.llm.status), true);

    const full = await api(server, "/api/health?detail=full&checkLlm=false");
    assert.equal(full.status, 200);
    assert.equal(typeof full.body.data.sizeBytes, "number");
    assert.equal(typeof full.body.data.sizeTruncated, "boolean");
    assert.equal(typeof full.body.data.entries, "number");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
