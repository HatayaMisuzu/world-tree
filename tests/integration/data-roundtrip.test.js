import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("data export/import roundtrip creates a new world with valid files", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    // Create source world
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "roundtrip_source",
        displayName: "Roundtrip Source",
        dataMode: "worldbook",
        subType: "classic",
        preset: "epic"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");

    const sourceDir = join(dataDir, "engine", "worlds", "roundtrip_source");
    assert.equal(existsSync(sourceDir), true);

    // Export — actual API: /api/world-pack/export?moduleKey=...
    // Returns { status, filename, pack: { files: {...} } }
    const exported = await api(server, "/api/world-pack/export?moduleKey=roundtrip_source");
    assert.equal(exported.status, 200);
    assert.ok(exported.body.pack?.files);
    assert.ok(exported.body.pack.files["world.json"]);
    assert.ok(exported.body.pack.files["shared/worldbook.json"]);

    // Import — actual API: /api/world-pack/import
    // Expects { pack: { spec, files, world }, confirm: true }
    const imported = await api(server, "/api/world-pack/import", {
      method: "POST",
      body: JSON.stringify({
        pack: exported.body.pack,
        confirm: true,
        name: "roundtrip_imported"
      })
    });

    assert.equal(imported.status, 200);
    assert.equal(imported.body.status, "ok");

    const importedDir = join(dataDir, "engine", "worlds", "roundtrip_imported");
    assert.equal(existsSync(join(importedDir, "world.json")), true);
    assert.equal(existsSync(join(importedDir, "shared", "worldbook.json")), true);
    assert.equal(existsSync(join(importedDir, "runtime", "state.json")), true);

    const importedWorld = JSON.parse(readFileSync(join(importedDir, "world.json"), "utf8"));
    assert.ok(importedWorld.name || importedWorld.displayName);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
