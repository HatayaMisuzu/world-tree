import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("module lifecycle: create, list, load through health data root, delete", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    // Create module — actual API: /api/modules/create
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "integration_world",
        displayName: "Integration World",
        dataMode: "worldbook",
        subType: "classic",
        preset: "epic"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");
    assert.equal(create.body.module.id, "integration_world");

    // Verify directory structure
    const worldDir = join(dataDir, "engine", "worlds", "integration_world");
    assert.equal(existsSync(join(worldDir, "world.json")), true);
    assert.equal(existsSync(join(worldDir, "shared", "worldbook.json")), true);
    assert.equal(existsSync(join(worldDir, "runtime", "state.json")), true);
    assert.equal(existsSync(join(worldDir, "runtime", "chat.jsonl")), true);

    // List modules — actual API: /api/modules (returns array directly)
    const list = await api(server, "/api/modules");
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body));
    assert.ok(list.body.some((item) => item.id === "integration_world"));

    // Health check — data.root should reflect override
    const health = await api(server, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.data.root, dataDir);

    // Delete module — actual API: /api/modules/delete with { id: "..." }
    const del = await api(server, "/api/modules/delete", {
      method: "POST",
      body: JSON.stringify({ id: "integration_world" })
    });

    assert.equal(del.status, 200);
    assert.equal(del.body.status, "ok");
    assert.equal(existsSync(worldDir), false);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
