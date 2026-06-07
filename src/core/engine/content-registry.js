// ===== 内容类型统一注册表 v1 =====
// 所有内容类型在此声明：id规则/文件位置/展示名称/schema/搜索字段/写入策略/LLM注入策略
// 新增"地点/物品/势力/神话/科技树/魔法体系"只需在此注册，不改引擎核心。
//
// 使用方式：
//   import { CONTENT_TYPES, findByModule, findByCategory, findById, searchableFields, injectableTypes } from "./content-registry.js";

// ═══════════════════════════════════════════════════════════════
//  变更影响等级
// ═══════════════════════════════════════════════════════════════

export const CHANGE_LEVEL = {
  LIGHT: "light",       // 自动提交，零感知
  MEDIUM: "medium",     // 自动提交 + 日志
  MAJOR: "major",       // 暂停 + 一句话提示
  CRITICAL: "critical"  // 止损窗口 + 用户确认
};

// ═══════════════════════════════════════════════════════════════
//  内容类型定义
// ═══════════════════════════════════════════════════════════════

export const CONTENT_TYPES = [
  // ── 实体类 ──
  {
    id: "character",
    category: "entity",
    name: "角色",
    priority: 1,
    filePattern: "shared/characters.json",
    fileKey: "characters",
    schema: "schemas/character.schema.json",
    searchFields: ["name", "alias", "role", "traits", "background", "status"],
    displayField: "name",
    idRule: "name 或 id 字段，小写下划线",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 10,  // 角色信息权重最高
    moduleId: "M8",
    // 变更分级规则
    changeLevelRules: {
      light: ["status更新", "mood变化", "location移动"],
      medium: ["新增角色关系", "traits增补", "background扩展"],
      major: ["身份暴露", "阵营转变", "重伤", "关键物品丢失"],
      critical: ["角色死亡", "角色永久离场", "世界规则级角色改写"]
    }
  },

  // ── 组织类 ──
  {
    id: "organization",
    category: "entity",
    name: "组织",
    priority: 2,
    filePattern: "shared/organizations.json",
    fileKey: "organizations",
    schema: "schemas/organization.schema.json",
    searchFields: ["name", "hierarchy", "relations", "keyFigures"],
    displayField: "name",
    idRule: "name 或 id 字段",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 7,
    moduleId: "M4",
    changeLevelRules: {
      light: ["层级微调", "成员名单更新"],
      medium: ["新增组织关系", "势力范围变化"],
      major: ["阵营宣战", "组织解散", "领导层更替"],
      critical: ["世界格局级势力重组"]
    }
  },

  // ── 场景类 ──
  {
    id: "scene",
    category: "context",
    name: "场景",
    priority: 3,
    filePattern: "branches/{branch}/runtime.json",
    fileKey: "scenes",
    schema: "schemas/scene.schema.json",
    searchFields: ["title", "summary", "location", "time"],
    displayField: "title",
    idRule: "scene-{timestamp} 自动生成",
    writable: true,
    writableViaProposal: false,  // 场景转换自动处理
    llmInjectable: true,
    injectionWeight: 8,
    moduleId: "M11",
    changeLevelRules: {
      light: ["场景切换", "时间推进"],
      medium: ["新地点首次出现", "场景破坏"],
      major: ["世界地图级地点变动"],
      critical: []
    }
  },

  // ── 世界书条目类 ──
  {
    id: "worldbook-entry",
    category: "knowledge",
    name: "世界书条目",
    priority: 4,
    filePattern: "shared/worldbook.json",
    fileKey: "entries",
    schema: "schemas/worldbook-entry.schema.json",
    searchFields: ["title", "content", "keywords", "category", "triggers"],
    displayField: "title",
    idRule: "title 字段，或 entry-{index}",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 6,
    moduleId: "M2",
    changeLevelRules: {
      light: ["条目内容微调", "触发词增补"],
      medium: ["新条目创建", "条目重分类"],
      major: ["核心设定条目改写"],
      critical: ["世界规则级条目删除或重写"]
    }
  },

  // ── 时间线类 ──
  {
    id: "timeline",
    category: "context",
    name: "时间线",
    priority: 5,
    filePattern: "shared/timeline.json",
    fileKey: "events",
    schema: "schemas/timeline.schema.json",
    searchFields: ["title", "description", "time", "type", "dependencies"],
    displayField: "title",
    idRule: "event-{timestamp} 或自定义id",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 5,
    moduleId: "M16",
    changeLevelRules: {
      light: ["时间推进", "新日常事件"],
      medium: ["历史事件新增", "伏笔事件注册"],
      major: ["时间线改写", "因果链断裂"],
      critical: ["世界历史级事件回退/重写"]
    }
  },

  // ── 规则类 ──
  {
    id: "rule",
    category: "knowledge",
    name: "世界规则",
    priority: 6,
    filePattern: "shared/rules.json",
    fileKey: "rules",
    schema: "schemas/rule.schema.json",
    searchFields: ["name", "description", "category", "constraints"],
    displayField: "name",
    idRule: "name 字段",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 4,
    moduleId: "M15",
    changeLevelRules: {
      light: ["规则措辞优化", "边界条件补充"],
      medium: ["新子规则添加"],
      major: ["核心规则变更"],
      critical: ["世界规则级改写（物理/魔法/社会）"]
    }
  },

  // ── 扩展类型（预注册，暂未激活）──
  {
    id: "location",
    category: "entity",
    name: "地点",
    priority: 10,
    filePattern: "shared/locations.json",
    fileKey: "locations",
    schema: "schemas/location.schema.json",
    searchFields: ["name", "description", "type", "region", "features"],
    displayField: "name",
    idRule: "name 字段",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 5,
    moduleId: null,     // 暂无对应模块，预留
    status: "reserved", // active | reserved | deprecated
    changeLevelRules: {
      light: ["地点描述更新"],
      medium: ["新地点创建"],
      major: ["地区级地点变更"],
      critical: ["世界地图级重绘"]
    }
  },
  {
    id: "item",
    category: "entity",
    name: "物品/道具",
    priority: 11,
    filePattern: "shared/items.json",
    fileKey: "items",
    schema: "schemas/item.schema.json",
    searchFields: ["name", "description", "type", "owner", "effects"],
    displayField: "name",
    idRule: "name 字段",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 3,
    moduleId: null,
    status: "reserved",
    changeLevelRules: {
      light: ["物品描述更新", "归属变更"],
      medium: ["新物品创建", "物品效果变更"],
      major: ["传说级物品出现/销毁"],
      critical: []
    }
  },
  {
    id: "faction",
    category: "entity",
    name: "势力/阵营",
    priority: 8,
    filePattern: "shared/factions.json",
    fileKey: "factions",
    schema: "schemas/faction.schema.json",
    searchFields: ["name", "description", "alignment", "territory", "relations"],
    displayField: "name",
    idRule: "name 字段",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 5,
    moduleId: null,
    status: "reserved",
    changeLevelRules: {
      light: ["势力描述更新"],
      medium: ["新势力创建"],
      major: ["势力结盟/决裂", "势力覆灭"],
      critical: ["世界格局级势力洗牌"]
    }
  },
  {
    id: "relation",
    category: "link",
    name: "角色关系",
    priority: 7,
    filePattern: "shared/relations.json",
    fileKey: "relations",
    schema: "schemas/relation.schema.json",
    searchFields: ["source", "target", "type", "attitude", "history"],
    displayField: "source→target",
    idRule: "{source}-{target}-{type}",
    writable: true,
    writableViaProposal: true,
    llmInjectable: true,
    injectionWeight: 6,
    moduleId: null,     // 新模块，见 relations.js
    status: "active",   // 本次实施激活
    changeLevelRules: {
      light: ["态度微调"],
      medium: ["新关系建立", "关系类型变更"],
      major: ["敌对/同盟转换", "血缘关系揭露"],
      critical: ["关系网全局重构"]
    }
  },
  {
    id: "memory",
    category: "context",
    name: "叙事记忆",
    priority: 12,
    filePattern: "data/engine/global-memory/snapshots.json",
    fileKey: "snapshots",
    schema: null,       // 内存结构已在 global-memory.js 定义
    searchFields: ["summary", "keywords", "emotion", "scene"],
    displayField: "summary",
    idRule: "memory-{counter} 自动生成",
    writable: true,
    writableViaProposal: false,  // 自动创建
    llmInjectable: true,
    injectionWeight: 5,
    moduleId: null,     // 新模块，见 memory-layers.js
    status: "active",
    changeLevelRules: {
      light: ["新记忆快照"],
      medium: [],
      major: [],
      critical: []
    }
  }
];

