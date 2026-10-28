import test from "node:test";
import assert from "node:assert/strict";

import { loadGlobalMemory, searchMemorySnapshots } from "../../src/core/engine/global-memory.js";
import { exportMemorySnapshot, importMemorySnapshot, recordPlayerChoice, resetAllMemoryLayers } from "../../src/core/engine/memory-layers.js";

const snap = (id, round) => ({ id, moduleKey: "m1", round, emotion: {}, summary: "", keywords: [], scene: "" });

test("M8: recency bonus uses (currentRound - snap.round), so newer memories score higher", () => {
  loadGlobalMemory({ snapshots: [snap("mem-1", 2), snap("mem-2", 9)] });
  const results = searchMemorySnapshots({ moduleKey: "m1", _currentRound: 10, limit: 5, minScore: 0 });
  assert.deepEqual(results.map((r) => r.id), ["mem-2", "mem-1"]);
  const byId = Object.fromEntries(results.map((r) => [r.id, r._score]));
  // emotion term = 25 for both; recency = 20 - (10-9)*0.5 = 19.5 vs 20 - (10-2)*0.5 = 16
  assert.equal(byId["mem-2"], Math.round(25 + 19.5));
  assert.equal(byId["mem-1"], Math.round(25 + 16));
});

test("M9: exportMemorySnapshot includes player.choices (last 100) and round-trips through import", () => {
  resetAllMemoryLayers();
  for (let i = 0; i < 105; i += 1) recordPlayerChoice({ context: `c${i}`, choice: `x${i}` });
  const exported = exportMemorySnapshot();
  assert.equal(exported.layers.player.choicesCount, 105);
  assert.equal(exported.layers.player.choices.length, 100);
  assert.equal(exported.layers.player.choices[0].choice, "x5");
  resetAllMemoryLayers();
  importMemorySnapshot(JSON.parse(JSON.stringify(exported)));
  assert.equal(exportMemorySnapshot().layers.player.choices.at(-1).choice, "x104");
});
