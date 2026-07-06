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

test("character project creates with mode=character and character_card engineState", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "char_test_project",
        displayName: "档案员",
        mode: "character",
        dataMode: "character_card",
        subType: "classic",
        preset: "character_card",
        draft: true,
        sourceType: "character_card",
        sourceText: "name: 档案员\\npersonality: 冷静、沉默寡言\\nfirst_mes: 欢迎来到档案室。"
      })
    });

    assert.equal(create.status, 200);
    assert.equal(create.body.status, "ok");
    assert.equal(create.body.module.mode, "character");
    assert.equal(create.body.module.dataMode, "character_card");
    assert.equal(create.body.module.draft, true);

    const worldDir = join(dataDir, "engine", "worlds", "char_test_project");

    // world.json checks
    const world = JSON.parse(readFileSync(join(worldDir, "world.json"), "utf-8"));
    assert.equal(world.mode, "character");
    assert.ok(world.modeMetadata);
    assert.equal(world.modeMetadata.dataMode, "character_card");
    assert.equal(world.moduleGraph, undefined);
    const engineGraph = JSON.parse(readFileSync(join(worldDir, "runtime", "engine-graph.json"), "utf-8"));
    assert.ok(engineGraph.moduleGraph);

    // runtime/state.json checks
    const state = JSON.parse(readFileSync(join(worldDir, "runtime", "state.json"), "utf-8"));
    assert.equal(state.engineState.dataMode, "character_card");
    assert.equal(state.engineState.worldSubType, "classic");
    assert.equal(state.mode, "character");
    assert.ok(state.modeStateEnvelope);

    // runtime/source.txt
    assert.equal(existsSync(join(worldDir, "runtime", "source.txt")), true);
    const sourceText = readFileSync(join(worldDir, "runtime", "source.txt"), "utf-8");
    assert.ok(sourceText.includes("档案员"));

    // shared/characters.json
    assert.equal(existsSync(join(worldDir, "shared", "characters.json")), true);
    const chars = JSON.parse(readFileSync(join(worldDir, "shared", "characters.json"), "utf-8"));
    assert.ok(Array.isArray(chars));
    assert.equal(chars[0].id, "primary");
    assert.equal(chars[0].name, "档案员");

    // .worldtree roundtrip
    const exported = await api(server, "/api/world-pack/export", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "char_test_project" })
    });
    assert.equal(exported.body.status, "ok");
    assert.equal(exported.body.pack.files["world.json"].mode, "character");
    assert.equal(exported.body.pack.files["world.json"].moduleGraph, undefined);

    const imported = await api(server, "/api/world-pack/import", {
      method: "POST",
      body: JSON.stringify({
        pack: exported.body.pack,
        name: "char_test_imported",
        preview: false,
        confirm: true
      })
    });
    assert.equal(imported.body.status, "ok");
    const importedWorld = JSON.parse(readFileSync(join(dataDir, "engine", "worlds", imported.body.module.id, "world.json"), "utf-8"));
    assert.equal(importedWorld.mode, "character");
    assert.equal(importedWorld.modeMetadata.dataMode, "character_card");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("quick-setting creation still works alongside character", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const qs = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({
        name: "qs_side_test",
        displayName: "Quick Side",
        mode: "quick-setting",
        quickProject: true,
        draft: true,
        sourceType: "pasted_text",
        sourceText: "A glass city under storm.",
        dataMode: "worldbook",
        subType: "quick",
        preset: "minimal"
      })
    });
    assert.equal(qs.body.status, "ok");
    assert.equal(qs.body.module.mode, "quick-setting");
    assert.equal(qs.body.module.dataMode, "preset");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
