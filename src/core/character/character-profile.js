export function createCharacterProfile(input = {}, options = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    profileType: "world_tree_character_profile",
    id: input.id || "primary",
    name: input.name || "未命名角色",
    displayName: input.displayName || input.name || "未命名角色",
    source: {
      format: input.format || "unknown",
      specVersion: input.specVersion || "",
      sourceType: input.sourceType || "imported",
      rawPreserved: true
    },
    card: {
      description: input.description || "",
      personality: input.personality || "",
      scenario: input.scenario || "",
      firstMessage: input.firstMessage || "",
      messageExamples: input.messageExamples || "",
      creatorNotes: input.creatorNotes || "",
      systemPrompt: input.systemPrompt || "",
      postHistoryInstructions: input.postHistoryInstructions || "",
      alternateGreetings: Array.isArray(input.alternateGreetings) ? [...input.alternateGreetings] : [],
      tags: Array.isArray(input.tags) ? [...input.tags] : [],
      creator: input.creator || "",
      characterVersion: input.characterVersion || ""
    },
    personality: input.personalityTraits || {},
    expressionDNA: input.expressionDNA || { catchphrases: [], hesitationMarkers: [], forbiddenDrift: [] },
    relationship: input.relationship || { allowedProgression: [], forbiddenAssumptions: [] },
    appearance: input.appearance || { stableFeatures: [], styleRules: [], doNotChange: [] },
    lore: input.lore || { characterBook: null, worldInfoRefs: [] },
    persona: input.persona || { defaultPersonaId: null, personaSeed: {} },
    quality: input.quality || { oocNegatives: [], driftRisks: [], sourceConfidence: "unknown" },
    extensions: input.extensions || {},
    raw: input.raw || {},
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

export function normalizeCharacterProfile(profile = {}, options = {}) {
  return {
    ...profile,
    id: profile.id || "primary",
    name: profile.name || "未命名角色",
    card: {
      ...profile.card,
      alternateGreetings: Array.isArray(profile.card?.alternateGreetings) ? profile.card.alternateGreetings : [],
      tags: Array.isArray(profile.card?.tags) ? profile.card.tags : []
    },
    extensions: profile.extensions && typeof profile.extensions === "object" ? profile.extensions : {},
    raw: profile.raw && typeof profile.raw === "object" ? profile.raw : {}
  };
}

export function validateCharacterProfile(profile = {}, options = {}) {
  const errors = [], warnings = [];
  if (!profile.id) errors.push({ code: "missing_id", message: "id is required" });
  if (!profile.schemaVersion) errors.push({ code: "missing_schema", message: "schemaVersion required" });
  if (!profile.name || profile.name === "未命名角色") warnings.push({ code: "unnamed", message: "using default name" });
  return { ok: errors.length === 0, errors, warnings };
}

export function mergeCharacterProfilePatch(profile, patch = {}, options = {}) {
  const base = normalizeCharacterProfile(profile);
  return {
    ...base,
    name: patch.name ?? base.name,
    displayName: patch.displayName ?? base.displayName,
    card: { ...base.card, ...(patch.card || {}) },
    personality: { ...base.personality, ...(patch.personality || {}) },
    expressionDNA: { ...base.expressionDNA, ...(patch.expressionDNA || {}) },
    appearance: { ...base.appearance, ...(patch.appearance || {}) },
    quality: { ...base.quality, ...(patch.quality || {}) },
    updatedAt: new Date().toISOString()
  };
}

export function createCharacterProfileSummary(profile = {}, options = {}) {
  return {
    id: profile.id || "",
    name: profile.name || "",
    format: profile.source?.format || "unknown",
    hasFirstMessage: Boolean(profile.card?.firstMessage),
    alternateGreetingCount: profile.card?.alternateGreetings?.length || 0,
    hasCharacterBook: Boolean(profile.lore?.characterBook),
    hasExtensions: Object.keys(profile.extensions || {}).length > 0,
    sourceConfidence: profile.quality?.sourceConfidence || "unknown"
  };
}

export function createCharacterProfileFiles(profile = {}, options = {}) {
  return {
    "shared/character_profile.json": profile,
    "shared/characters.json": {
      schemaVersion: 1,
      primaryCharacterId: profile.id || "primary",
      items: [{
        id: profile.id || "primary",
        name: profile.name || "未命名角色",
        sourceType: "character_card",
        cardFormat: profile.source?.format || "unknown",
        profileRef: "shared/character_profile.json",
        rawTextRef: "runtime/source.txt",
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: profile.updatedAt || new Date().toISOString()
      }]
    }
  };
}
