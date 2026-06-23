// wizard-blueprint-builder.js — Build blueprint candidate from wizard session
// Part of M1 Creation Wizard v2 — Data tier: candidate only

import { STAGES } from "./wizard-session.js";

export function buildBlueprintCandidate(session) {
  const { sessionId, modeHint, fields, risks } = session;
  const blueprint = {
    version: 2,
    sessionId,
    modeHint,
    worldName: fields.hard.worldName || fields.soft.worldName || "未命名世界",
    genre: fields.hard.genre || "未指定",
    tone: fields.hard.tone || "未指定",
    playerRole: fields.hard.playerRole || "未指定",
    protagonist: {
      name: fields.hard.protagonistName || "",
      role: fields.hard.protagonistRole || "",
      personality: fields.soft.protagonistPersonality || ""
    },
    world: {
      geography: fields.soft.geography || "",
      politicalStructure: fields.soft.politicalStructure || "",
      magicTechLevel: fields.soft.magicTechLevel || "",
      hook: fields.soft.worldHook || ""
    },
    rules: {
      coreRule: fields.soft.coreRule || "",
      limitations: fields.soft.limitations || ""
    },
    opening: {
      scene: fields.hard.openingScene || "",
      conflict: fields.soft.initialConflict || "",
      hook: fields.soft.openingHook || ""
    },
    events: {
      early: fields.soft.earlyEvents || ""
    },
    optional: fields.optional,
    risks: risks || [],
    estimatedCompleteness: 0,
    createdAt: session.createdAt,
    generatedAt: new Date().toISOString()
  };
  return blueprint;
}

export function validateBlueprint(blueprint) {
  const errors = [];
  if (!blueprint.worldName || blueprint.worldName === "未命名世界") errors.push("worldName required");
  if (!blueprint.genre || blueprint.genre === "未指定") errors.push("genre required");
  if (!blueprint.opening.scene) errors.push("openingScene required");
  return { valid: errors.length === 0, errors };
}
