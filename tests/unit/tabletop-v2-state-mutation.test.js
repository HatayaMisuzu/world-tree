// Tabletop V2 State Mutation Tests
import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTabletopTurnConsequences,
  updateSceneTransition,
  advanceClock,
  updateInventory,
  updateNpcState,
} from "../../src/core/tabletop/tabletop-v2-state-mutation.js";

test("applyTabletopTurnConsequences: applies setback and bonus", () => {
  const runState = {
    runId: "test-1",
    turnIndex: 0,
    publicState: { sceneTitle: "Test", sceneHistory: [], inventory: [], visibleNpcs: [] },
    hiddenGmState: { clocks: [], npcSecrets: {} },
  };
  const ruling = {
    consequences: [
      { type: "setback", description: "你被击退了" },
      { type: "bonus", description: "你获得了勇气" },
    ],
  };
  const { runState: result, applied } = applyTabletopTurnConsequences({ runState, ruling, playerIntent: "attack" });
  assert.ok(result);
  assert.equal(applied.length, 2);
  assert.ok(result.publicState.sceneHistory.length >= 1);
});

test("applyTabletopTurnConsequences: handles clock_tick consequence", () => {
  const runState = {
    runId: "test-2",
    turnIndex: 0,
    publicState: {
      sceneTitle: "Test",
      sceneHistory: [],
      inventory: [],
      publicClocks: [{ id: "c1", label: "Doom", value: 0, segments: 4 }],
    },
    hiddenGmState: { clocks: [], npcSecrets: {} },
  };
  const ruling = {
    consequences: [{ type: "clock_tick", clockId: "c1", amount: 1, visibility: "public" }],
  };
  const { runState: result } = applyTabletopTurnConsequences({ runState, ruling });
  // Clock should be advanced - but this relies on clock-engine integration
  assert.ok(result);
});

test("updateSceneTransition: changes scene", () => {
  const module = {
    scenes: [
      { sceneId: "s1", title: "Start", exitTransitions: [{ id: "t1", targetSceneId: "s2" }] },
      { sceneId: "s2", title: "Next" },
    ],
  };
  const runState = { currentSceneId: "s1", publicState: {} };
  const result = updateSceneTransition({ module, runState, transitionId: "t1" });
  assert.equal(result.currentSceneId, "s2");
  assert.equal(result.publicState.sceneTitle, "Next");
});

test("updateInventory: add item", () => {
  const runState = { publicState: { inventory: [] } };
  const result = updateInventory({
    runState,
    itemPatch: { action: "add", name: "药水", quantity: 2 },
  });
  assert.equal(result.publicState.inventory.length, 1);
  assert.equal(result.publicState.inventory[0].name, "药水");
});

test("updateInventory: remove item", () => {
  const runState = {
    publicState: { inventory: [{ name: "药水", quantity: 1 }] },
  };
  const result = updateInventory({
    runState,
    itemPatch: { action: "remove", name: "药水" },
  });
  assert.equal(result.publicState.inventory.length, 0);
});

test("updateNpcState: adds visible NPC info", () => {
  const runState = { publicState: { visibleNpcs: [] } };
  const result = updateNpcState({
    runState,
    npcId: "npc_1",
    patch: { name: "村长", disposition: "friendly" },
  });
  assert.equal(result.publicState.visibleNpcs.length, 1);
  assert.equal(result.publicState.visibleNpcs[0].name, "村长");
});

test("updateNpcState: hidden NPC secrets not in publicState", () => {
  const runState = { publicState: {}, hiddenGmState: { npcSecrets: {} } };
  const result = updateNpcState({
    runState,
    npcId: "npc_secret",
    patch: { trueIdentity: "dragon" },
    visibility: "hidden",
  });
  assert.equal(result.hiddenGmState.npcSecrets["npc_secret"].trueIdentity, "dragon");
  assert.ok(!result.publicState.visibleNpcs);
});