// ═══════════════════════════════════════════════════════════════
//  查询 API
// ═══════════════════════════════════════════════════════════════

/** 按 id 查询 */
export function findById(id) {
  return CONTENT_TYPES.find(t => t.id === id) || null;
}

/** 按 category 查询 */
export function findByCategory(category) {
  return CONTENT_TYPES.filter(t => t.category === category);
}

/** 按 moduleId 查询 */
export function findByModule(moduleId) {
  return CONTENT_TYPES.filter(t => t.moduleId === moduleId);
}

/** 获取所有活跃类型（排除 reserved/deprecated） */
export function activeTypes() {
  return CONTENT_TYPES.filter(t => !t.status || t.status === "active");
}

/** 获取所有可写入类型 */
export function writableTypes() {
  return CONTENT_TYPES.filter(t => t.writable);
}

/** 获取所有可 LLM 注入类型，按权重降序 */
export function injectableTypes() {
  return CONTENT_TYPES
    .filter(t => t.llmInjectable && (!t.status || t.status === "active"))
    .sort((a, b) => (b.injectionWeight || 0) - (a.injectionWeight || 0));
}

/** 获取所有搜索字段（扁平化，用于全文索引） */
export function searchableFields() {
  const map = {};
  for (const t of CONTENT_TYPES) {
    if (!t.status || t.status === "active") {
      map[t.id] = t.searchFields;
    }
  }
  return map;
}

