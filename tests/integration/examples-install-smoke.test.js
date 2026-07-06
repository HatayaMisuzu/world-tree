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

test("examples list, install, and read back with correct content policy", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const listed = await api(server, "/api/examples");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.status, "ok");
    assert.equal(listed.body.examples.length, 9);
    assert.equal(listed.body.examples.filter(item => item.kind === "blank_template").length, 8);
    assert.equal(listed.body.examples.filter(item => item.kind === "playable_demo").length, 1);

    for (const item of listed.body.examples) {
      const isDemo = item.kind === "playable_demo";
      assert.equal(item.contentPolicy, isDemo ? "original_demo_content" : "blank_structure_only");
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
      assert.equal(world.preset, isDemo ? "epic" : "blank");

      const worldbook = await readJson(join(worldDir, "shared", "worldbook.json"));
      if (isDemo) {
        assert.equal(worldbook.entries.length >= 8, true);
      } else {
        assert.deepEqual(worldbook.entries, []);
      }

      const characters = await readJson(join(worldDir, "shared", "characters.json"));
      if (isDemo) {
        assert.equal(characters.length >= 2, true);
      } else {
        assert.deepEqual(characters, []);
      }

      const state = await readJson(join(worldDir, "runtime", "state.json"));
      assert.equal(state.turnCount, 0);
      assert.equal(isDemo ? Boolean(state.lastScene) : state.lastScene === "", true);
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
