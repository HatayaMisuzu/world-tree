// ===== 内容炼金台 · 类型定义 =====
// 自包含的类型系统，不依赖 World Tree 引擎。
// 从 content-registry 精简而来，仅保留炼金台需要的部分。

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
//  内容类型定义（精简版）
// ═══════════════════════════════════════════════════════════════

export const CONTENT_TYPES = [
  {
    id: "character",
    name: "角色",
    icon: "👤",
    priority: 1,
    schema: "../../schemas/character.schema.json",
    keywords: ["角色", "人物", "主角", "配角", "NPC", "反派", "战士", "法师", "骑士", "盗贼",
               "少女", "少年", "老者", "女王", "国王", "王子", "公主", "将军", "猎人", "商人"],
    requiredFields: ["name"],
    category: "entity"
  },
  {
    id: "organization",
    name: "组织",
    icon: "🏛️",
    priority: 2,
    schema: "../../schemas/organization.schema.json",
    keywords: ["组织", "势力", "公会", "帝国", "王国", "共和国", "联盟", "教会", "学派",
               "家族", "商会", "军队", "骑士团", "议会", "政府", "部落"],
    requiredFields: ["name"],
    category: "entity"
  },
  {
    id: "location",
    name: "地点",
    icon: "📍",
    priority: 5,
    schema: "../../schemas/location.schema.json",
    keywords: ["地点", "城市", "村庄", "城堡", "森林", "山脉", "河流", "海洋", "沙漠",
               "平原", "地牢", "塔", "酒馆", "广场", "宫殿", "港口", "遗迹"],
    requiredFields: ["name"],
    category: "entity"
  },
  {
    id: "item",
    name: "物品",
    icon: "🗡️",
    priority: 8,
    schema: "../../schemas/item.schema.json",
    keywords: ["物品", "武器", "防具", "道具", "神器", "魔法物品", "药水", "卷轴",
               "戒指", "剑", "盾", "弓", "法杖", "护符"],
    requiredFields: ["name"],
    category: "entity"
  },
  {
    id: "faction",
    name: "势力",
    icon: "⚔️",
    priority: 4,
    schema: "../../schemas/faction.schema.json",
    keywords: ["势力", "阵营", "派系", "帮派", "血族", "暗影", "光明", "秩序", "混沌"],
    requiredFields: ["name"],
    category: "entity"
  },
  {
    id: "relation",
    name: "关系",
    icon: "🔗",
    priority: 3,
    schema: null,  // 关系在提取阶段动态生成
    keywords: [],
    requiredFields: ["source", "target", "type"],
    category: "link"
  },
  {
    id: "timeline",
    name: "事件",
    icon: "📜",
    priority: 6,
    schema: "../../schemas/timeline.schema.json",
    keywords: ["事件", "历史", "战争", "战役", "革命", "灾难", "发现", "建国", "灭亡",
               "登基", "加冕", "叛变", "入侵", "和平条约", "大饥荒"],
    requiredFields: ["title", "time"],
    category: "context"
  },
  {
    id: "rule",
    name: "规则",
    icon: "📖",
    priority: 7,
    schema: "../../schemas/rule.schema.json",
    keywords: ["规则", "魔法", "魔法体系", "力量体系", "修炼", "等级", "禁咒",
               "法则", "能力", "天赋", "技能", "职业"],
    requiredFields: ["name", "description"],
    category: "knowledge"
  },
  {
    id: "worldbook-entry",
    name: "世界知识",
    icon: "📚",
    priority: 9,
    schema: "../../schemas/worldbook-entry.schema.json",
    keywords: ["世界", "设定", "历史", "传说", "神话", "文化", "习俗", "节日",
               "语言", "货币", "历法", "地貌", "气候"],
    requiredFields: ["title", "content"],
    category: "knowledge"
  }
];

// ═══════════════════════════════════════════════════════════════
//  Schema 加载
// ═══════════════════════════════════════════════════════════════

const SCHEMA_CACHE = new Map();

/** 加载指定类型的 JSON Schema */
export function loadSchema(typeId) {
  if (SCHEMA_CACHE.has(typeId)) return SCHEMA_CACHE.get(typeId);

  const type = findType(typeId);
  if (!type || !type.schema) return null;

  const schemaPath = join(__dirname, type.schema);
  if (!existsSync(schemaPath)) return null;

  try {
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    SCHEMA_CACHE.set(typeId, schema);
    return schema;
  } catch {
    return null;
  }
}

