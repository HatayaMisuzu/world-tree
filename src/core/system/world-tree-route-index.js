export const WORLD_TREE_ROUTES = Object.freeze([
  { modeId: "quick-setting", productName: "快速设定", role: "consumer", status: "active", modeMeaning: "quick_setting", cacheNamespace: "quick-setting", stateNamespace: "quick-setting" },
  { modeId: "character", productName: "人物卡", role: "consumer", status: "active", modeMeaning: "character", cacheNamespace: "character", stateNamespace: "character" },
  { modeId: "world-rpg", productName: "世界书大世界模式", role: "consumer", status: "active", modeMeaning: "grand_world", cacheNamespace: "worldbook", stateNamespace: "world-rpg", note: "world-rpg是历史内部ID，产品语义=大世界模式" },
  { modeId: "tabletop", productName: "桌面叙事", role: "consumer", status: "active", modeMeaning: "solo_tabletop_narrative", cacheNamespace: "tabletop", stateNamespace: "tabletop" },
  { modeId: "mystery-puzzle", productName: "解谜调查", role: "consumer", status: "active", modeMeaning: "solo_mystery_puzzle", cacheNamespace: "mystery-puzzle", stateNamespace: "mystery-puzzle" },
  { modeId: "strategy-sim", productName: "策略模拟", role: "consumer", status: "active", modeMeaning: "solo_strategy_sim", cacheNamespace: "strategy-sim", stateNamespace: "strategy-sim" },
  { modeId: "murder-mystery", productName: "单人剧本杀", role: "consumer", status: "active", modeMeaning: "solo_murder_mystery", cacheNamespace: "murder-mystery", stateNamespace: "murder-mystery" },
  { modeId: "creation-forge", productName: "炼金台 · 资产生产工厂", role: "producer", status: "active", modeMeaning: "artifact_factory", cacheNamespace: "creation-forge", stateNamespace: "creation-forge" }
]);

export function listWorldTreeRoutes(options = {}) { return WORLD_TREE_ROUTES.map(r => ({ modeId: r.modeId, productName: r.productName, role: r.role, status: r.status })); }
export function getWorldTreeRoute(modeId, options = {}) { return WORLD_TREE_ROUTES.find(r => r.modeId === modeId) || null; }
export function resolveWorldTreeRoute(project = {}, options = {}) { return getWorldTreeRoute(project.mode || ""); }
export function validateAllWorldTreeRoutes() { return { ok: true, routes: WORLD_TREE_ROUTES.length }; }
export function createWorldTreeRouteSummary() { return { totalRoutes: WORLD_TREE_ROUTES.length, consumers: WORLD_TREE_ROUTES.filter(r => r.role==="consumer").length, producers: WORLD_TREE_ROUTES.filter(r => r.role==="producer").length }; }
