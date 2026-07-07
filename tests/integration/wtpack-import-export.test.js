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

test("wtpack export/import validates manifest checksums and strips runtime logs", async () => {
  const dataDir = await createTempDataDir("world-tree-wtpack-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "wtpack_source", displayName: "WT Pack Source", sourceText: "Moon Gate" })
    });
    assert.equal(create.body.status, "ok");
    const exported = await api(server, "/api/wtpack/export", {
      method: "POST",
      body: JSON.stringify({ moduleKey: create.body.module.id, author: "Tester", license: "MIT", contentRating: "teen" })
    });
    assert.equal(exported.body.status, "ok");
    assert.equal(exported.body.filename.endsWith(".wtpack"), true);
    assert.equal(exported.body.pack.manifest.specVersion, 1);
    assert.equal(Boolean(exported.body.pack.manifest.checksums["world.json"]), true);
    assert.equal(Object.keys(exported.body.pack.files).some((key) => /usage|chat|memory|secret/i.test(key)), false);

    const preview = await api(server, "/api/wtpack/import", {
      method: "POST",
      body: JSON.stringify({ pack: exported.body.pack, preview: true })
    });
    assert.equal(preview.body.status, "ok");
    assert.equal(preview.body.preview, true);

    const imported = await api(server, "/api/wtpack/import", {
      method: "POST",
      body: JSON.stringify({ pack: exported.body.pack, confirm: true, name: "wtpack_imported" })
    });
    assert.equal(imported.body.status, "ok");
    assert.equal(existsSync(join(dataDir, "engine", "worlds", "wtpack_imported", "world.json")), true);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("worldbook import endpoint previews and commits ST lorebook entries", async () => {
  const dataDir = await createTempDataDir("world-tree-lorebook-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "lorebook_world", displayName: "Lorebook World" })
    });
    assert.equal(create.body.status, "ok");
    const lorebook = { entries: { "1": { key: ["Moon Gate"], content: "A sealed gate.", comment: "Gate" } } };
    const preview = await api(server, "/api/worldbook/import", {
      method: "POST",
      body: JSON.stringify({ lorebook })
    });
    assert.equal(preview.body.status, "ok");
    assert.equal(preview.body.preview, true);
    assert.equal(preview.body.format, "st_lorebook");
    const committed = await api(server, "/api/worldbook/import", {
      method: "POST",
      body: JSON.stringify({ moduleKey: create.body.module.id, lorebook, confirm: true })
    });
    assert.equal(committed.body.status, "ok");
    assert.equal(committed.body.imported, 1);
    assert.equal(existsSync(join(dataDir, "engine", "worlds", create.body.module.id, "shared", "worldbook.json")), true);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
