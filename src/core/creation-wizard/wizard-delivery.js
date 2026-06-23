// wizard-delivery.js — Deliver wizard blueprint to creation-forge candidate
// Part of M1 Creation Wizard v2 — Data tier: candidate only, never writes canon

import { buildBlueprintCandidate, validateBlueprint } from "./wizard-blueprint-builder.js";
import { reviewBlueprint, isReadyForDelivery } from "./wizard-risk-review.js";

export function prepareWizardDelivery(session) {
  const blueprint = buildBlueprintCandidate(session);
  const validation = validateBlueprint(blueprint);
  const review = reviewBlueprint(blueprint);

  if (!isReadyForDelivery(review)) {
    return {
      ok: false,
      status: "blocked",
      reason: "blueprint has high-risk findings",
      review,
      blueprint: null
    };
  }

  blueprint.estimatedCompleteness = Math.round(
    (Object.values(blueprint).filter(v => typeof v === "string" && v.length > 0).length /
     Math.max(1, Object.keys(blueprint).length)) * 100
  );

  return {
    ok: true,
    status: "ready_for_delivery",
    blueprint,
    review,
    deliveryTarget: "creation-forge",
    deliveryMethod: "candidate",
    note: "This is a CANDIDATE. It must not be written directly to shared/ or used to auto-create a project."
  };
}

export function createWizardPrompts(session) {
  const prompts = [];
  // Only generate prompts for public-facing fields — never include hidden data
  if (session.fields.hard.worldName) prompts.push(`世界名称: ${session.fields.hard.worldName}`);
  if (session.fields.hard.genre) prompts.push(`风格: ${session.fields.hard.genre}`);
  if (session.fields.hard.playerRole) prompts.push(`玩家角色: ${session.fields.hard.playerRole}`);
  if (session.fields.soft.worldHook) prompts.push(`世界钩子: ${session.fields.soft.worldHook}`);
  return prompts.join("; ");
}
