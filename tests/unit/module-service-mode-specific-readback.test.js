// tests/unit/module-service-mode-specific-readback.test.js — Stage 5H
import test from "node:test"; import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJsonSync } from "../../src/server/fs-utils.js";
import { createModuleService } from "../../src/server/module-service.js";

const TEST_ROOT = join(tmpdir(), "wt-stage5h-test-" + Date.now());
const worldsDir = join(TEST_ROOT, "worlds");

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(worldsDir, { recursive: true });
}

function teardown() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
}

function createMinimalWorld(worldName, modeId) {
  const worldDir = join(worldsDir, worldName);
  mkdirSync(worldDir, { recursive: true });
  mkdirSync(join(worldDir, "shared"), { recursive: true });
  mkdirSync(join(worldDir, "runtime"), { recursive: true });
  writeFileSync(join(worldDir, "world.json"), JSON.stringify({ name: worldName, mode: modeId, turnCount: 0 }));
  writeFileSync(join(worldDir, "runtime", "state.json"), JSON.stringify({ turnCount: 0, activeBranch: "main" }));
  // Minimal common files
  const sf = ["characters","scenes","worldbook","relations","timeline","world_state","organizations","locations","races","rules"];
  for (const name of sf) writeFileSync(join(worldDir, "shared", `${name}.json`), name === "worldbook" ? JSON.stringify({entries:[]}) : "{}");
  return worldDir;
}

function service() {
  return createModuleService({
    dataRoot: () => TEST_ROOT,
    worldsDir: () => worldsDir,
    profilesDir: () => join(TEST_ROOT, "profiles"),
    readJsonSync: (p, d) => existsSync(p) ? readJsonSync(p, d) : d,
    writeJson: async (p, v) => { writeFileSync(p, JSON.stringify(v)); },
    ensureDir: (d) => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); },
    pathWithinRoot: (root, p) => p.startsWith(root),
    safeEntityId: (v, d) => v || d
  });
}

test("mode-specific shared readback: world-rpg files", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_wr", "world-rpg");
    writeFileSync(join(d, "shared", "world_rpg.json"), JSON.stringify({ mode: "world-rpg", status: "minimal" }));
    writeFileSync(join(d, "shared", "world_threads.json"), JSON.stringify({ items: [] }));
    const m = await service().buildModuleModel("test_wr");
    const ms = m.moduleData.modeSpecific;
    assert.ok(ms);
    assert.equal(ms.modeId, "world-rpg");
    assert.ok(ms.sourceFiles.includes("world_rpg.json"));
    assert.ok(ms.sourceFiles.includes("world_threads.json"));
    assert.equal(ms.files["world_rpg.json"].mode, "world-rpg");
  } finally { teardown(); }
});

test("mode-specific shared readback: tabletop", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_tt", "tabletop");
    writeFileSync(join(d, "shared", "tabletop.json"), JSON.stringify({ mode: "tabletop" }));
    const m = await service().buildModuleModel("test_tt");
    assert.ok(m.moduleData.modeSpecific.sourceFiles.includes("tabletop.json"));
    assert.equal(m.moduleData.modeSpecific.files["tabletop.json"].mode, "tabletop");
  } finally { teardown(); }
});

test("mode-specific shared readback: strategy-sim", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_st", "strategy-sim");
    writeFileSync(join(d, "shared", "strategy.json"), JSON.stringify({ mode: "strategy-sim" }));
    const m = await service().buildModuleModel("test_st");
    assert.ok(m.moduleData.modeSpecific.sourceFiles.includes("strategy.json"));
  } finally { teardown(); }
});

test("mode-specific shared readback: murder-mystery", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_mm", "murder-mystery");
    writeFileSync(join(d, "shared", "murder_mystery.json"), JSON.stringify({ mode: "murder-mystery" }));
    const m = await service().buildModuleModel("test_mm");
    assert.ok(m.moduleData.modeSpecific.sourceFiles.includes("murder_mystery.json"));
  } finally { teardown(); }
});

test("mode-specific shared readback: mystery-puzzle", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_mp", "mystery-puzzle");
    writeFileSync(join(d, "shared", "mystery.json"), JSON.stringify({ mode: "mystery-puzzle" }));
    const m = await service().buildModuleModel("test_mp");
    assert.ok(m.moduleData.modeSpecific.sourceFiles.includes("mystery.json"));
  } finally { teardown(); }
});

test("mode-specific shared readback: creation-forge", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_cf", "creation-forge");
    writeFileSync(join(d, "shared", "creation_forge.json"), JSON.stringify({ mode: "creation-forge" }));
    writeFileSync(join(d, "shared", "forge_blueprints.json"), JSON.stringify({ blueprints: [] }));
    const m = await service().buildModuleModel("test_cf");
    const ms = m.moduleData.modeSpecific;
    assert.ok(ms.sourceFiles.includes("creation_forge.json"));
    assert.ok(ms.sourceFiles.includes("forge_blueprints.json"));
  } finally { teardown(); }
});

test("mode-specific shared readback: missing file returns null", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_mf", "tabletop");
    const m = await service().buildModuleModel("test_mf");
    assert.equal(m.moduleData.modeSpecific.files["tabletop.json"], null);
  } finally { teardown(); }
});

test("mode-specific shared readback: unknown mode has empty", async () => {
  setup();
  try {
    const d = createMinimalWorld("test_unk", "");
    writeFileSync(join(d, "world.json"), JSON.stringify({ name: "test_unk", turnCount: 0 }));
    const m = await service().buildModuleModel("test_unk");
    const ms = m.moduleData.modeSpecific;
    assert.equal(ms.modeId, "");
    assert.deepEqual(ms.sourceFiles, []);
    assert.deepEqual(ms.files, {});
  } finally { teardown(); }
});
