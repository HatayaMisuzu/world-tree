import { hasModePromptProfile } from "../prompts/mode-prompt-registry.js";

export const WORLD_TREE_ROUTES = Object.freeze([
  {
    modeId: "quick-setting", productName: "快速设定", role: "consumer", status: "active",
    modeMeaning: "quick_setting", adapterId: "quick-setting",
    promptProfileId: "quick_setting_v1",
    inputPacketType: "quick_setting_input_packet_v1",
    outputPacketType: "quick_setting_output_packet_v1",
    stateNamespace: "quick-setting", cacheNamespace: "quick-setting",
    proposalLog: "runtime/quick-setting-proposals.jsonl",
    sharedFiles: ["shared/quick_setting.json"],
    cacheFiles: ["runtime/cache/quick-setting/"],
    routeWarnings: []
  },
  {
    modeId: "character", productName: "人物卡", role: "consumer", status: "active",
    modeMeaning: "character", adapterId: "character",
    promptProfileId: "character_v1",
    inputPacketType: "character_input_packet_v1",
    outputPacketType: "character_output_packet_v1",
    stateNamespace: "character", cacheNamespace: "character",
    proposalLog: "runtime/character-proposals.jsonl",
    sharedFiles: ["shared/characters.json"],
    cacheFiles: ["runtime/cache/character/"],
    routeWarnings: []
  },
  {
    modeId: "world-rpg", productName: "世界书大世界模式", role: "consumer", status: "active",
    modeMeaning: "grand_world", adapterId: "world-rpg",
    promptProfileId: "grand_world_v1",
    inputPacketType: "grand_world_input_packet_v1",
    outputPacketType: "grand_world_output_packet_v1",
    stateNamespace: "world-rpg", cacheNamespace: "worldbook",
    proposalLog: "runtime/world-proposals.jsonl",
    sharedFiles: ["shared/world_rpg.json", "shared/world_threads.json"],
    cacheFiles: ["runtime/cache/worldbook/"],
    routeWarnings: [],
    note: "world-rpg是历史内部ID，产品语义=大世界模式"
  },
  {
    modeId: "tabletop", productName: "桌面叙事", role: "consumer", status: "active",
    modeMeaning: "solo_tabletop_narrative", adapterId: "tabletop",
    promptProfileId: "tabletop_v1",
    inputPacketType: "tabletop_input_packet_v1",
    outputPacketType: "tabletop_output_packet_v1",
    stateNamespace: "tabletop", cacheNamespace: "tabletop",
    proposalLog: "runtime/tabletop-proposals.jsonl",
    sharedFiles: ["shared/tabletop.json"],
    cacheFiles: ["runtime/cache/tabletop/"],
    routeWarnings: []
  },
  {
    modeId: "mystery-puzzle", productName: "解谜调查", role: "consumer", status: "active",
    modeMeaning: "solo_mystery_puzzle", adapterId: "mystery-puzzle",
    promptProfileId: "mystery_puzzle_v1",
    inputPacketType: "mystery_puzzle_input_packet_v1",
    outputPacketType: "mystery_puzzle_output_packet_v1",
    stateNamespace: "mystery-puzzle", cacheNamespace: "mystery-puzzle",
    proposalLog: "runtime/mystery-puzzle-proposals.jsonl",
    sharedFiles: ["shared/mystery.json"],
    cacheFiles: ["runtime/cache/mystery-puzzle/"],
    routeWarnings: []
  },
  {
    modeId: "strategy-sim", productName: "策略模拟", role: "consumer", status: "active",
    modeMeaning: "solo_strategy_sim", adapterId: "strategy-sim",
    promptProfileId: "strategy_sim_v1",
    inputPacketType: "strategy_sim_input_packet_v1",
    outputPacketType: "strategy_sim_output_packet_v1",
    stateNamespace: "strategy-sim", cacheNamespace: "strategy-sim",
    proposalLog: "runtime/strategy-sim-proposals.jsonl",
    sharedFiles: ["shared/strategy.json"],
    cacheFiles: ["runtime/cache/strategy-sim/"],
    routeWarnings: []
  },
  {
    modeId: "murder-mystery", productName: "单人剧本杀", role: "consumer", status: "active",
    modeMeaning: "solo_murder_mystery", adapterId: "murder-mystery",
    promptProfileId: "murder_mystery_v1",
    inputPacketType: "murder_mystery_input_packet_v1",
    outputPacketType: "murder_mystery_output_packet_v1",
    stateNamespace: "murder-mystery", cacheNamespace: "murder-mystery",
    proposalLog: "runtime/murder-mystery-proposals.jsonl",
    sharedFiles: ["shared/murder_mystery.json"],
    cacheFiles: ["runtime/cache/murder-mystery/"],
    routeWarnings: []
  },
  {
    modeId: "creation-forge", productName: "炼金台 · 资产生产工厂", role: "producer", status: "active",
    modeMeaning: "artifact_factory", adapterId: "creation-forge",
    promptProfileId: "creation_forge_v1",
    inputPacketType: "creation_forge_input_packet_v1",
    outputPacketType: "creation_forge_output_packet_v1",
    stateNamespace: "creation-forge", cacheNamespace: "creation-forge",
    proposalLog: "runtime/creation-forge-proposals.jsonl",
    sharedFiles: [],
    cacheFiles: ["runtime/cache/creation-forge/"],
    routeWarnings: []
  }
]);

