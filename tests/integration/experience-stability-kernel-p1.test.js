import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLivingWorldPacket } from "../../src/core/living-world/living-world-packet.js";
import { createExperienceStabilityPacket } from "../../src/core/experience-stability/experience-stability-packet.js";
import { classifyImpact } from "../../src/core/content/change-impact-classifier.js";

test("P0 packet flows through P1 bounded context, director guard, and impact policy", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "wt-p1-int-"));
  const living = await createLivingWorldPacket({ modeId: "mystery-puzzle", projectRoot, userInput: "inspect clue", currentScene: { sceneId: "investigation" }, runtimeData: { sceneSummaries: [], trackingDigest: {} }, sharedData: { worldState: { states: {} }, worldbook: { entries: [{ id: "clue", layer: "instant", visibility: "player_known", keys: ["clue"], solution: "hidden" }] } } });
  const stable = await createExperienceStabilityPacket({ modeId: "mystery-puzzle", projectRoot, livingWorldPacket: living, proposedChange: { type: "clue_discovered" } });
  assert.equal(stable.contextPacket.contextProfile, "mystery_safe");
  assert.equal(stable.directorPlan.shouldRevealSecret, false);
  assert.equal(stable.impactPolicy.impactLevel, "medium");
  assert.equal(classifyImpact({ type: "character_death" }).requiresSecondConfirm, true);
});
