import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "../../server/fs-utils.js";
import { deepFilterHiddenFields } from "../system/mode-isolation-policy.js";
import { createLivingWorldPacket } from "../living-world/living-world-packet.js";
import { createExperienceStabilityPacket } from "../experience-stability/experience-stability-packet.js";
import { createTelemetryDigest } from "../telemetry/telemetry-digest.js";
import { collectWorldTelemetry } from "../telemetry/world-telemetry.js";
import { initializeBranchTree, resolveActiveBranchProjectRoot, getActiveBranch } from "../timeline/branch-manager.js";
import { composeModulesForMode } from "../modes/module-composer.js";
import { loadWorldProfile } from "../modes/world-profile-loader.js";
import { isContinueIntent } from "../advance/advance-policy.js";
import { runAutoLightAdvance } from "../advance/auto-advance.js";

function modeFrom({ modeId, dataMode, model }) {
  if (modeId) return modeId;
  if (model?.selected?.mode) return model.selected.mode;
  if (dataMode === "character_card") return "character";
  return model?.moduleData?.runtime?.mode || "world-rpg";
}

function profileFor(modeId, world = {}) {
  if (world.worldProfileId) return world.worldProfileId;
  const subtype = world.subType || world.worldSubType || "";
  if (["murder-mystery", "mystery-puzzle"].includes(modeId)) return "urban-mystery";
  if (modeId === "strategy-sim") return "strategy-campaign";
  if (modeId === "character") return "character-drama";
  if (subtype === "rpg") return "epic-war";
  return "daily-life";
}

function compactPromptBlocks(packet = {}, stability = {}, telemetry = {}) {
  const context = stability.contextPacket?.blocks || {};
  const plan = stability.directorPlan || {};
  const summaries = (packet.sceneSummaries || []).slice(0, 3).map((item) => item.summary || item.text || item.title).filter(Boolean);
  const changes = (packet.trackingDigest?.recentChanges || []).slice(0, 4).map((item) => item.summary || item.reason || item.type).filter(Boolean);
  const worldStates = Object.entries(packet.worldState?.states || packet.worldState || {}).slice(0, 5).map(([key, value]) => `${key}=${typeof value === "object" ? value.label || value.value || "active" : value}`);
  const worldbook = [...(packet.worldbookContext?.base || []), ...(packet.worldbookContext?.context || []), ...(packet.worldbookContext?.instant || [])]
    .slice(0, 4)
    .map((item) => `${item.title || item.name || item.id}: ${String(item.content || item.summary || "").slice(0, 180)}`);
  const lines = [
    "【World Tree Kernel Sidecar】",
    `branch=${telemetry.branchId || "main"}; contextProfile=${stability.contextPacket?.contextProfile || "compact"}`,
    `scene=${packet.scene?.title || packet.scene?.sceneId || "unknown"}; summaries=${packet.sceneSummaries?.length || 0}; tracking=${packet.trackingDigest?.recentChanges?.length || 0}`,
    `proximity core=${packet.proximityScope?.rings?.core?.length || 0}, near=${packet.proximityScope?.rings?.near?.length || 0}; worldbook=${(packet.worldbookContext?.base?.length || 0) + (packet.worldbookContext?.context?.length || 0) + (packet.worldbookContext?.instant?.length || 0)}`,
    `director beat=${plan.beatType || "respond"}; pace=${plan.pace || "normal"}; reveal=${plan.shouldRevealSecret === true ? "approved" : "blocked"}; maxNewEvents=${Math.min(1, Number(plan.maxNewEvents || 0))}`,
    `telemetry=${Object.entries(telemetry.metrics || {}).map(([key, value]) => `${key}:${value}`).join(", ")}`,
    ...(summaries.length ? [`recentScene=${summaries.join(" | ")}`] : []),
    ...(changes.length ? [`recentChanges=${changes.join(" | ")}`] : []),
    ...(worldStates.length ? [`worldState=${worldStates.join(", ")}`] : []),
    ...(worldbook.length ? [`worldbookContext=${worldbook.join(" | ")}`] : []),
    ...(plan.forbiddenMoves?.length ? [`forbidden=${plan.forbiddenMoves.slice(0, 8).join(", ")}`] : []),
    ...(context.activeWarnings?.length ? [`warnings=${context.activeWarnings.slice(0, 4).join(", ")}`] : [])
  ];
  return lines.join("\n").slice(0, 2400);
}

