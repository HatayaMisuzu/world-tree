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
    assert.equal(basic.body.version, "0.5.0-product-experience-rebuild.0");
    assert.equal(typeof basic.body.uptime, "number");
    assert.equal(typeof basic.body.llmConfigured, "boolean");
    assert.equal(typeof basic.body.dataWritable, "boolean");
    // 默认不包含 data、llm 详细信息
    assert.equal("data" in basic.body, false);
    assert.equal("llm" in basic.body, false);

    const full = await api(server, "/api/health?detail=full&checkLlm=false");
    assert.equal(full.status, 200);
    assert.equal(full.body.data.root, dataDir);
    assert.equal(typeof full.body.data.sizeBytes, "number");
    assert.equal(typeof full.body.data.sizeTruncated, "boolean");
    assert.equal(typeof full.body.data.entries, "number");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("console public static assets include ui-labels", async () => {
  const dataDir = await createTempDataDir("world-tree-static-assets-");
  const server = await startWorldTreeServer({ dataDir });

  try {
    for (const path of [
      "/world-tree-console.css",
      "/world-tree-client-core.js",
      "/ui-labels.js",
      "/browser/styles/tokens.css",
      "/browser/styles/shell.css",
      "/browser/app/product-registry.js",
      "/browser/app/navigation.js",
      "/browser/state/app-store.js",
      "/browser/components/product-components.js",
      "/browser/views/core-views.js",
      "/browser/controllers/navigation-controller.js",
      "/world-tree-console.js"
    ]) {
      const response = await fetch(`${server.baseUrl}${path}`);
      assert.equal(response.status, 200, `${path} should be served`);
      const text = await response.text();
      assert.ok(text.length > 0, `${path} should not be empty`);
    }
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
