// ===== 炼金台 · 消化器 v1 =====
// 对外唯一接口：digest(input, { llmCall, mode, options })
// 支持两种模式：
//   "digest"   — LLM 完整消化 → 创建本地模组 → 注册 → 返回 moduleKey
//   "quickplay" — 直接解析 → 返回 items（不创建模组、不持久化）
//
// 使用示例：
//   const result = await digest(buffer, {
//     llmCall: async (system, user) => await myLLM(system, user),
//     mode: "digest",
//     options: { worldName: "我的世界", dataRoot: "data" }
//   });

import { detectFormat } from "./alchemy-engine.js";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join, basename } from "path";

const SYSTEM_PROMPT = `你是一个世界设定解析器。完整阅读以下内容，提取所有设定信息。

## 必须提取的类型
- characters: 角色（name, role, traits, background, relationships, affiliation）
- locations: 地点（name, type, description, features, region）
- organizations: 组织（name, type, description, members, goals）
- factions: 势力（name, type, description, alignment, members）
- rules: 规则（name, category, description, constraints）
- events: 事件（title, time, description, involved_entities）
- items: 物品（name, type, description, owner, effects）

## 规则
- 无法确定的信息用 null 标注，不要编造
- 从上下文中推断的信息在对应字段标注 confidence:"inferred"
- 同一角色出现在多处→合并为一条
- 严格按以下 JSON schema 输出，不要添加任何解释文字：

{
  "worldName": "世界名称（从内容推断）",
  "worldType": "epic|scifi|wuxia|urban|campus|daily",
  "description": "一句话世界描述",
  "characters": [{ "name":"", "role":"", "traits":[], "background":"", "relationships":[], "affiliation":"", "confidence":"" }],
  "locations": [{ "name":"", "type":"", "description":"", "features":[], "region":"", "confidence":"" }],
  "organizations": [{ "name":"", "type":"", "description":"", "members":[], "goals":"", "confidence":"" }],
  "factions": [{ "name":"", "type":"", "description":"", "alignment":"", "members":[], "confidence":"" }],
  "rules": [{ "name":"", "category":"", "description":"", "constraints":[], "confidence":"" }],
  "events": [{ "title":"", "time":"", "description":"", "involved_entities":[], "confidence":"" }],
  "items": [{ "name":"", "type":"", "description":"", "owner":"", "effects":"", "confidence":"" }],
  "_missing": ["缺少的类型或重要字段"],
  "_suggestions": ["建议补充的设定内容"]
}`;

const QUICKPLAY_PROMPT = `提取以下内容中的角色/地点/组织基本信息，输出 JSON。
不需要补全，只提取显式提到的内容。
{
  "characters": [{ "name":"", "role":"", "traits":[] }],
  "locations": [{ "name":"", "type":"" }],
  "organizations": [{ "name":"", "type":"" }]
}`;

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 消化输入内容
 * @param {Buffer|Object|string} input - 文件内容
 * @param {Object} ctx
 * @param {Function} ctx.llmCall - async (systemPrompt, userPrompt) => string
 * @param {string} ctx.mode - "digest" | "quickplay"
 * @param {Object} [ctx.options]
 * @param {string} [ctx.options.worldName] - 世界名称（消化模式用）
 * @param {string} [ctx.options.dataRoot] - 数据根目录
 * @returns {Object} { moduleKey?, items, stats, mode }
 */
