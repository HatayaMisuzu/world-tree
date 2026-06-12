// ===== ST 角色卡解析器 =====
// 解析 SillyTavern v2/v3 角色卡（PNG 嵌入 JSON 或独立 JSON）

import { Buffer } from "buffer";

// ═══════════════════════════════════════════════════════════════
//  PNG 解析：从 tEXt 块中提取 "chara" 关键词的 base64 JSON
// ═══════════════════════════════════════════════════════════════

/**
 * 从 PNG buffer 中提取嵌入的角色卡 JSON
 * SillyTavern 格式：tEXt 块，关键词 "chara"，值 = base64(JSON)
 */
function extractCharaFromPNG(buffer) {
  // PNG 签名
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, 8).equals(SIGNATURE)) return null;

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.slice(offset, offset + 4).toString("ascii");
    offset += 4;

    if (type === "tEXt") {
      const chunkData = buffer.slice(offset, offset + length);
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx > 0) {
        const keyword = chunkData.slice(0, nullIdx).toString("utf-8");
        const value = chunkData.slice(nullIdx + 1).toString("utf-8");
        if (keyword === "chara") {
          try {
            // base64 解码
            const json = JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
            return json;
          } catch {
            // 可能不是 base64，尝试直接解析
            try {
              return JSON.parse(value);
            } catch {
              return null;
            }
          }
        }
      }
    }

    offset += length;
    offset += 4; // CRC
  }
  return null;
}

/**
 * 检测并解析 JSON 角色卡
 * 支持：ST v2 (chara_card_v2)、ST v3 (chara_card_v3)、原生格式
 */
function parseJSONCard(json) {
  if (!json || typeof json !== "object") return null;

  const spec = json.spec || json.data?.spec || "";

  // ST v2 格式
  if (spec === "chara_card_v2" || json.spec_version === "2.0") {
    const data = json.data || {};
    return {
      format: "st_v2",
      name: data.name || "",
      description: data.description || "",
      personality: data.personality || "",
      scenario: data.scenario || "",
      firstMessage: data.first_mes || "",
      messageExamples: data.mes_example || "",
      creatorNotes: data.creator_notes || "",
      systemPrompt: data.system_prompt || "",
      postHistoryInstructions: data.post_history_instructions || "",
      alternateGreetings: data.alternate_greetings || [],
      tags: data.tags || [],
      creator: data.creator || "",
      version: data.character_version || "1.0",
      extensions: data.extensions || {},
      characterBook: data.character_book || null,  // 嵌入式世界书
      raw: json
    };
  }

  // ST v3 格式
  if (spec === "chara_card_v3" || json.spec_version === "3.0") {
    const data = json.data || {};
    return {
      format: "st_v3",
      name: data.name || "",
      description: data.description || "",
      personality: data.personality || "",
      scenario: data.scenario || "",
      firstMessage: data.first_mes || "",
      messageExamples: data.mes_example || "",
      creatorNotes: data.creator_notes || "",
      systemPrompt: data.system_prompt || "",
      postHistoryInstructions: data.post_history_instructions || "",
      alternateGreetings: data.alternate_greetings || [],
      tags: data.tags || [],
      creator: data.creator || "",
      version: data.character_version || "1.0",
      extensions: data.extensions || {},
      characterBook: data.character_book || null,
      // v3 新增字段
      groups: data.groups || [],
      assets: data.assets || {},
      raw: json
    };
  }

  // 原生格式（含 name + first_mes / 名称 + 首次对话）
  if (json.name && (json.first_mes || json.firstMessage || json.首次对话)) {
    return {
      format: "native",
      name: json.name || json.名称 || "",
      description: json.description || json.描述 || json.外表 || "",
      personality: json.personality || json.性格 || "",
      scenario: json.scenario || json.背景 || "",
      firstMessage: json.first_mes || json.firstMessage || json.首次对话 || "",
      messageExamples: json.mes_example || json.messageExamples || json.对话示例 || "",
      tags: json.tags || json.标签 || [],
      raw: json
    };
  }

  return null;
}

/**
 * 主解析入口
 * @param {Buffer|Object} input - PNG Buffer 或已解析的 JSON 对象
 * @returns {Object|null} { format, name, description, personality, ... } 或 null
 */
export function parseSTCard(input) {
  // Buffer → 尝试 PNG 提取
  if (Buffer.isBuffer(input)) {
    const embedded = extractCharaFromPNG(input);
    if (embedded) return parseJSONCard(embedded);
    // 尝试直接作为 JSON 文本解析
    try {
      const json = JSON.parse(input.toString("utf-8"));
      return parseJSONCard(json);
    } catch {
      return null;
    }
  }

  // 已经是对象
  if (typeof input === "object" && input !== null) {
    return parseJSONCard(input);
  }

  return null;
}

/**
 * 将解析后的角色卡转换为炼金台 items 格式
 * @param {Object} card - parseSTCard 的返回结果
 * @returns {Object[]} items 数组
 */
export function cardToItems(card) {
  if (!card) return [];

  const items = [];

  // 主要角色
  items.push({
    typeId: "character",
    typeName: "角色",
    entity: card.name,
    confidence: 0.95,
    source: "st_character_card",
    sourceFormat: card.format,
    data: {
      name: card.name,
      description: card.description,
      personality: {
        surface: { traits: extractTraits(card.personality) },
        inner: { desires: [], fears: [], obsessions: [], secrets: [] }
      },
      background: { origin: card.scenario },
      tags: card.tags || [],
      source: "sillytavern"
    },
    missingFields: [],
    conflicts: []
  });

  // 嵌入式世界书
  if (card.characterBook && card.characterBook.entries) {
    for (const entry of card.characterBook.entries) {
      if (!entry.keys?.length || !entry.content) continue;
      items.push({
        typeId: "worldbook-entry",
        typeName: "世界知识",
        entity: entry.keys[0],
        confidence: 0.85,
        source: "character_book",
        sourceFormat: card.format,
        data: {
          title: entry.keys[0],
          content: entry.content,
          keywords: entry.keys || [],
          category: "设定",
          mode: entry.constant ? "常驻" : "触发"
        },
        missingFields: [],
        conflicts: []
      });
    }
  }

  return items;
}

/** 从性格文本中提取特质关键词 */
function extractTraits(personalityText = "") {
  if (!personalityText) return [];
  // 简单分词 + 去常见停用词
  const words = personalityText
    .split(/[,，、。；\s]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && w.length <= 6)
    .filter(w => !/^(的|是|在|有|和|与|或|但|也|都|就|会|能|要|可以|很|非常|比较|有点)$/.test(w));
  return [...new Set(words)].slice(0, 10);
}
