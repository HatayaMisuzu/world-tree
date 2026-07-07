// ===== NovelAI Lorebook 解析器 =====
// 解析 NovelAI 世界书 JSON 格式，输出炼金台 items

/**
 * 解析 NovelAI Lorebook JSON
 * @param {Object} json - 已解析的 JSON 对象
 * @returns {Object|null} { format, entries: [...] } 或 null
 */
export function parseNAILorebook(json) {
  if (!json || typeof json !== "object") return null;

  // NovelAI 格式：顶层有 entries 数组，条目含 keys 字段
  if (json.entries && Array.isArray(json.entries)) {
    const hasKeys = json.entries.some(e => Array.isArray(e.keys));
    if (hasKeys) {
      return {
        format: "nai_lorebook",
        entries: json.entries.filter(e => e.enabled !== false),
        raw: json
      };
    }
  }

  return null;
}

export function parseSTLorebook(json) {
  if (!json || typeof json !== "object") return null;
  const rawEntries = json.entries;
  if (!rawEntries || Array.isArray(rawEntries) || typeof rawEntries !== "object") return null;
  const entries = Object.entries(rawEntries).map(([id, entry]) => ({
    id: entry.uid ?? id,
    title: entry.comment || entry.name || entry.key?.[0] || entry.keys?.[0] || `条目${id}`,
    keys: entry.key || entry.keys || [],
    secondaryKeys: entry.keysecondary || entry.secondary_keys || [],
    content: entry.content || "",
    constant: entry.constant === true,
    enabled: entry.disable !== true && entry.enabled !== false,
    priority: entry.order ?? entry.priority ?? 100,
    position: entry.position,
    raw: entry
  })).filter((entry) => entry.enabled !== false);
  if (!entries.length) return null;
  return { format: "st_lorebook", entries, raw: json };
}

/**
 * 解析 World Tree 世界书 JSON（已有格式）
 * @param {Object} json
 * @returns {Object|null}
 */
export function parseWTWorldbook(json) {
  if (!json || typeof json !== "object") return null;

  // WT 格式：entries 数组含 title + content + keywords
  if (json.entries && Array.isArray(json.entries)) {
    const hasContent = json.entries.some(e => e.title && e.content);
    if (hasContent) {
      return {
        format: "wt_worldbook",
        entries: json.entries,
        raw: json
      };
    }
  }

  // 也支持顶层 spec.entries（WT 世界书完整格式）
  if (json.spec && json.spec.entries) {
    return {
      format: "wt_worldbook_full",
      entries: json.spec.entries,
      raw: json
    };
  }

  return null;
}

/**
 * 统一世界书解析入口
 * @param {Object} json
 * @returns {Object|null}
 */
export function parseLorebook(json) {
  return parseNAILorebook(json) || parseSTLorebook(json) || parseWTWorldbook(json) || null;
}

/**
 * 将世界书条目转换为炼金台 items
 * @param {Object} lorebook - parseLorebook 的返回结果
 * @returns {Object[]} items 数组
 */
export function lorebookToItems(lorebook) {
  if (!lorebook || !lorebook.entries) return [];

  return lorebook.entries.map((entry, i) => {
    // 推断 category
    const title = entry.title || entry.keys?.[0] || `条目${i + 1}`;
    const content = entry.content || entry.text || "";
    const keys = entry.keys || entry.keywords || entry.triggers || [];

    return {
      typeId: "worldbook-entry",
      typeName: "世界知识",
      entity: title,
      confidence: 0.9,
      source: "lorebook",
      sourceFormat: lorebook.format,
      data: {
        title,
        content,
        keywords: keys,
        category: guessCategory(title, content),
        mode: entry.constant ? "常驻" : (entry.mode || "触发"),
        probability: entry.probability || null,
        layer: entry.layer || "中层"
      },
      missingFields: content ? [] : ["content"],
      conflicts: []
    };
  });
}

/** 从标题和内容推断分类 */
function guessCategory(title = "", content = "") {
  const text = (title + content).toLowerCase();
  if (/人物|角色|英雄|反派|NPC/.test(text)) return "人物";
  if (/地点|城市|王国|地区|大陆/.test(text)) return "地点";
  if (/组织|势力|公会|帝国|教会/.test(text)) return "组织";
  if (/魔法|技能|能力|法术/.test(text)) return "魔法";
  if (/科技|机械|武器|装备/.test(text)) return "科技";
  if (/历史|事件|战争|战役/.test(text)) return "历史";
  if (/规则|法则|定律|禁忌/.test(text)) return "规则";
  if (/文化|习俗|节日|礼仪/.test(text)) return "文化";
  return "设定";
}
