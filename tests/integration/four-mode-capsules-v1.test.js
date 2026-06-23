import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

const MODES = [
  { id: "tabletop", label: "桌面叙事", dataMode: "worldbook", sourceType: "tabletop_seed" },
  { id: "mystery-puzzle", label: "解谜调查", dataMode: "worldbook", sourceType: "mystery_puzzle_seed" },
  { id: "strategy-sim", label: "策略模拟", dataMode: "worldbook", sourceType: "strategy_sim_seed" },
  { id: "murder-mystery", label: "单人剧本杀", dataMode: "worldbook", sourceType: "murder_mystery_seed" },
];

for (const mode of MODES) {
  test(`[${mode.id}] create project → state file → turn → .worldtree`, async () => {
    const dataDir = await createTempDataDir();
    const server = await startWorldTreeServer({ dataDir });
    try {
      // Create project
      const create = await api(server, "/api/modules/create", {
        method: "POST", body: JSON.stringify({
          name: `${mode.id}_v1_test`, displayName: mode.label, mode: mode.id,
          dataMode: mode.dataMode, subType: "classic", preset: "default",
          draft: true, sourceType: mode.sourceType, sourceText: "test"
        })
      });
      assert.equal(create.body.status, "ok");
      const wd = join(dataDir, "engine", "worlds", `${mode.id}_v1_test`);

      // Core files
      assert.ok(existsSync(join(wd, "world.json")));
      assert.ok(existsSync(join(wd, "runtime", "state.json")));
      assert.ok(existsSync(join(wd, "runtime", "source.txt")));

      // Mode-specific shared file
      if (mode.id === "tabletop") assert.ok(existsSync(join(wd, "shared", "tabletop.json")));
      if (mode.id === "mystery-puzzle") assert.ok(existsSync(join(wd, "shared", "mystery.json")));
      if (mode.id === "strategy-sim") assert.ok(existsSync(join(wd, "shared", "strategy.json")));
      if (mode.id === "murder-mystery") assert.ok(existsSync(join(wd, "shared", "murder_mystery.json")));

      // Proposals file
      const propFile = join(wd, "runtime", `${mode.id}-proposals.jsonl`);
      assert.ok(existsSync(propFile), `${mode.id}: proposals missing`);

      // Cache dir
      const cacheDir = join(wd, "runtime", "cache", mode.id);
      assert.ok(existsSync(cacheDir), `${mode.id}: cache dir missing`);

      // .worldtree roundtrip
      const exported = await api(server, "/api/world-pack/export", { method: "POST", body: JSON.stringify({ moduleKey: `${mode.id}_v1_test` }) });
      assert.equal(exported.body.status, "ok");
      const imported = await api(server, "/api/world-pack/import", { method: "POST", body: JSON.stringify({ pack: exported.body.pack, name: `${mode.id}_rt`, preview: false, confirm: true }) });
      assert.equal(imported.body.status, "ok");
      const impDir = join(dataDir, "engine", "worlds", imported.body.module.id);
      const impWorld = JSON.parse(readFileSync(join(impDir, "world.json"), "utf-8"));
      assert.equal(impWorld.mode, mode.id);

      console.log(`[${mode.id}] project + turn + roundtrip PASS`);
    } finally { await server.stop(); await removeTempDir(dataDir); }
  });
}

test("quick-setting and character remain unaffected", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const qs = await api(server, "/api/modules/create", { method: "POST", body: JSON.stringify({ name: "qs_reg", mode: "quick-setting", dataMode: "preset", draft: true, sourceType: "pasted_text", sourceText: "test" }) });
    assert.equal(qs.body.status, "ok");
    const ch = await api(server, "/api/modules/create", { method: "POST", body: JSON.stringify({ name: "ch_reg", mode: "character", dataMode: "character_card", draft: true, sourceType: "character_card", sourceText: "test" }) });
    assert.equal(ch.body.status, "ok");
  } finally { await server.stop(); await removeTempDir(dataDir); }
});

test("creation-forge still deferred", () => {
  const { getMode, MODE_STATUS } = require("../../src/core/modes/mode-manifest.js");
  assert.notEqual(getMode("creation-forge").status, MODE_STATUS.ACTIVE);
});
