import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transitionScene } from "../../src/core/scene/scene-summary-chain.js";
import { createLivingWorldPacket } from "../../src/core/living-world/living-world-packet.js";
import { deriveBoundedRipple } from "../../src/core/world-state/world-state-ripple.js";

test("P0 living-world flow transitions scenes, activates lore, and bounds a major ripple", async () => {
  const root = await mkdtemp(join(tmpdir(), "wt-p0-int-"));
  await transitionScene(root, { sceneId: "tavern", title: "Tavern", locationId: "town" });
  await transitionScene(root, { sceneId: "mine", title: "Northern Mine", locationId: "mine" }, { events: [{ text: "Travelled north." }] });
  const packet = await createLivingWorldPacket({ modeId: "world-rpg", projectRoot: root, userInput: "inspect the mine", currentScene: { sceneId: "mine", locationId: "mine" }, candidates: [{ id: "miner", locationId: "mine", relationDistance: 0.2, timeDistance: 0 }], runtimeData: { trackingDigest: {} }, sharedData: { worldState: { states: {} }, worldbook: { entries: [{ id: "mine-lore", title: "Mine", layer: "context", visibility: "player_known", keys: ["mine"] }] } } });
  assert.equal(packet.sceneSummaries.length, 1);
  assert.deepEqual(packet.proximityScope.rings.core, ["miner"]);
  assert.deepEqual(packet.worldbookContext.context.map((item) => item.id), ["mine-lore"]);
  const ripple = deriveBoundedRipple(root, { id: "siege", impactLevel: "major", effects: [{ depth: 1, confidence: 0.9 }, { depth: 2, confidence: 0.8 }, { depth: 3, confidence: 0.9 }] });
  assert.equal(ripple.maxDepth, 2);
  assert.equal(ripple.items.some((item) => item.depth === 3), false);
});
