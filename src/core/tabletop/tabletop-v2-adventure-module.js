// Tabletop V2 Adventure Module / Book Contract
// Normalization, validation, and extraction of adventure module assets.
// Separates player-visible brief from hidden GM book.

// ── Schema version ──

const SCHEMA_VERSION = "world-tree.tabletop.v2.module.1";

// ── Normalizer ──

export function normalizeAdventureModule(input = {}) {
  if (!input || typeof input !== "object") return null;

  const module = {
    schemaVersion: input.schemaVersion || SCHEMA_VERSION,
    moduleId: input.moduleId || input.id || `tabletop_${Date.now()}`,
    title: input.title || "未命名冒险",
    sourceType: input.sourceType || "quick_start",
    rulesetProfileId: input.rulesetProfileId || input.ruleset?.rulesetId || "d20_fantasy",
    ruleset: input.ruleset || null,
    // player-visible brief
    playerBrief: input.playerBrief || input.brief || {
      premise: input.premise || "",
      objective: input.objective || "",
      setting: input.setting || "",
      playerCharacters: input.playerCharacters || input.characters?.filter((c) => !c.isNpc) || [],
      allowedActions: input.allowedActions || input.playerBrief?.allowedActions || [],
      startingScene: input.startingScene || input.playerBrief?.startingScene || null,
    },
    // hidden GM book
    gmBook: input.gmBook || {
      hiddenTruth: input.hiddenTruth || input.gmNotes || "",
      npcs: input.npcs || input.characters?.filter((c) => c.isNpc) || [],
      gmScenes: input.gmScenes || [],
      secretClocks: input.secretClocks || [],
      twistPoints: input.twistPoints || [],
    },
    scenes: (input.scenes || []).map(normalizeScene),
    characters: (input.characters || []).map((c) => ({
      name: c.name || "未命名",
      isNpc: c.isNpc !== undefined ? c.isNpc : false,
      role: c.role || "",
      stats: c.stats || {},
      notes: c.notes || "",
    })),
    worldbookRefs: input.worldbookRefs || [],
    clocks: (input.clocks || []).map(normalizeClockFromModule),
    randomTables: input.randomTables || [],
    startPolicy: input.startPolicy || { type: "default", requirePlayerCharacter: true },
    savePolicy: input.savePolicy || { type: "default", maxSlots: 10 },
    branchPolicy: input.branchPolicy || { type: "default", allowArbitraryFork: true },
    endingPolicy: input.endingPolicy || { type: "default", summaryTemplate: null },
    assetLinks: input.assetLinks || {},
    constraints: input.constraints || {
      allowedActionTypes: input.constraints?.allowedActionTypes || ["explore", "social", "combat", "investigate", "use_skill"],
      forbiddenActions: input.constraints?.forbiddenActions || [],
      sceneTransitions: input.constraints?.sceneTransitions || {},
    },
    // preserve unknown fields
    _extra: input._extra || {},
  };

  return module;
}

function normalizeScene(scene = {}) {
  return {
    sceneId: scene.sceneId || scene.id || `scene_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: scene.title || "未命名场景",
    description: scene.description || "",
    isStarting: scene.isStarting || false,
    allowedActions: scene.allowedActions || [],
    transitions: scene.transitions || [],
    npcs: scene.npcs || [],
    clues: scene.clues || [],
    isHidden: scene.isHidden || false,
    gmNotes: scene.gmNotes || "",
  };
}

function normalizeClockFromModule(clock = {}) {
  return {
    id: clock.id || `clock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: clock.label || "时钟",
    segments: clock.segments || 4,
    value: clock.value !== undefined ? clock.value : 0,
    visibility: clock.visibility || "public",
    source: clock.source || "module",
  };
}

// ── Validator ──

