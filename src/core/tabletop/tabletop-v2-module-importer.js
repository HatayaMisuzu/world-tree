// Tabletop V2 Module Importer
// Parses external tabletop module text (JSON, Markdown, plain text, YAML frontmatter)
// into structured Adventure Module drafts.
//
// step-by-step:
//   classify → extract sections → create draft → completeness check → preview

import { normalizeAdventureModule } from "./tabletop-v2-adventure-module.js";

// ── Input classification ──

export function classifyTabletopModuleInput(input = {}) {
  if (!input) return { type: "unknown", confidence: 0 };

  if (typeof input === "string") {
    const trimmed = input.trim();
    // JSON block (starts with {)
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { JSON.parse(trimmed); return { type: "json", confidence: 0.95 }; } catch {}
      return { type: "text", confidence: 0.3, note: "looks-like-json-but-invalid" };
    }
    // YAML frontmatter
    if (trimmed.startsWith("---")) {
      const end = trimmed.indexOf("---", 3);
      if (end > 3) return { type: "yaml_frontmatter", confidence: 0.9 };
    }
    // Markdown heuristics
    if (trimmed.match(/^#{1,3}\s+/m)) return { type: "markdown", confidence: 0.85 };
    if (trimmed.match(/^#\s+/m) || trimmed.match(/\*\*[^*]+\*\*/)) return { type: "markdown", confidence: 0.7 };

    return { type: "text", confidence: 0.5 };
  }

  if (typeof input === "object") {
    if (input.title || input.playerBrief || input.scenes) {
      return { type: "adventure_module_json", confidence: 0.9 };
    }
    return { type: "json_object", confidence: 0.6 };
  }

  return { type: "unknown", confidence: 0 };
}

// ── Section extraction from markdown/text ──

const SECTION_PATTERNS = [
  { key: "title",      re: /^#\s+(.+?)$/m, extract: 1 },
  { key: "premise",    re: /^#{1,3}[ \t]*(?:背景|前提|Premise|Setting|设定)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "objective",  re: /^#{1,3}[ \t]*(?:目标|目标|Objective|Goal)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "setting",    re: /^#{1,3}[ \t]*(?:世界|世界观|Setting|World)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "scenes",     re: /^#{1,3}[ \t]*(?:场景|Scenes|遭遇|Encounters)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "npcs",       re: /^#{1,3}[ \t]*(?:NPC|角色|人物|Characters)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "items",      re: /^#{1,3}[ \t]*(?:道具|装备|Items|Equipment|Loot)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "enemies",    re: /^#{1,3}[ \t]*(?:怪物|敌人|Enemies|Monsters)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "ruleset",    re: /^#{1,3}[ \t]*(?:规则|Ruleset|骰子|Dice)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "clocks",     re: /^#{1,3}[ \t]*(?:时钟|倒计时|Clocks|Timers)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "randomTables", re: /^#{1,3}[ \t]*(?:随机表|Random Tables|表格)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "gmNotes",    re: /^#{1,3}[ \t]*(?:GM\s*(?:笔记|Notes)|隐藏|Hidden|Secrets)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
  { key: "endings",    re: /^#{1,3}[ \t]*(?:结局|Endings|Bad\s*End)[ \t:：]*\n?([\s\S]*?)(?=\n#{1,3}[ \t]|(?![\s\S]))/m, extract: 1 },
];

export function extractTabletopModuleSectionsFromText(text = "") {
  if (typeof text !== "string" || text.trim().length === 0) return {};

  const sections = {};

  // Remove YAML frontmatter if present
  let content = text;
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end > 3) content = content.slice(end + 3);
  }

  for (const { key, re, extract } of SECTION_PATTERNS) {
    const m = content.match(re);
    if (m) {
      const val = (m[extract] || "").trim();
      if (val) sections[key] = val;
    }
  }

  // If no title extracted, use first heading or first line
  if (!sections.title) {
    const firstHeading = content.match(/^#\s+(.+)$/m);
    if (firstHeading) sections.title = firstHeading[1].trim();
    else {
      const firstLine = content.split("\n")[0].trim();
      if (firstLine && firstLine.length < 80) sections.title = firstLine;
    }
  }

  // Extract list items for NPCs, items, enemies
  for (const listKey of ["npcs", "items", "enemies", "scenes"]) {
    if (sections[listKey]) {
      sections[`${listKey}_parsed`] = extractListItems(sections[listKey]);
    }
  }

  return sections;
}

function extractListItems(text = "") {
  const items = [];
  const lines = text.split("\n");
  let current = null;
  for (const line of lines) {
    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      if (current) items.push(current);
      current = { name: listMatch[1].trim(), description: "" };
      continue;
    }
    if (current && line.trim()) {
      current.description += (current.description ? " " : "") + line.trim();
    }
  }
  if (current) items.push(current);
  return items;
}

// ── Create draft from external text ──

export function createAdventureModuleDraftFromExternalText(text = "", options = {}) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { error: "EMPTY_INPUT", message: "无法从空白文本创建模组草稿" };
  }

  const classification = classifyTabletopModuleInput(text);
  let draft;

  if (classification.type === "json" || classification.type === "adventure_module_json") {
    try {
      const parsed = typeof text === "string" ? JSON.parse(text) : text;
      draft = normalizeAdventureModule(parsed);
      return { draft, classification, sourceType: "structured_json" };
    } catch (e) {
      return { error: "JSON_PARSE_FAILED", message: e.message, classification };
    }
  }

  // Text / Markdown / YAML frontmatter path
  const sections = extractTabletopModuleSectionsFromText(text);

  const scenes = (sections.scenes_parsed || []).map((s, i) => ({
    sceneId: `scene_imported_${i + 1}`,
    title: s.name,
    description: s.description || "",
    isStarting: i === 0,
    isHidden: false,
    exitTransitions: [],
  }));

  const npcs = (sections.npcs_parsed || []).map((n, i) => ({
    name: n.name,
    isNpc: true,
    role: n.description || "未知角色",
  }));

  const moduleInput = {
    title: sections.title || options.defaultTitle || "导入冒险",
    sourceType: options.sourceType || "external_text",
    playerBrief: {
      premise: sections.premise || text.slice(0, 200).replace(/\n/g, " "),
      objective: sections.objective || "",
      setting: sections.setting || "",
      playerCharacters: options.playerCharacters || [],
      allowedActions: options.allowedActions || [],
    },
    gmBook: {
      hiddenTruth: sections.gmNotes || "",
      npcs,
      gmScenes: [],
      secretClocks: [],
      twistPoints: [],
    },
    scenes: scenes.length > 0 ? scenes : [
      { sceneId: "scene_start", title: "开场", description: sections.premise || text.slice(0, 300), isStarting: true, isHidden: false, exitTransitions: [] }
    ],
    characters: npcs,
    clocks: [],
    randomTables: [],
    constraints: [],
    endingConditions: sections.endings ? [{ conditionId: "ending_1", description: sections.endings }] : [],
    rulesetProfileId: options.rulesetProfileId || inferRulesetFromSections(sections),
  };

  draft = normalizeAdventureModule(moduleInput);
  return { draft, classification, sections, sourceType: "external_text" };
}

function inferRulesetFromSections(sections = {}) {
  const combined = Object.values(sections).join(" ").toLowerCase();
  if (combined.includes("d100") || combined.includes("调查")) return "d100_investigation";
  if (combined.includes("2d6") || combined.includes("叙事")) return "2d6_narrative";
  if (combined.includes("骰池") || combined.includes("dice pool")) return "dice_pool_pressure";
  if (combined.includes("轻骰") || combined.includes("故事")) return "low_dice_story";
  return "d20_fantasy";
}

// ── Build preview for UI ──

export function buildTabletopImportPreview(input = {}, options = {}) {
  const text = (typeof input === "string") ? input : (input.text || input.module || "");
  const classification = classifyTabletopModuleInput(text);

  if (classification.type === "json" || classification.type === "adventure_module_json") {
    try {
      const parsed = typeof text === "string" ? JSON.parse(text) : text;
      const mod = normalizeAdventureModule(parsed);
      return {
        status: "ok",
        type: "structured_json",
        title: mod.title,
        moduleId: mod.moduleId,
        rulesetProfileId: mod.rulesetProfileId,
        playerBriefPreview: {
          premise: mod.playerBrief?.premise?.slice(0, 200) || "",
          objective: mod.playerBrief?.objective?.slice(0, 200) || "",
        },
        sceneNames: (mod.scenes || []).map((s) => s.title),
        characterNames: (mod.characters || []).map((c) => c.name),
        clockCount: (mod.clocks || []).length,
        hasGmBook: !!(mod.gmBook?.hiddenTruth || mod.gmBook?.gmScenes?.length),
        warnings: (mod.title === "未命名冒险") ? ["未提供标题"] : [],
      };
    } catch {
      return { status: "error", code: "JSON_PARSE_FAILED", errorMsg: "无法解析 JSON" };
    }
  }

  // Text path
  const result = createAdventureModuleDraftFromExternalText(text, options);
  if (result.error) return { status: "error", code: result.error, errorMsg: result.message };

  const draft = result.draft;
  const sections = result.sections || {};

  return {
    status: "ok",
    type: result.sourceType || "external_text",
    classification: result.classification,
    title: draft.title,
    moduleId: draft.moduleId,
    rulesetProfileId: draft.rulesetProfileId,
    playerBriefPreview: {
      premise: (draft.playerBrief?.premise || "").slice(0, 200),
      objective: (draft.playerBrief?.objective || "").slice(0, 200),
      setting: (draft.playerBrief?.setting || "").slice(0, 200),
    },
    sceneNames: (draft.scenes || []).map((s) => s.title),
    characterNames: (draft.characters || []).map((c) => c.name),
    clockCount: (draft.clocks || []).length,
    hasGmBook: !!(draft.gmBook?.hiddenTruth || draft.gmBook?.gmScenes?.length),
    extractedSections: Object.keys(sections).filter((k) => !k.endsWith("_parsed")),
    warnings: [],
  };
}

// ── Normalize imported module ──

export function normalizeImportedAdventureModule(input = {}) {
  const text = (typeof input === "string") ? input : (input.text || input.module || "");
  if (!text && Object.keys(input).length === 0) return null;

  const result = createAdventureModuleDraftFromExternalText(text, input);
  if (result.error) return null;
  return result.draft;
}
