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

async function withServer(fn) {
  const dataDir = await createTempDataDir("world-tree-worldpack-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    await fn(server, dataDir);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
}

function samplePack(name = "pack_source") {
  return {
    format: "worldtree-pack",
    schemaVersion: "0.3.0",
    spec: "worldtree-pack",
    world: { id: name, name, displayName: "Pack Source", description: "fixture" },
    contents: { worldbook: true, characters: true, runtimeState: true, reviewQueue: false },
    files: {
      "world.json": { name, displayName: "Pack Source", dataMode: "worldbook", subType: "classic" },
      "shared/worldbook.json": { entries: [] },
      "shared/characters.json": [],
      "runtime/state.json": { turnCount: 7 }
    }
  };
}

test("worldpack preview reports schema, contents, runtime and conflict status", async () => {
  await withServer(async (server) => {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "pack_source", displayName: "Existing" })
    });
    assert.equal(create.body.status, "ok");

    const preview = await api(server, "/api/world-pack/import", {
      method: "POST",
      body: JSON.stringify({ pack: samplePack("pack_source"), preview: true })
    });

    assert.equal(preview.status, 200);
    assert.equal(preview.body.status, "ok");
    assert.equal(preview.body.preview, true);
    assert.equal(preview.body.summary.packageVersion, "0.3.0");
    assert.equal(preview.body.summary.hasConflict, true);
    assert.equal(preview.body.summary.willRename, true);
    assert.equal(preview.body.summary.containsRuntime, true);
    assert.equal(preview.body.summary.contents.worldbook, true);
  });
});

test("worldpack import rejects traversal and secrets before writing", async () => {
  await withServer(async (server, dataDir) => {
    for (const files of [
      { "../evil.json": {} },
      { "%2e%2e/evil.json": {} },
      { "userData/secrets.json": {} },
      { "config.json": {} }
    ]) {
      const pack = { ...samplePack("bad_pack"), files: { ...samplePack("bad_pack").files, ...files } };
      const result = await api(server, "/api/world-pack/import", {
        method: "POST",
        body: JSON.stringify({ pack, confirm: true, name: "should_not_exist" })
      });

      assert.equal(result.body.status, "error");
      assert.equal(result.body.error, "WORLD_PACK_INVALID");
      assert.equal(existsSync(join(dataDir, "engine", "worlds", "should_not_exist")), false);
    }
  });
});

test("worldpack import auto-renames conflicts and does not import runtime or secrets", async () => {
  await withServer(async (server, dataDir) => {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "pack_source", displayName: "Existing" })
    });
    assert.equal(create.body.status, "ok");

    const imported = await api(server, "/api/world-pack/import", {
      method: "POST",
      body: JSON.stringify({ pack: samplePack("pack_source"), confirm: true })
    });

    assert.equal(imported.body.status, "ok");
    assert.notEqual(imported.body.module.name, "pack_source");
    assert.equal(existsSync(join(dataDir, "engine", "worlds", imported.body.module.name, "shared", "worldbook.json")), true);
    assert.equal(existsSync(join(dataDir, "engine", "worlds", imported.body.module.name, "userData", "secrets.json")), false);
  });
});
