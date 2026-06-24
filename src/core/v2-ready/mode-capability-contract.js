// src/core/v2-ready/mode-capability-contract.js — v2-ready per-mode capability declaration
// Stage 4: each mode declares what it can accept and produce in V2.

const KNOWN_MODES = Object.freeze([
  "quick-setting", "character", "world-rpg", "tabletop",
  "mystery-puzzle", "strategy-sim", "murder-mystery", "creation-forge"
]);

const BUILTIN_CAPABILITIES = Object.freeze({
  "quick-setting": {
    modeId: "quick-setting",
    acceptedAssetTypes: ["raw_setting", "prompt_hints", "panel_hints", "command_hints"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: false,
    supportsHiddenInfo: true,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["detectedOpeningQuestions", "detectedCommands", "detectedPanels", "minimalPlayPacket"]
  },
  "character": {
    modeId: "character",
    acceptedAssetTypes: ["character_card", "personality", "boundary", "memory_candidate", "relation"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: false,
    supportsHiddenInfo: true,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["relationshipState", "boundaries", "confirmedUserFacts", "memoryCandidates", "relationshipEvents", "forbiddenAssumptions"]
  },
  "world-rpg": {
    modeId: "world-rpg",
    acceptedAssetTypes: ["world_entity", "location", "region_state", "world_event", "public_goal", "hidden_storyline"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: true,
    supportsHiddenInfo: true,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["worldEntityRef", "locationRef", "regionStateCandidate", "worldEventCandidate", "timeBinding", "publicGoalRef", "hiddenStorylineRef"]
  },
  "tabletop": {
    modeId: "tabletop",
    acceptedAssetTypes: ["rule_ref", "check_result", "challenge", "clock", "failure_consequence"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: false,
    supportsHiddenInfo: false,
    supportsNumericalState: true,
    supportsProbability: true,
    v2ReadyFields: ["ruleSourceRef", "checkResult", "difficultyTag", "challengeState", "clockState", "failureConsequenceCandidate", "runtimeTruth"]
  },
  "mystery-puzzle": {
    modeId: "mystery-puzzle",
    acceptedAssetTypes: ["clue", "hypothesis", "evidence_link", "contradiction", "truth_lock", "reveal_condition"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: true,
    supportsHiddenInfo: true,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["clueRecord", "hypothesisRecord", "evidenceLink", "contradictionCandidate", "truthLock", "revealCondition", "knownToPlayer"]
  },
  "strategy-sim": {
    modeId: "strategy-sim",
    acceptedAssetTypes: ["resource", "variable", "probability_event", "policy", "decision", "state_panel"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: false,
    supportsHiddenInfo: true,
    supportsNumericalState: true,
    supportsProbability: true,
    v2ReadyFields: ["displayStats", "strategicVariables", "probabilityEvents", "numericState", "probabilityPolicy"]
  },
  "murder-mystery": {
    modeId: "murder-mystery",
    acceptedAssetTypes: ["case", "suspect", "testimony", "alibi", "motive", "timeline_fragment", "interrogation"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: true,
    supportsHiddenInfo: true,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["caseRecord", "suspectRef", "testimonyRecord", "alibiClaim", "motiveCandidate", "caseTimelineFragment", "truthVisibility", "interrogationRecord"]
  },
  "creation-forge": {
    modeId: "creation-forge",
    acceptedAssetTypes: ["source_material", "artifact_candidate", "blueprint", "artifact"],
    writesRuntime: true,
    writesCandidates: true,
    writesCanon: false,
    requiresTruthLock: false,
    supportsHiddenInfo: false,
    supportsNumericalState: false,
    supportsProbability: false,
    v2ReadyFields: ["sourceMaterialRef", "artifactCandidate", "targetMode", "artifactType", "extractionTrace", "compatibilityCheck", "validationResult"]
  }
});

export function getModeCapability(modeId) {
  const cap = BUILTIN_CAPABILITIES[modeId];
  if (!cap) return null;
  return Object.freeze({ ...cap });
}

export function validateModeAssetCompatibility(assetType, modeId) {
  const cap = getModeCapability(modeId);
  if (!cap) return { ok: false, error: `unknown mode: ${modeId}` };
  if (!cap.acceptedAssetTypes.includes(assetType)) {
    return { ok: false, error: `mode ${modeId} does not accept asset type: ${assetType}`, accepted: cap.acceptedAssetTypes };
  }
  return { ok: true };
}

export function listModes() {
  return [...KNOWN_MODES];
}

export function getAllCapabilities() {
  return Object.fromEntries(
    KNOWN_MODES.map(id => [id, getModeCapability(id)])
  );
}
