import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("blank templates list, install, and read back as empty structures", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const listed = await api(server, "/api/examples");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.status, "ok");
    assert.equal(listed.body.examples.length, 8);

    for (const item of listed.body.examples) {
      assert.equal(item.kind, "blank_template");
      assert.equal(item.contentPolicy, "blank_structure_only");
      assert.ok(item.entrypoint);
      assert.ok(item.files.includes("world.json"));

      const installed = await api(server, "/api/examples/install", {
        method: "POST",
        body: JSON.stringify({ id: item.id })
      });
      assert.equal(installed.status, 200);
      assert.equal(installed.body.status, "ok");
      assert.equal(installed.body.module.type, "world");

      const moduleId = installed.body.module.id;
      const worldDir = join(dataDir, "engine", "worlds", moduleId);
      assert.equal(existsSync(join(worldDir, "world.json")), true);
      assert.equal(existsSync(join(worldDir, "shared", "worldbook.json")), true);
      assert.equal(existsSync(join(worldDir, "shared", "characters.json")), true);
      assert.equal(existsSync(join(worldDir, "runtime", "state.json")), true);
      assert.equal(existsSync(join(worldDir, "runtime", "alchemy-deliveries.jsonl")), true);

      const world = await readJson(join(worldDir, "world.json"));
      assert.equal(world.sourceExample, item.id);
      assert.equal(world.preset, "blank");

      const worldbook = await readJson(join(worldDir, "shared", "worldbook.json"));
      assert.deepEqual(worldbook.entries, []);

      const characters = await readJson(join(worldDir, "shared", "characters.json"));
      assert.deepEqual(characters, []);

      const state = await readJson(join(worldDir, "runtime", "state.json"));
      assert.equal(state.turnCount, 0);
      assert.equal(state.lastScene, "");
      assert.equal(state.lastInput, "");

      const loaded = await api(server, "/api/modules/load", {
        method: "POST",
        body: JSON.stringify({ id: moduleId })
      });
      assert.equal(loaded.status, 200);
      assert.equal(loaded.body.status, "ok");
      assert.equal(loaded.body.model.selected.id, moduleId);
    }
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