/** 获取类型的 required 字段列表 */
export function getRequiredFields(typeId) {
  const schema = loadSchema(typeId);
  return schema?.required || [];
}

/** 获取类型的全部属性定义 */
export function getProperties(typeId) {
  const schema = loadSchema(typeId);
  return schema?.properties || {};
}

// ═══════════════════════════════════════════════════════════════
//  查询
// ═══════════════════════════════════════════════════════════════

export function findType(id) {
  return CONTENT_TYPES.find(t => t.id === id) || null;
}

export function getEntityTypes() {
  return CONTENT_TYPES.filter(t => t.category === "entity");
}

export function getLinkTypes() {
  return CONTENT_TYPES.filter(t => t.category === "link");
}

/** 获取所有类型 ID 列表（供 LLM 分类使用） */
export function typeIdsForPrompt() {
  return CONTENT_TYPES.map(t => `${t.id}(${t.name})`).join(", ");
}

/** 获取分类提示词（供 LLM 使用） */
export function classificationGuide() {
  return CONTENT_TYPES
    .filter(t => t.keywords.length > 0)
    .map(t => `  ${t.id}(${t.name}): ${t.keywords.slice(0, 8).join("、")}`)
    .join("\n");
}

/** 从关键词推断可能的类型 */
export function guessTypeFromKeywords(text = "") {
  const scores = {};
  const lower = text.toLowerCase();
  for (const type of CONTENT_TYPES) {
    let score = 0;
    for (const kw of type.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores[type.id] = score;
  }
  // 按分数排序
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
}

// ═══════════════════════════════════════════════════════════════
//  提取器 Prompt 模板
// ═══════════════════════════════════════════════════════════════

/** 生成提取器 System Prompt */
export function extractorSystemPrompt(typeId) {
  const type = findType(typeId);
  const schema = loadSchema(typeId);
  if (!type) return "";

  let prompt = `你是一个设定数据提取器。从文本中提取"${type.name}"相关信息。\n\n`;
  prompt += `请输出 JSON，只包含以下字段（从文本中确实能找到的才填，找不到的填 null）：\n\n`;

  if (schema?.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key.startsWith("$") || key === "additionalProperties") continue;
      const required = schema.required?.includes(key) ? "【必填】" : "";
      const desc = prop.description || "";
      const typeStr = prop.type || "string";
      prompt += `  ${key}: ${typeStr} ${required}${desc ? `— ${desc}` : ''}\n`;
    }
  }

  prompt += `\n规则：\n`;
  prompt += `1. 只输出从文本中确实能找到的信息，不要编造\n`;
  prompt += `2. 数组字段用 [] 包裹，对象字段用 {} 包裹\n`;
  prompt += `3. 输出纯 JSON，不要加 markdown 代码块标记\n`;
  prompt += `4. 如果整段文本没有该类型的任何信息，输出 {"_empty": true}\n`;
  prompt += `5. 所有结果都是 candidate，不是 canon\n`;
  prompt += `6. 不要声称已经保存、写入世界书、创建项目\n`;
  prompt += `7. 不要输出 hidden/private/system/gm/dm 字段\n`;

  return prompt;
}

/** 生成分类器 System Prompt */
export function classifierSystemPrompt() {
  let prompt = `你是一个文档内容分类器。分析文本段落，判断其中包含什么类型的世界设定内容。\n\n`;
  prompt += `可用的内容类型：\n`;
  prompt += classificationGuide();
  prompt += `\n\n对每个段落输出 JSON 数组：\n`;
  prompt += `[{"blockIndex": 0, "typeIds": ["character"], "confidence": 0.9, "entities": ["实体名"], "reason": "分类理由"}]\n`;
  prompt += `\n规则：\n`;
  prompt += `1. 一个段落可以包含多种类型\n`;
  prompt += `2. confidence 0-1，低于 0.5 的不输出\n`;
  prompt += `3. entities 是从段落中提取到的具体实体名称\n`;
  prompt += `4. 输出纯 JSON 数组\n`;
  prompt += `5. 所有结果都是 candidate，不是 canon\n`;
  prompt += `6. 不要声称已经保存、写入世界书、创建项目\n`;
  prompt += `7. 不要输出 hidden/private/system/gm/dm 字段\n`;
  return prompt;
}