export async function digest(input, { llmCall, mode = "digest", options = {} } = {}) {
  const { worldName, dataRoot = "data" } = options;

  // ① 格式检测 + 文本提取
  const format = detectFormat(input);
  let rawText = "";

  if (Buffer.isBuffer(input)) {
    rawText = input.toString("utf-8");
  } else if (typeof input === "string") {
    rawText = input;
  } else if (typeof input === "object") {
    rawText = JSON.stringify(input, null, 2);
  }

  // ② 结构化格式直接解析
  if (["png_character_card", "st_character_card", "native_character_card"].includes(format)) {
    const items = parseCharacterCard(input, format);
    const name = items[0]?.data?.name || "未命名角色";
    
    if (mode === "quickplay") {
      return { mode, items, stats: buildStats(items), _raw: rawText };
    }
    
    // 消化模式：角色卡→最小模组
    const moduleKey = createModule(name, items, dataRoot, rawText);
    return { mode, moduleKey, items, stats: buildStats(items) };
  }

  if (["nai_lorebook", "wt_worldbook"].includes(format)) {
    const items = parseWorldBook(input, format);
    const name = worldName || items[0]?.data?.title || "未命名世界";
    
    if (mode === "quickplay") {
      return { mode, items, stats: buildStats(items), _raw: rawText };
    }
    
    const moduleKey = createModule(name, items, dataRoot, rawText);
    return { mode, moduleKey, items, stats: buildStats(items) };
  }

  // ③ 非结构化格式→LLM 提取
  if (!llmCall) {
    return { mode, items: [], stats: buildStats([]), _raw: rawText, error: "非结构化内容需要 llmCall" };
  }

  let extractedData;
  
  if (mode === "quickplay") {
    // 轻量提取
    const response = await llmCall(QUICKPLAY_PROMPT, rawText.slice(0, 4000));
    extractedData = safeParse(response);
  } else {
    // 完整消化
    const response = await llmCall(SYSTEM_PROMPT, rawText.slice(0, 16000));
    extractedData = safeParse(response);
  }

  // ④ 转换为 items
  const items = dataToItems(extractedData, format);

  if (mode === "quickplay") {
    return { mode, items, stats: buildStats(items), _raw: rawText };
  }

  // ⑤ 消化模式：创建模组
  const name = worldName || extractedData.worldName || "未命名世界";
  const moduleKey = createModule(name, items, dataRoot, rawText);

  return {
    mode,
    moduleKey,
    items,
    stats: buildStats(items),
    worldType: extractedData.worldType || "daily",
    description: extractedData.description || "",
    missing: extractedData._missing || [],
    suggestions: extractedData._suggestions || []
  };
}

// ═══════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════

function safeParse(response) {
  try {
    const clean = String(response || "").replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    const match = String(response || "").match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return {};
  }
}

function parseCharacterCard(input, format) {
  let data;
  if (Buffer.isBuffer(input)) {
    const latin = input.toString("latin1");
    const match = latin.match(/chara\0([A-Za-z0-9+/=]+)/) || latin.match(/ccv3\0([A-Za-z0-9+/=]+)/);
    if (match) data = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  } else {
    data = typeof input === "string" ? JSON.parse(input) : input;
  }

  const charData = data?.data || data;
  return [{
    typeId: "character",
    typeName: "角色",
    entity: charData.name || "未命名",
    confidence: 1.0,
    source: "card_import",
    data: {
      name: charData.name,
      role: charData.role || "主角",
      traits: charData.personality ? [charData.personality] : [],
      background: charData.description || charData.first_mes || "",
      relationships: [],
      affiliation: ""
    }
  }];
}

function parseWorldBook(input, format) {
  const json = typeof input === "string" ? JSON.parse(input) : input;
  const entries = json.entries || [];
  const items = [];

  for (const entry of entries) {
    const keys = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
    const content = entry.content || entry.text || "";
    const typeId = inferType(keys.join(" ") + " " + content.slice(0, 200));

    items.push({
      typeId,
      typeName: typeId,
      entity: entry.title || entry.name || entry.comment || "未命名条目",
      confidence: 0.9,
      source: "worldbook_import",
      data: {
        title: entry.title || "",
        content,
        keywords: keys,
        type: typeId
      }
    });
  }

  return items;
}

function inferType(text) {
  const t = text.toLowerCase();
  if (/角色|人物|主角|npc/i.test(t)) return "character";
  if (/地点|城市|村庄|森林/i.test(t)) return "location";
  if (/组织|势力|公会|帝国/i.test(t)) return "organization";
  if (/规则|法则|律法|禁忌/i.test(t)) return "rule";
  return "worldbook-entry";
}

function dataToItems(data, format) {
  const items = [];
  const types = ["characters", "locations", "organizations", "factions", "rules", "events", "items"];
  const typeMap = {
    characters: "character",
    locations: "location",
    organizations: "organization",
    factions: "faction",
    rules: "rule",
    events: "timeline",
    items: "item"
  };

  for (const key of types) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    const typeId = typeMap[key] || "unknown";

    for (const item of list) {
      items.push({
        typeId,
        typeName: typeId,
        entity: item.name || item.title || "未命名",
        confidence: item.confidence === "inferred" ? 0.5 : 0.85,
        source: "llm_digest",
        data: { ...item }
      });
    }
  }

  return items;
}

