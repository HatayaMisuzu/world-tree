import test from "node:test";
import assert from "node:assert/strict";

import { getModulesForMode } from "../../src/core/modes/mode-module-map.js";
import {
  createCharacterModuleRuntimeContext,
  createCharacterModuleRuntimePacket,
  createCharacterModuleSourceMap,
  selectCharacterModulePromptBlocks,
  createCharacterModuleDebugSummary,
  validateCharacterModuleRuntimePacket
} from "../../src/core/character/character-module-runtime-integration.js";

const REQUIRED_MODULES = ["core.world_container", "character.preset", "character.cognition", "character.card_runtime", "scene.session", "audit.narrative_quality", "core.dynamic_state"];

test("MODE_MODULE_MAP.character contains 7 required modules", () => {
  const modules = getModulesForMode("character");
  for (const id of REQUIRED_MODULES) {
    assert.ok(modules.includes(id), `missing ${id}`);
  }
});

test("createCharacterModuleRuntimeContext has safe defaults", () => {
  const ctx = createCharacterModuleRuntimeContext({}, { text: "hello" });
  assert.equal(ctx.input, "hello");
  assert.deepEqual(ctx.model, {});
});

test("createCharacterModuleRuntimePacket returns packet with required check", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  assert.equal(packet.modeId, "character");
  assert.equal(packet.requiredModuleCheck, true);
  assert.ok(packet.contextBlocks.length > 0);
  assert.ok(packet.promptBlocks.length > 0);
});

test("sourceMap reports correct modeId and module count", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  const sm = createCharacterModuleSourceMap(packet);
  assert.equal(sm.modeId, "character");
  assert.ok(sm.requestedModules.length >= 7);
  assert.ok(sm.loadedModuleCount > 0);
});

test("selectCharacterModulePromptBlocks respects max", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  const blocks = selectCharacterModulePromptBlocks(packet, { maxPromptBlocks: 2 });
  assert.ok(blocks.length <= 2);
  if (blocks.length) assert.ok(blocks[0].text?.length > 0);
});

test("debugSummary includes sourceMap and selected blocks", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  const ds = createCharacterModuleDebugSummary(packet);
  assert.ok(ds.sourceMap);
  assert.ok(Array.isArray(ds.selectedPromptBlocks));
  assert.equal(ds.hasRequiredModules, true);
});

test("validateCharacterModuleRuntimePacket passes for valid packet", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  const result = validateCharacterModuleRuntimePacket(packet);
  assert.equal(result.ok, true);
});

test("validateCharacterModuleRuntimePacket fails on missing modules", () => {
  const result = validateCharacterModuleRuntimePacket({ requiredModuleCheck: false, errors: ["error"] });
  assert.equal(result.ok, false);
});

test("context and prompt blocks are JSON-safe", () => {
  const packet = createCharacterModuleRuntimePacket({}, { text: "test" });
  assert.doesNotThrow(() => JSON.stringify(packet));
});
