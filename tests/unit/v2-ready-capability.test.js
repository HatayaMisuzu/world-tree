// tests/unit/v2-ready-capability.test.js — Stage 4 P0
import test from "node:test";
import assert from "node:assert/strict";
import { getModeCapability, validateModeAssetCompatibility, listModes, getAllCapabilities } from "../../src/core/v2-ready/mode-capability-contract.js";

test("getModeCapability returns frozen cap for known modes", () => {
  const cap = getModeCapability("strategy-sim");
  assert.equal(cap.modeId, "strategy-sim");
  assert.equal(cap.supportsNumericalState, true);
  assert.equal(cap.supportsProbability, true);
  assert.equal(cap.writesCanon, false);
  assert.ok(Array.isArray(cap.acceptedAssetTypes));
});

test("getModeCapability returns null for unknown mode", () => {
  assert.equal(getModeCapability("nonexistent"), null);
});

test("validateModeAssetCompatibility passes for compatible types", () => {
  const r = validateModeAssetCompatibility("clue", "mystery-puzzle");
  assert.equal(r.ok, true);
});

test("validateModeAssetCompatibility fails for incompatible types", () => {
  const r = validateModeAssetCompatibility("character_card", "tabletop");
  assert.equal(r.ok, false);
  assert.ok(r.error.includes("does not accept"));
});

test("validateModeAssetCompatibility fails for unknown mode", () => {
  const r = validateModeAssetCompatibility("clue", "unknown");
  assert.equal(r.ok, false);
});

test("listModes covers all 8 mode entries", () => {
  const modes = listModes();
  assert.equal(modes.length, 8);
  assert.ok(modes.includes("quick-setting"));
  assert.ok(modes.includes("character"));
  assert.ok(modes.includes("world-rpg"));
  assert.ok(modes.includes("tabletop"));
  assert.ok(modes.includes("mystery-puzzle"));
  assert.ok(modes.includes("strategy-sim"));
  assert.ok(modes.includes("murder-mystery"));
  assert.ok(modes.includes("creation-forge"));
});

test("getAllCapabilities has entries for all modes", () => {
  const all = getAllCapabilities();
  assert.equal(Object.keys(all).length, 8);
});

test("all modes write runtime and candidates, none write canon unbounded", () => {
  const all = getAllCapabilities();
  for (const [id, cap] of Object.entries(all)) {
    assert.equal(cap.writesRuntime, true, `${id} should write runtime`);
    assert.equal(cap.writesCandidates, true, `${id} should write candidates`);
    assert.equal(cap.writesCanon, false, `${id} must not write canon unbounded`);
  }
});