function buildStats(items = []) {
  const byType = {};
  for (const item of items) {
    byType[item.typeId] = (byType[item.typeId] || 0) + 1;
  }
  return {
    total: items.length,
    highConfidence: items.filter(i => i.confidence >= 0.7).length,
    mediumConfidence: items.filter(i => i.confidence >= 0.4 && i.confidence < 0.7).length,
    lowConfidence: items.filter(i => i.confidence < 0.4).length,
    byType
  };
}

// ═══════════════════════════════════════════════════════════════
//  模组创建
// ═══════════════════════════════════════════════════════════════

function createModule(worldName, items, dataRoot, rawText = "") {
  const safeName = sanitizeName(worldName);
  const modulePath = join(dataRoot, "modules", safeName);
  const sharedPath = join(modulePath, "shared");

  // 创建目录
  mkdirSync(sharedPath, { recursive: true });
  mkdirSync(join(modulePath, "branches", "main"), { recursive: true });

  // 写入世界书
  const worldbookEntries = items
    .filter(i => ["worldbook-entry", "rule", "item", "location"].includes(i.typeId))
    .map(i => ({
      title: i.entity,
      content: i.data?.content || i.data?.description || JSON.stringify(i.data, null, 2).slice(0, 500),
      keys: [i.entity],
      mode: i.typeId === "rule" ? "persistent" : "standard"
    }));

  writeFileSync(
    join(sharedPath, "worldbook.json"),
    JSON.stringify({ entries: worldbookEntries, _source: "llm_digest", _digestedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );

  // 写入角色
  const characters = items
    .filter(i => i.typeId === "character")
    .map(i => ({
      id: sanitizeName(i.entity),
      name: i.entity,
      role: i.data?.role || "",
      traits: i.data?.traits || [],
      background: i.data?.background || "",
      affiliation: i.data?.affiliation || "",
      location: "",
      tags: []
    }));

  writeFileSync(
    join(modulePath, "characters_state.json"),
    JSON.stringify({ characters }, null, 2),
    "utf8"
  );

  // 写入组织
  const orgs = items
    .filter(i => ["organization", "faction"].includes(i.typeId))
    .map(i => ({
      id: sanitizeName(i.entity),
      name: i.entity,
      type: i.data?.type || "未知",
      description: i.data?.description || "",
      members: i.data?.members || [],
      tags: []
    }));

  writeFileSync(
    join(modulePath, "organizations_state.json"),
    JSON.stringify({ organizations: orgs }, null, 2),
    "utf8"
  );

  // 写入规则
  const rules = items
    .filter(i => i.typeId === "rule")
    .map(i => ({
      id: sanitizeName(i.entity),
      name: i.entity,
      category: i.data?.category || "world",
      description: i.data?.description || "",
      constraints: i.data?.constraints || []
    }));

  writeFileSync(
    join(sharedPath, "rules.json"),
    JSON.stringify(rules, null, 2),
    "utf8"
  );

  // 写入初始运行时状态
  writeFileSync(
    join(modulePath, "runtime.json"),
    JSON.stringify({ turnCount: 0, dayNumber: 1, dayPhase: "早晨", currentScene: "起始之地" }, null, 2),
    "utf8"
  );

  // 写入初始正史
  writeFileSync(
    join(modulePath, "canon_state.json"),
    JSON.stringify({ events: [], lastUpdated: new Date().toISOString() }, null, 2),
    "utf8"
  );

  // 注册到 index.json
  registerModule(dataRoot, safeName, worldName);
  
  // 保存原始文本引用
  if (rawText) {
    writeFileSync(
      join(modulePath, "original-source.txt"),
      rawText.slice(0, 10000),
      "utf8"
    );
  }

  return `${safeName}#main`;
}

function sanitizeName(name) {
  return String(name || "未命名")
    .replace(/[^\w\u4e00-\u9fff-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "unnamed";
}

function registerModule(dataRoot, safeName, worldName) {
  const indexPath = join(dataRoot, "index.json");
  let index = { modules: [] };

  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, "utf8"));
    } catch {}
  }

  // 去重
  index.modules = (index.modules || []).filter(m => m.id !== safeName && m.path !== safeName);

  index.modules.push({
    id: safeName,
    name: safeName,
    title: worldName,
    path: safeName,
    branch: "main",
    source: "llm_digest",
    createdAt: new Date().toISOString()
  });

  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
}

export { createModule, registerModule };
