import { readJson } from "../../shared/fs-utils.js";
import { join } from "node:path";
import { readCurrentScene, readRecentSceneSummaries } from "../scene/scene-summary-chain.js";
import { readTrackingDigest } from "../tracking/tracking-digest.js";
import { readWorldState } from "../world-state/world-state-manager.js";
import { calculateProximityScope } from "../proximity/proximity-scope.js";
import { activateWorldbookEntries } from "../worldbook/worldbook-trigger-engine.js";

export async function createLivingWorldPacket(ctx = {}) {
  const projectRoot = ctx.projectRoot || "";
  const enabled = !["quick-setting", "creation-forge"].includes(ctx.modeId);
  if (!enabled) return { version: 1, modeId: ctx.modeId || "", enabled: false, warnings: ["full_living_world_disabled_for_mode"], promptBlocks: [], debug: {} };
  const [scene, sceneSummaries, trackingDigest, worldState, worldbook] = await Promise.all([
    ctx.currentScene ? Promise.resolve(ctx.currentScene) : readCurrentScene(projectRoot),
    ctx.runtimeData?.sceneSummaries ? Promise.resolve(ctx.runtimeData.sceneSummaries) : readRecentSceneSummaries(projectRoot, 3),
    ctx.runtimeData?.trackingDigest ? Promise.resolve(ctx.runtimeData.trackingDigest) : readTrackingDigest(projectRoot, { limit: 8 }),
    ctx.sharedData?.worldState ? Promise.resolve(ctx.sharedData.worldState) : readWorldState(projectRoot),
    ctx.sharedData?.worldbook ? Promise.resolve(ctx.sharedData.worldbook) : readJson(join(projectRoot, "shared", "worldbook.json"), { entries: [] })
  ]);
  const proximityScope = calculateProximityScope({
    modeId: ctx.modeId, protagonistId: ctx.protagonistId, currentScene: scene,
    currentLocationId: scene?.locationId, candidates: ctx.candidates || [], relations: ctx.relations || []
  }, ctx.runtimeData?.proximityScope || null);
  const worldbookContext = activateWorldbookEntries(worldbook.entries || [], { userInput: ctx.userInput, currentScene: scene, proximityScope, worldState }, { maxEntries: ctx.runtimeFlags?.maxWorldbookEntries || 8 });
  const promptBlocks = [
    scene ? { type: "scene", value: scene } : null,
    sceneSummaries.length ? { type: "scene_summaries", value: sceneSummaries } : null,
    { type: "world_state", value: worldState },
    { type: "proximity", value: proximityScope },
    { type: "worldbook", value: worldbookContext }
  ].filter(Boolean);
  return { version: 1, modeId: ctx.modeId || "", enabled: true, scene, sceneSummaries, trackingDigest, worldState, proximityScope, worldbookContext, rippleDigest: ctx.runtimeData?.rippleDigest || null, promptBlocks, warnings: [], debug: { bounded: true } };
}
