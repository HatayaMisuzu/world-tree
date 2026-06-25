// Tabletop V2 Adventure Module / Book Contract
// Normalization, validation, and extraction of adventure module assets.
// Separates player-visible brief from hidden GM book.

import { normalizeModeAssetBindings } from "../mode/mode-asset-linkage-contract.js";

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
    assetBindings: normalizeModeAssetBindings({
      modeId: "tabletop",
      moduleId: input.moduleId || input.id,
      worldbookRefs: input.worldbookRefs || input.assetBindings?.worldbookRefs || [],
      characterRefs: input.characterRefs || input.assetBindings?.characterRefs || [],
      rulesetRefs: input.rulesetRefs || input.assetBindings?.rulesetRefs || [],
      clockRefs: input.clockRefs || input.assetBindings?.clockRefs || [],
      randomTableRefs: input.randomTableRefs || input.assetBindings?.randomTableRefs || [],
      uiComponentRefs: input.uiComponentRefs || input.assetBindings?.uiComponentRefs || [],
      sourceRefs: input.sourceRefs || input.assetBindings?.sourceRefs || [],
    }),
    // backward compat aliases
    worldbookRefs: (input.worldbookRefs || input.assetBindings?.worldbookRefs || []).slice(),
    constraints: input.constraints || {
      allowedActionTypes: input.constraints?.allowedActionTypes || ["explore", "social", "combat", "investigate", "use_skill", "stealth", "knowledge"],
      forbiddenActions: input.constraints?.forbiddenActions || [],
      outOfScopePatterns: input.constraints?.outOfScopePatterns || [],
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
    isEnding: scene.isEnding || false,
    allowedActions: scene.allowedActions || [],
    allowedActionTypes: scene.allowedActionTypes || [],
    forbiddenActions: scene.forbiddenActions || [],
    transitions: scene.transitions || [],
    allowedTransitions: scene.allowedTransitions || [],
    npcs: scene.npcs || [],
    clues: scene.clues || [],
    requiredClues: scene.requiredClues || [],
    requiredFlags: scene.requiredFlags || [],
    lockedUntil: scene.lockedUntil || null,
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

export function validatePlayerIntentAgainstBook({ module, scene, runState, intent, classification }) {
  if (!intent || typeof intent !== "string" || intent.trim().length === 0) {
    return { allowed: false, reason: "empty intent", suggestion: "请输入一个行动描述。", severity: "block", source: "system" };
  }

  const actionType = classification?.type || "explore";
  const lowerIntent = intent.toLowerCase();

  // 1. Module-level forbidden actions (exact text match)
  const moduleForbidden = module.constraints?.forbiddenActions || [];
  for (const fb of moduleForbidden) {
    if (lowerIntent.includes(fb.toLowerCase())) {
      return {
        allowed: false,
        reason: `模组禁止此行动: ${fb}`,
        suggestion: `模组规则不允许: "${fb}"。请尝试其他行动方式。`,
        severity: "block",
        source: "module",
      };
    }
  }

  // 2. Module-level out-of-scope patterns
  const outOfScope = module.constraints?.outOfScopePatterns || [];
  for (const pattern of outOfScope) {
    try {
      if (new RegExp(pattern, "i").test(intent)) {
        return {
          allowed: false,
          reason: `行动超出模组范围: ${pattern}`,
          suggestion: "该行动不在本模组支持范围内，请尝试有意义的冒险行动。",
          severity: "block",
          source: "module",
        };
      }
    } catch { /* invalid regex, skip */ }
  }

  // 3. Module-level allowed action types (enforce if non-empty)
  const moduleAllowed = module.constraints?.allowedActionTypes || [];
  if (moduleAllowed.length > 0 && !moduleAllowed.includes(actionType)) {
    return {
      allowed: false,
      reason: `模组不允许 ${actionType} 类型的行动`,
      suggestion: `当前模组允许的行动类型: ${moduleAllowed.join("、")}。请从这些类型中尝试。`,
      severity: "block",
      source: "module",
    };
  }

  // 4. Scene-level constraints
  if (scene) {
    // 4a. Scene forbidden actions
    const sceneForbidden = scene.forbiddenActions || [];
    for (const fb of sceneForbidden) {
      if (lowerIntent.includes(fb.toLowerCase())) {
        return {
          allowed: false,
          reason: `当前场景禁止: ${fb}`,
          suggestion: `在${scene.title}中不能执行"${fb}"。请尝试其他方式。`,
          severity: "block",
          source: "scene",
        };
      }
    }

    // 4b. Scene allowed action types (enforce if non-empty)
    const sceneAllowed = scene.allowedActionTypes || scene.allowedActions || [];
    const typeLabels = sceneAllowed.filter((a) => typeof a === "string");
    if (typeLabels.length > 0 && !typeLabels.includes(actionType)) {
      return {
        allowed: false,
        reason: `当前场景不允许 ${actionType} 类型的行动`,
        suggestion: `在${scene.title}中可以尝试: ${typeLabels.join("、")}。`,
        severity: "block",
        source: "scene",
      };
    }

    // 4c. Scene lock conditions
    if (scene.lockedUntil && typeof scene.lockedUntil === "object") {
      const flags = runState?.publicState?._flags || {};
      for (const [key, value] of Object.entries(scene.lockedUntil)) {
        if (flags[key] !== value) {
          return {
            allowed: false,
            reason: `场景尚未解锁 (需要 ${key}=${value})`,
            suggestion: "当前行动在此场景还不可用，请先探索其他路径。",
            severity: "block",
            source: "scene",
          };
        }
      }
    }

    // 4d. Required clues/flags
    const requiredClues = scene.requiredClues || [];
    if (requiredClues.length > 0) {
      const discoveredClues = runState?.publicState?._discoveredClues || [];
      const missing = requiredClues.filter((c) => !discoveredClues.includes(c));
      if (missing.length > 0) {
        return {
          allowed: false,
          reason: `缺少关键线索: ${missing.join(", ")}`,
          suggestion: "你需要先收集足够的信息才能在此场景推进。",
          severity: "warn",
          source: "scene",
        };
      }
    }

    // 4e. Allowed transitions (for movement actions)
    if (actionType === "explore" && scene.allowedTransitions?.length > 0) {
      const targetMatch = intent.match(/前往|进入|移动到|走到|去\s*(.+)/);
      if (targetMatch) {
        const target = targetMatch[1].trim();
        const transition = scene.allowedTransitions.find(
          (t) => t.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(t.toLowerCase())
        );
        if (!transition) {
          return {
            allowed: false,
            reason: `无法从${scene.title}前往该地点`,
            suggestion: `从${scene.title}可以去: ${scene.allowedTransitions.join("、")}。`,
            severity: "block",
            source: "scene",
          };
        }
      }
    }
  }

  // 5. Default: allow
  return { allowed: true, reason: null, suggestion: null, severity: "ok", source: "system" };
}
