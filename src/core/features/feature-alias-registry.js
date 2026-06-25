// World Tree Feature Alias Registry
// Canonical product-feature truth source.
// Product rule: World Tree exposes exactly 8 canonical product features.
// Runtime slices such as tabletop-v2, detective-v2, character-v2, and single-player-scriptkill-v2
// are implementation aliases, not additional product features.

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s/]+/g, "-")
    .replace(/^mode:/, "")
    .replace(/^feature:/, "")
    .replace(/^runtime:/, "");
}

export const CANONICAL_PRODUCT_FEATURES = Object.freeze([
  Object.freeze({
    id: "quick-setting",
    zhName: "快速设定",
    enName: "Quick Setting",
    productOrder: 1,
    primaryModeId: "quick-setting",
    defaultDataMode: "preset",
    serviceNamespaces: Object.freeze(["quick-setting"]),
    aliases: Object.freeze(["quick-setting", "quick_setting", "quick", "preset", "快速设定", "快速开始", "快速项目"]),
  }),
  Object.freeze({
    id: "character",
    zhName: "人物卡",
    enName: "Character",
    productOrder: 2,
    primaryModeId: "character",
    defaultDataMode: "character_card",
    serviceNamespaces: Object.freeze(["characters", "characters-v2", "character-v2"]),
    aliases: Object.freeze(["character", "character-card", "character_card", "character-v2", "character-capsule-v2", "characters-v2", "人物卡", "角色", "角色卡"]),
  }),
  Object.freeze({
    id: "world-rpg",
    zhName: "世界书大世界",
    enName: "World RPG",
    productOrder: 3,
    primaryModeId: "world-rpg",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["world-rpg", "worldbook", "grand-world"]),
    aliases: Object.freeze(["world-rpg", "world_rpg", "worldbook-rpg", "grand-world", "grand_world", "worldbook", "世界书", "世界书大世界", "大世界", "世界冒险"]),
  }),
  Object.freeze({
    id: "tabletop",
    zhName: "桌面叙事",
    enName: "Tabletop",
    productOrder: 4,
    primaryModeId: "tabletop",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["tabletop", "tabletop-v2"]),
    aliases: Object.freeze(["tabletop", "tabletop-v2", "tabletop_v2", "桌面叙事", "跑团", "单人跑团", "trpg", "ttrpg"]),
  }),
  Object.freeze({
    id: "mystery-puzzle",
    zhName: "解谜调查",
    enName: "Mystery Puzzle",
    productOrder: 5,
    primaryModeId: "mystery-puzzle",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["mystery-puzzle", "detective-v2"]),
    aliases: Object.freeze(["mystery-puzzle", "mystery_puzzle", "mystery", "detective", "detective-v2", "detective_v2", "侦探调查", "解谜调查", "推理调查", "线索调查"]),
  }),
  Object.freeze({
    id: "strategy-sim",
    zhName: "策略模拟",
    enName: "Strategy Sim",
    productOrder: 6,
    primaryModeId: "strategy-sim",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["strategy-sim"]),
    aliases: Object.freeze(["strategy-sim", "strategy_sim", "strategy", "策略模拟", "策略推演", "阵营模拟", "局势推演"]),
  }),
  Object.freeze({
    id: "murder-mystery",
    zhName: "单人剧本杀",
    enName: "Single-player ScriptKill",
    productOrder: 7,
    primaryModeId: "murder-mystery",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["murder-mystery", "single-player-scriptkill-v2"]),
    aliases: Object.freeze([
      "murder-mystery", "murder_mystery", "murdermystery",
      "single-player-scriptkill-v2", "single_player_scriptkill_v2", "single-player-scriptkill", "single_player_scriptkill",
      "scriptkill", "script-kill", "script_kill",
      "剧本杀", "单人剧本杀", "剧本杀v2", "solo-scriptkill", "solo-script-kill"
    ]),
  }),
  Object.freeze({
    id: "creation-forge",
    zhName: "炼金台",
    enName: "Creation Forge",
    productOrder: 8,
    primaryModeId: "creation-forge",
    defaultDataMode: "worldbook",
    serviceNamespaces: Object.freeze(["creation-forge", "alchemy"]),
    aliases: Object.freeze(["creation-forge", "creation_forge", "alchemy", "forge", "炼金台", "创作炼金", "素材炼金", "素材工坊"]),
  }),
]);

const aliasToId = new Map();
for (const feature of CANONICAL_PRODUCT_FEATURES) {
  aliasToId.set(normalizeToken(feature.id), feature.id);
  aliasToId.set(normalizeToken(feature.primaryModeId), feature.id);
  for (const ns of feature.serviceNamespaces || []) aliasToId.set(normalizeToken(ns), feature.id);
  for (const alias of feature.aliases || []) aliasToId.set(normalizeToken(alias), feature.id);
}

export const FEATURE_ALIAS_REGISTRY = Object.freeze(Object.fromEntries(
  CANONICAL_PRODUCT_FEATURES.map(feature => [feature.id, feature])
));

export function listCanonicalProductFeatures() {
  return CANONICAL_PRODUCT_FEATURES.map(feature => ({ ...feature, aliases: [...feature.aliases], serviceNamespaces: [...feature.serviceNamespaces] }));
}

export function canonicalFeatureId(value = "") {
  const token = normalizeToken(value);
  return aliasToId.get(token) || "";
}

export function resolveFeatureAlias(value = "") {
  const id = canonicalFeatureId(value);
  return id ? FEATURE_ALIAS_REGISTRY[id] : null;
}

export function isSameFeature(a = "", b = "") {
  const aId = canonicalFeatureId(a);
  const bId = canonicalFeatureId(b);
  return Boolean(aId && bId && aId === bId);
}

export function assertCanonicalFeatureCount(expected = 8) {
  const count = CANONICAL_PRODUCT_FEATURES.length;
  if (count !== expected) {
    throw new Error(`Expected ${expected} canonical product features, got ${count}`);
  }
  const ids = new Set(CANONICAL_PRODUCT_FEATURES.map(f => f.id));
  if (ids.size !== count) throw new Error("Duplicate canonical product feature ids detected");
  return true;
}

export function productFeatureForRuntime({ modeId = "", serviceNamespace = "", route = "", dataMode = "" } = {}) {
  for (const value of [modeId, serviceNamespace, route, dataMode]) {
    const id = canonicalFeatureId(value);
    if (id) return FEATURE_ALIAS_REGISTRY[id];
  }
  const routeText = normalizeToken(route);
  if (routeText.includes("single-player-scriptkill-v2")) return FEATURE_ALIAS_REGISTRY["murder-mystery"];
  if (routeText.includes("detective-v2")) return FEATURE_ALIAS_REGISTRY["mystery-puzzle"];
  if (routeText.includes("tabletop-v2")) return FEATURE_ALIAS_REGISTRY["tabletop"];
  if (routeText.includes("characters-v2") || routeText.includes("character-v2")) return FEATURE_ALIAS_REGISTRY["character"];
  if (routeText.includes("alchemy")) return FEATURE_ALIAS_REGISTRY["creation-forge"];
  return null;
}
