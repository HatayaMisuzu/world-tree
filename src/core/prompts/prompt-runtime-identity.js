// prompt-runtime-identity.js
// Resolve mode/data runtime identity for prompt usage.
// dataMode remains storage-level; promptModeId is gameplay prompt-level.

import { canonicalFeatureId } from "../features/feature-alias-registry.js";

export const PROMPT_MODE_PROFILES = Object.freeze({
  "quick-setting": Object.freeze({
    modeId: "quick-setting",
    dataMode: "preset",
    promptModeId: "quick-setting",
    writerProfile: "setting-minimal",
    llmNarrationDefault: "setting-collaboration"
  }),
  character: Object.freeze({
    modeId: "character",
    dataMode: "character_card",
    promptModeId: "character",
    writerProfile: "character-roleplay",
    llmNarrationDefault: "character-live"
  }),
  "world-rpg": Object.freeze({
    modeId: "world-rpg",
    dataMode: "worldbook",
    promptModeId: "world-rpg",
    writerProfile: "grand-world",
    llmNarrationDefault: "world-rpg-dm"
  }),
  tabletop: Object.freeze({
    modeId: "tabletop",
    dataMode: "worldbook",
    promptModeId: "tabletop",
    writerProfile: "tabletop-gm",
    llmNarrationDefault: "tabletop-deterministic-plus-polish"
  }),
  "mystery-puzzle": Object.freeze({
    modeId: "mystery-puzzle",
    dataMode: "worldbook",
    promptModeId: "mystery-puzzle",
    writerProfile: "clue-puzzle",
    llmNarrationDefault: "graded-hints"
  }),
  "strategy-sim": Object.freeze({
    modeId: "strategy-sim",
    dataMode: "worldbook",
    promptModeId: "strategy-sim",
    writerProfile: "strategy-sim",
    llmNarrationDefault: "bounded-simulation"
  }),
  "murder-mystery": Object.freeze({
    modeId: "murder-mystery",
    dataMode: "worldbook",
    promptModeId: "murder-mystery",
    writerProfile: "truth-lock-host",
    llmNarrationDefault: "suspect-boundary"
  }),
  "creation-forge": Object.freeze({
    modeId: "creation-forge",
    dataMode: "worldbook",
    promptModeId: "creation-forge",
    writerProfile: "candidate-factory",
    llmNarrationDefault: "candidate-only"
  })
});

const DATA_MODE_FALLBACK = Object.freeze({
  preset: "quick-setting",
  character_card: "character",
  worldbook: "world-rpg"
});

const WORLD_SUBTYPE_TO_MODE = Object.freeze({
  classic: "world-rpg",
  rpg: "world-rpg",
  tabletop: "tabletop",
  sim: "strategy-sim",
  strategy: "strategy-sim",
  "murder-mystery": "murder-mystery",
  mystery: "mystery-puzzle",
  "mystery-puzzle": "mystery-puzzle"
});

export function resolvePromptRuntimeIdentity(input = {}) {
  const explicitModeId = asText(input.modeId || input.mode || input.modeID);
  const dataMode = asText(input.dataMode);
  const worldSubType = asText(input.worldSubType || input.subType);
  const canonicalModeId = canonicalFeatureId(explicitModeId) || canonicalFeatureId(worldSubType) || canonicalFeatureId(dataMode);

  let profile = canonicalModeId ? PROMPT_MODE_PROFILES[canonicalModeId] : null;

  if (!profile && explicitModeId) {
    profile = PROMPT_MODE_PROFILES[explicitModeId] || null;
  }

  if (!profile && worldSubType) {
    profile = PROMPT_MODE_PROFILES[WORLD_SUBTYPE_TO_MODE[worldSubType]] || null;
  }

  if (!profile && dataMode) {
    profile = PROMPT_MODE_PROFILES[DATA_MODE_FALLBACK[dataMode]] || null;
  }

  if (!profile) profile = PROMPT_MODE_PROFILES["world-rpg"];

  return {
    ...profile,
    requestedModeId: explicitModeId || "",
    requestedDataMode: dataMode || "",
    requestedWorldSubType: worldSubType || "",
    canonicalFeatureId: profile.modeId,
    storageDataMode: dataMode || profile.dataMode,
    promptModeId: profile.promptModeId,
    warnings: buildWarnings({ explicitModeId, dataMode, worldSubType, profile })
  };
}

function buildWarnings({ explicitModeId, dataMode, worldSubType, profile }) {
  const warnings = [];
  if (explicitModeId && profile.modeId !== explicitModeId) {
    warnings.push(`modeId ${explicitModeId} resolved to ${profile.modeId}`);
  }
  if (dataMode && profile.dataMode !== dataMode) {
    warnings.push(`dataMode ${dataMode} differs from prompt profile dataMode ${profile.dataMode}`);
  }
  if (!explicitModeId && dataMode === "worldbook") {
    warnings.push("worldbook dataMode without modeId falls back to world-rpg prompt profile");
  }
  return warnings;
}

function asText(v) {
  return String(v ?? "").trim();
}

export function getPromptModeId(input = {}) {
  return resolvePromptRuntimeIdentity(input).promptModeId;
}

export function isKnownPromptMode(modeId) {
  return Boolean(PROMPT_MODE_PROFILES[modeId]);
}
