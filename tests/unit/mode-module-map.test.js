import test from "node:test";
import assert from "node:assert/strict";

import { loadModulesForMode } from "../../src/core/modules/module-loader.js";
import { MODE_MANIFEST, getMode, isModeVisible } from "../../src/core/modes/mode-manifest.js";
import { getModulesForMode, validateModeModuleMap } from "../../src/core/modes/mode-module-map.js";

test("all eight future modes are declared without becoming visible", () => {
  assert.equal(Object.keys(MODE_MANIFEST).length, 8);
  for (const modeId of Object.keys(MODE_MANIFEST)) {
    assert.ok(getMode(modeId));
    assert.equal(isModeVisible(modeId), false);
  }
});

test("mode mappings contain their required capability modules", () => {
  assert.ok(getModulesForMode("quick-setting").length > 0);
  assert.ok(getModulesForMode("character").includes("character.card_runtime"));
  assert.ok(getModulesForMode("murder-mystery").includes("mystery.truth_lock"));
  assert.ok(getModulesForMode("tabletop").includes("trpg.dice"));
  assert.ok(getModulesForMode("world-rpg").includes("rpg.quest"));
  assert.ok(getModulesForMode("strategy-sim").includes("strategy.resource"));
  assert.ok(getModulesForMode("creation-forge").includes("creation.alchemy"));
});

test("loader returns graphs for planned and hidden modes", () => {
  const worldRpg = loadModulesForMode("world-rpg");
  assert.equal(worldRpg.modeId, "world-rpg");
  assert.ok(worldRpg.graph.resolved.includes("rpg.quest"));
  assert.deepEqual(worldRpg.graph.missing, []);

  const hidden = loadModulesForMode("murder-mystery");
  assert.equal(hidden.graph.requested.length, 7);
  assert.deepEqual(hidden.graph.missing, []);
});

test("declared-only and prototype modules warn without invalidating the map", () => {
  const result = validateModeModuleMap();
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("declared-only")));
  assert.ok(result.warnings.some((warning) => warning.includes("prototype-hidden")));
});