/** 获取指定类型的 schema 路径 */
export function schemaFor(typeId) {
  const t = findById(typeId);
  return t ? t.schema : null;
}

/**
 * 判断变更等级
 * @param {string} typeId - 内容类型 id
 * @param {string} changeDescription - 变更描述（用于匹配规则）
 * @returns {string} CHANGE_LEVEL 枚举值
 */
export function classifyChangeLevel(typeId, changeDescription = "") {
  const t = findById(typeId);
  if (!t || !t.changeLevelRules) return CHANGE_LEVEL.MEDIUM;
  const desc = String(changeDescription || "").toLowerCase();
  const rules = t.changeLevelRules;
  if ((rules.critical || []).some(r => desc.includes(r.toLowerCase()))) return CHANGE_LEVEL.CRITICAL;
  if ((rules.major || []).some(r => desc.includes(r.toLowerCase()))) return CHANGE_LEVEL.MAJOR;
  if ((rules.medium || []).some(r => desc.includes(r.toLowerCase()))) return CHANGE_LEVEL.MEDIUM;
  return CHANGE_LEVEL.LIGHT;
}

/**
 * 判断是否需要用户确认（major 或 critical 级别）
 */
export function needsUserConfirmation(level) {
  return level === CHANGE_LEVEL.MAJOR || level === CHANGE_LEVEL.CRITICAL;
}

/**
 * 判断是否需要止损窗口（仅 critical 级别）
 */
export function needsStopLoss(level) {
  return level === CHANGE_LEVEL.CRITICAL;
}

// ═══════════════════════════════════════════════════════════════
//  变更影响评估（跨类型分析）
// ═══════════════════════════════════════════════════════════════

/**
 * 评估某项变更对其他内容类型的连锁影响
 * @param {string} typeId - 被变更的内容类型
 * @param {Object} change - 变更详情
 * @returns {Object[]} 受影响的其他类型列表
 */
export function assessImpact(typeId, change = {}) {
  const impacts = [];
  switch (typeId) {
    case "character":
      if (change.role === "死亡" || change.role === "离场") {
        impacts.push({ typeId: "relation", reason: "该角色的所有关系需要更新" });
        impacts.push({ typeId: "timeline", reason: "角色离场标记需要写入时间线" });
        impacts.push({ typeId: "scene", reason: "当前场景角色列表需要更新" });
      }
      break;
    case "timeline":
      if (change.type === "rewrite" || change.type === "retcon") {
        impacts.push({ typeId: "character", reason: "时间线改写可能影响角色状态" });
        impacts.push({ typeId: "world-state", reason: "世界状态需要回溯" });
        impacts.push({ typeId: "memory", reason: "相关记忆快照需要标记为过期" });
      }
      break;
    case "rule":
      if (change.scope === "core") {
        impacts.push({ typeId: "worldbook-entry", reason: "规则变更需要同步到相关世界书条目" });
        impacts.push({ typeId: "guardian", reason: "Guardian 校验规则需要更新" });
      }
      break;
    default:
      break;
  }
  return impacts;
}

// ═══════════════════════════════════════════════════════════════
//  导出类型索引（供 content-registry 自身使用）
// ═══════════════════════════════════════════════════════════════
export const TYPE_INDEX = CONTENT_TYPES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});
