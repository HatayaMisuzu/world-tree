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

test("quick project creates a persisted draft world from pasted text", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "quick_project_test",
        displayName: "Quick Project Test",
        quickProject: true,
        draft: true,
        sourceType: "pasted_text",
        sourceText: "A city under glass. The archivist remembers every storm.",
        dataMode: "worldbook",
        subType: "quick",
        preset: "minimal"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");
    assert.equal(create.body.module.draft, true);

    const worldDir = join(dataDir, "engine", "worlds", "quick_project_test");
    assert.equal(existsSync(join(worldDir, "runtime", "source.txt")), true);
    assert.match(readFileSync(join(worldDir, "runtime", "source.txt"), "utf-8"), /archivist/);

    const list = await api(server, "/api/modules");
    const module = list.body.find((item) => item.id === "quick_project_test");
    assert.equal(module.draft, true);
    assert.equal(module.sourceType, "pasted_text");

    const finalize = await api(server, "/api/modules/finalize-draft", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "quick_project_test", displayName: "Glass City" })
    });
    assert.equal(finalize.body.status, "ok");
    assert.equal(finalize.body.module.draft, false);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("quick-setting creates preset-compatible metadata and survives worldpack roundtrip", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "quick_setting_test",
        displayName: "Glass City",
        mode: "quick-setting",
        quickProject: true,
        draft: true,
        sourceType: "pasted_text",
        sourceText: "A city under glass. The archivist remembers every storm.",
        dataMode: "worldbook",
        subType: "quick",
        preset: "minimal"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");
    assert.equal(create.body.module.mode, "quick-setting");
    assert.equal(create.body.module.dataMode, "preset");
    assert.equal(create.body.module.subType, "classic");
    assert.equal(create.body.module.preset, "preset");

    const worldDir = join(dataDir, "engine", "worlds", "quick_setting_test");
    const world = JSON.parse(readFileSync(join(worldDir, "world.json"), "utf-8"));
    const state = JSON.parse(readFileSync(join(worldDir, "runtime", "state.json"), "utf-8"));
    assert.equal(world.mode, "quick-setting");
    assert.equal(world.modeMetadata.dataMode, "preset");
    assert.equal(world.modeMetadata.worldSubType, "classic");
    assert.ok(world.moduleGraph.resolved.includes("core.world_container"));
    assert.deepEqual(world.moduleGraph.missing, []);
    assert.equal(state.mode, "quick-setting");
    assert.equal(state.engineState.dataMode, "preset");
    assert.equal(state.engineState.worldSubType, "classic");
    assert.ok(state.moduleGraph.modules.length > 0);

    const list = await api(server, "/api/modules");
    const listed = list.body.find((item) => item.id === "quick_setting_test");
    assert.equal(listed.mode, "quick-setting");
    assert.equal(listed.dataMode, "preset");

    const exported = await api(server, "/api/world-pack/export", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "quick_setting_test" })
    });
    assert.equal(exported.body.status, "ok");
    assert.equal(exported.body.pack.files["world.json"].mode, "quick-setting");
    assert.ok(exported.body.pack.files["world.json"].moduleGraph.resolved.length > 0);

    const imported = await api(server, "/api/world-pack/import", {
      method: "POST",
      body: JSON.stringify({
        pack: exported.body.pack,
        name: "quick_setting_imported",
        preview: false,
        confirm: true
      })
    });
    assert.equal(imported.body.status, "ok");
    const importedWorld = JSON.parse(readFileSync(join(dataDir, "engine", "worlds", imported.body.module.id, "world.json"), "utf-8"));
    assert.equal(importedWorld.mode, "quick-setting");
    assert.equal(importedWorld.modeMetadata.dataMode, "preset");
    assert.ok(importedWorld.moduleGraph.resolved.includes("scene.session"));
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