export function validateAdventureModule(module = {}) {
  const errors = [];
  if (!module.moduleId) errors.push("moduleId is required");
  if (!module.title) errors.push("title is required");
  if (!module.rulesetProfileId && !module.ruleset?.rulesetId) errors.push("rulesetProfileId or ruleset is required");
  if (!Array.isArray(module.scenes)) errors.push("scenes must be an array");
  if (!Array.isArray(module.characters)) errors.push("characters must be an array");
  if (!module.playerBrief) errors.push("playerBrief is required");
  const sourceTypes = ["imported_pdf", "markdown", "json", "quick_start", "world_tree_bundle", "existing_project_assets"];
  if (!sourceTypes.includes(module.sourceType)) errors.push(`unknown sourceType: ${module.sourceType}`);
  return { valid: errors.length === 0, errors };
}

// ── Extractors ──

export function extractPlayerBrief(module = {}) {
  const brief = module.playerBrief || {};
  return {
    title: module.title,
    premise: brief.premise || "",
    objective: brief.objective || "",
    setting: brief.setting || "",
    allowedActions: brief.allowedActions || [],
    playerCharacters: brief.playerCharacters || [],
    startingScene: brief.startingScene || null,
    // never include gmBook
  };
}

export function extractHiddenGmBook(module = {}) {
  const gm = module.gmBook || {};
  return {
    hiddenTruth: gm.hiddenTruth || "",
    npcs: gm.npcs || [],
    gmScenes: gm.gmScenes || [],
    secretClocks: gm.secretClocks || [],
    twistPoints: gm.twistPoints || [],
    // include hidden scenes
    hiddenScenes: (module.scenes || []).filter((s) => s.isHidden),
  };
}

// ── Start state resolution ──

export function resolveStartState(module = {}, options = {}) {
  const startScene = (module.scenes || []).find((s) => s.isStarting) || module.scenes?.[0] || null;
  const pc = options.playerCharacter || module.playerBrief?.playerCharacters?.[0] || null;

  return {
    currentSceneId: startScene?.sceneId || null,
    currentSceneTitle: startScene?.title || null,
    playerCharacter: pc ? { name: pc.name, role: pc.role, stats: pc.stats || {} } : null,
    initialNarrative: startScene?.description || module.playerBrief?.premise || "",
    publicClocks: (module.clocks || []).filter((c) => c.visibility !== "hidden").map((c) => ({ ...c })),
    resources: options.resources || {},
  };
}

// ── Scene resolution ──

export function resolveCurrentScene(module = {}, runState = {}) {
  const sceneId = runState.currentSceneId;
  if (!sceneId) return null;
  const scene = (module.scenes || []).find((s) => s.sceneId === sceneId);
  if (!scene) return null;
  return {
    ...scene,
    // resolve NPC details from module characters
    resolvedNpcs: (scene.npcs || []).map((npcRef) => {
      const char = (module.characters || []).find((c) => c.name === npcRef.name || c.name === npcRef);
      return char || (typeof npcRef === "string" ? { name: npcRef } : npcRef);
    }),
  };
}

// ── Intent validation ──

export function validatePlayerIntentAgainstBook({ module, scene, runState, intent }) {
  if (!intent || typeof intent !== "string" || intent.trim().length === 0) {
    return { allowed: false, reason: "empty intent", suggestion: null };
  }

  // Check scene constraints
  if (scene) {
    if (scene.allowedActions && scene.allowedActions.length > 0) {
      // scene has explicit allowlist — intent classification deferred to turn ruling
      // but we can do a basic check: if intent contains clearly forbidden keywords
    }
  }

  // Check module-level constraints
  const forbidden = module.constraints?.forbiddenActions || [];
  const lowerIntent = intent.toLowerCase();
  for (const fb of forbidden) {
    if (lowerIntent.includes(fb.toLowerCase())) {
      return {
        allowed: false,
        reason: `action forbidden by book: ${fb}`,
        suggestion: `Book does not allow: ${fb}. Try a different approach.`,
      };
    }
  }

  // Check if intent goes beyond allowed action types / impossible in current scene
  const allowed = module.constraints?.allowedActionTypes || ["explore", "social", "combat", "investigate", "use_skill"];
  // We don't enforce this strictly here — turn ruling will classify
  // But we flag if intent seems to violate the book's declared themes

  return { allowed: true, reason: null, suggestion: null };
}