export async function createKernelTurnContext(input = {}) {
  const modeId = modeFrom(input);
  const projectRoot = input.projectRoot || "";
  let branchRoot = projectRoot;
  let activeBranchId = "main";
  const warnings = [];

  if (projectRoot && (existsSync(join(projectRoot, "timeline-tree.json")) || existsSync(join(projectRoot, "branches")))) {
    await initializeBranchTree(projectRoot);
    branchRoot = await resolveActiveBranchProjectRoot(projectRoot);
    activeBranchId = (await getActiveBranch(projectRoot))?.id || "main";
  } else if (!projectRoot) {
    warnings.push("project_root_unavailable_in_memory_sidecar");
  }

  const world = projectRoot ? await readJson(join(projectRoot, "world.json"), {}) : {};
  const runtime = branchRoot ? await readJson(join(branchRoot, "runtime", "state.json"), {}) : (input.model?.moduleData?.runtime || {});
  const profileId = input.runtimeFlags?.profileId || profileFor(modeId, world);
  const profileResult = loadWorldProfile(profileId);
  const composedModules = composeModulesForMode(modeId, profileId, input.runtimeFlags?.moduleOptions || {});
  const sharedData = input.sharedData || {
    worldState: branchRoot ? await readJson(join(branchRoot, "shared", "world_state.json"), { states: {} }) : (input.model?.moduleData?.worldState || { states: {} }),
    worldbook: branchRoot ? await readJson(join(branchRoot, "shared", "worldbook.json"), { entries: [] }) : (input.model?.moduleData?.worldbook || { entries: [] })
  };
  const livingWorldPacket = await createLivingWorldPacket({
    modeId, projectRoot: branchRoot, userInput: input.userInput || "", currentScene: input.currentScene,
    protagonistId: input.runtimeFlags?.protagonistId || runtime.protagonistId || "protagonist",
    candidates: input.model?.entities || input.model?.moduleData?.characters || [],
    relations: input.model?.moduleData?.relations || [], sharedData,
    runtimeData: input.runtimeData || (!branchRoot ? { sceneSummaries: [], trackingDigest: {}, proximityScope: null } : undefined),
    runtimeFlags: input.runtimeFlags || {}
  });
  const experienceStabilityPacket = await createExperienceStabilityPacket({
    modeId, projectRoot: branchRoot, userInput: input.userInput || "", livingWorldPacket,
    modeState: input.engineState || {}, runtimeFlags: input.runtimeFlags || {},
    activeProposals: input.activeProposals || [], characterInertia: !branchRoot ? { version: 1, characters: {} } : undefined,
    worldbookGrowthSnapshot: !branchRoot ? { version: 1, candidates: {} } : undefined
  });
  const telemetry = branchRoot
    ? await collectWorldTelemetry(branchRoot, { branchId: activeBranchId, turnId: runtime.turnCount || 0 }, { persist: false })
    : createTelemetryDigest({ branchId: activeBranchId });
  const autoAdvancePreview = isContinueIntent(input.userInput || "")
    ? runAutoLightAdvance({
        modeId, userInput: input.userInput, advanceMode: input.runtimeFlags?.advanceMode || profileResult.profile?.autoAdvance?.defaultMode || "assisted",
        profile: profileResult.profile || { autoAdvance: { allowAutoLight: false } }, telemetry,
        directorPlan: experienceStabilityPacket.directorPlan, activeProposals: input.activeProposals || [],
        hiddenTruthRequired: Boolean(input.runtimeFlags?.hiddenTruthRequired), suggestedUserChoices: input.runtimeFlags?.suggestedUserChoices || []
      })
    : null;
  const promptText = compactPromptBlocks(livingWorldPacket, experienceStabilityPacket, telemetry);
  return deepFilterHiddenFields({
    version: 1, modeId, projectRoot, branchRoot, activeBranchId, profileId,
    composedModules, livingWorldPacket, experienceStabilityPacket, telemetry, autoAdvancePreview,
    promptBlocks: [promptText], promptText, directorPlan: experienceStabilityPacket.directorPlan,
    warnings: [...warnings, ...(livingWorldPacket.warnings || []), ...(experienceStabilityPacket.warnings || []), ...composedModules.warnings],
    debug: { p0: Boolean(livingWorldPacket), p1: Boolean(experienceStabilityPacket), p2: Boolean(telemetry), promptChars: promptText.length, canonicalWrites: 0 }
  });
}

export function summarizeKernelTurnContext(context = {}) {
  return {
    version: context.version || 1, modeId: context.modeId || "", activeBranchId: context.activeBranchId || "main",
    profileId: context.profileId || null, status: { p0: Boolean(context.debug?.p0), p1: Boolean(context.debug?.p1), p2: Boolean(context.debug?.p2) },
    scene: context.livingWorldPacket?.scene?.title || context.livingWorldPacket?.scene?.sceneId || null,
    contextProfile: context.experienceStabilityPacket?.contextPacket?.contextProfile || "compact",
    directorPlan: context.directorPlan || null, telemetry: context.telemetry || null,
    autoAdvancePreview: context.autoAdvancePreview || null, warnings: context.warnings || [], debug: context.debug || {}
  };
}