export function listWorldTreeRoutes(options = {}) {
  return WORLD_TREE_ROUTES.map(r => ({ modeId: r.modeId, productName: r.productName, role: r.role, status: r.status }));
}

export function getWorldTreeRoute(modeId, options = {}) {
  return WORLD_TREE_ROUTES.find(r => r.modeId === modeId) || null;
}

export function resolveWorldTreeRoute(project = {}, options = {}) {
  return getWorldTreeRoute(project.mode || "");
}

const VALID_ROLES = new Set(["consumer", "producer", "utility"]);
const VALID_STATUSES = new Set(["active", "internal", "deferred", "archived"]);
const REQUIRED_FIELDS = ["modeId", "adapterId", "promptProfileId", "inputPacketType", "outputPacketType", "stateNamespace", "cacheNamespace", "proposalLog"];

export function validateAllWorldTreeRoutes() {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const route of WORLD_TREE_ROUTES) {
    // modeId 唯一
    if (seen.has(route.modeId)) {
      errors.push({ code: "DUPLICATE_MODE_ID", modeId: route.modeId, message: `Duplicate modeId: ${route.modeId}` });
    }
    seen.add(route.modeId);

    // 必填字段
    for (const key of REQUIRED_FIELDS) {
      if (!route[key]) {
        errors.push({ code: "MISSING_FIELD", modeId: route.modeId, field: key, message: `Missing field: ${key}` });
      }
    }

    // role 合法性
    if (!VALID_ROLES.has(route.role)) {
      errors.push({ code: "INVALID_ROLE", modeId: route.modeId, role: route.role, message: `Invalid role: ${route.role}` });
    }

    // status 合法性
    if (!VALID_STATUSES.has(route.status)) {
      errors.push({ code: "INVALID_STATUS", modeId: route.modeId, status: route.status, message: `Invalid status: ${route.status}` });
    }

    // creation-forge 特殊规则
    if (route.modeId === "creation-forge" && route.role !== "producer") {
      errors.push({ code: "WRONG_ROLE", modeId: route.modeId, expected: "producer", actual: route.role, message: "creation-forge must be producer" });
    }

    // world-rpg 特殊规则
    if (route.modeId === "world-rpg" && route.modeMeaning !== "grand_world") {
      errors.push({ code: "WRONG_MODE_MEANING", modeId: route.modeId, expected: "grand_world", actual: route.modeMeaning, message: "world-rpg modeMeaning must be grand_world" });
    }

    // prompt profile 是否存在
    if (route.promptProfileId && !hasModePromptProfile(route.promptProfileId)) {
      errors.push({ code: "PROMPT_PROFILE_MISSING", modeId: route.modeId, promptProfileId: route.promptProfileId, message: `Prompt profile not found: ${route.promptProfileId}` });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    routesChecked: WORLD_TREE_ROUTES.length
  };
}

export function createWorldTreeRouteSummary() {
  return {
    totalRoutes: WORLD_TREE_ROUTES.length,
    consumers: WORLD_TREE_ROUTES.filter(r => r.role === "consumer").length,
    producers: WORLD_TREE_ROUTES.filter(r => r.role === "producer").length
  };
}
