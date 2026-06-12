// ===== 内容炼金台 · 主引擎 =====
// 五阶段管线：解析 → 分块 → 分类 → 提取 → 去重输出
// 独立模块，不依赖 World Tree 引擎。
//
// 对外唯一接口：importFile(fileBuffer, { llmCall, options })
//
// 使用示例：
//   import { importFile } from './alchemy/alchemy-engine.js';
//   const result = await importFile(buffer, {
//     llmCall: async (system, user) => await myLLM(system, user),
//     options: { autoRelations: true, existingEntities: [] }
//   });

import { parseSTCard, cardToItems } from "./parsers/st-card.js";
import { parseLorebook, lorebookToItems } from "./parsers/nai-lorebook.js";
import { parseMarkdown, markdownToItems } from "./parsers/markdown.js";
import { classify, groupByType } from "./classifier.js";
import { extract, detectImplicitRelations } from "./extractor.js";
import { deduplicate, sortByPriority, dedupStats } from "./deduplicator.js";
import { findType } from "./types.js";
import { Buffer } from "buffer";

// ═══════════════════════════════════════════════════════════════
//  格式检测
// ═══════════════════════════════════════════════════════════════

/**
 * 检测输入格式
 * @param {Buffer|Object|string} input
 * @returns {string} 格式标识
 */
export function detectFormat(input) {
  // PNG buffer
  if (Buffer.isBuffer(input)) {
    const sig = input.slice(0, 8);
    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (sig.equals(PNG_SIG)) return "png_character_card";

    // 尝试作为文本
    try {
      const text = input.toString("utf-8").trim();
      if (text.startsWith("{") || text.startsWith("[")) return detectJSONFormat(JSON.parse(text));
      if (text.startsWith("---")) return "markdown";
      return "plain_text";
    } catch {
      return "unknown_binary";
    }
  }

  // JSON 对象
  if (typeof input === "object" && input !== null) {
    return detectJSONFormat(input);
  }

  // 字符串
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return detectJSONFormat(JSON.parse(trimmed)); } catch {}
    }
    if (trimmed.startsWith("---")) return "markdown";
    return "plain_text";
  }

  return "unknown";
}

function detectJSONFormat(json) {
  if (!json || typeof json !== "object") return "unknown";
  if (json.spec === "chara_card_v2" || json.spec === "chara_card_v3") return "st_character_card";
  if (json.data?.spec === "chara_card_v2" || json.data?.spec === "chara_card_v3") return "st_character_card";
  if (json.name && (json.first_mes || json.firstMessage)) return "native_character_card";
  if (json.entries && Array.isArray(json.entries)) {
    if (json.entries.some(e => Array.isArray(e.keys))) return "nai_lorebook";
    if (json.entries.some(e => e.title && e.content)) return "wt_worldbook";
  }
  return "unknown_json";
}

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 导入文件，运行完整炼金管线
 * @param {Buffer|Object|string} input - 文件内容
 * @param {Object} ctx
 * @param {Function} ctx.llmCall - async (systemPrompt, userPrompt) => string
 * @param {Object} [ctx.options]
 * @param {boolean} [ctx.options.autoRelations=true] - 是否自动检测隐式关系
 * @param {Object[]} [ctx.options.existingEntities=[]] - 已有实体（用于去重）
 * @param {Function} [ctx.options.onProgress] - 进度回调 (phase, detail) => void
 * @returns {Object} { format, items, stats, phases }
 */
export async function importFile(input, { llmCall, options = {} } = {}) {
  const {
    autoRelations = true,
    existingEntities = [],
    onProgress = null
  } = options;

  const report = (phase, detail) => {
    if (onProgress) onProgress(phase, detail);
  };

  // ═══════════════════════════════════════════════════════════
  //  阶段 1: 格式检测 + 解析（纯 JS）
  // ═══════════════════════════════════════════════════════════
  report("detect", "检测文件格式...");
  const format = detectFormat(input);
  report("detect", `识别格式: ${format}`);

  // 结构化格式：直接解析，跳过 LLM 阶段
  if (format === "png_character_card" || format === "st_character_card" || format === "native_character_card") {
    report("parse", "解析角色卡...");
    let card;
    if (format === "png_character_card") {
      card = parseSTCard(input);
    } else {
      card = parseSTCard(typeof input === "string" ? JSON.parse(input) : input);
    }
    if (!card) return { error: "角色卡解析失败", format };

    const items = cardToItems(card);
    return {
      format: card.format,
      items: sortByPriority(items),
      stats: buildStats(items),
      phases: [{ phase: "parse", method: "js", tokenCost: 0, itemCount: items.length }]
    };
  }

  if (format === "nai_lorebook" || format === "wt_worldbook") {
    report("parse", "解析世界书...");
    const json = typeof input === "string" ? JSON.parse(input) : input;
    const lorebook = parseLorebook(json);
    if (!lorebook) return { error: "世界书解析失败", format };

    const items = lorebookToItems(lorebook);
    return {
      format: lorebook.format,
      items: sortByPriority(items),
      stats: buildStats(items),
      phases: [{ phase: "parse", method: "js", tokenCost: 0, itemCount: items.length }]
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  阶段 2: 文本分块（纯 JS）
  // ═══════════════════════════════════════════════════════════
  report("chunk", "文本分块...");
  let text;
  if (Buffer.isBuffer(input)) {
    text = input.toString("utf-8");
  } else if (typeof input === "string") {
    text = input;
  } else {
    text = JSON.stringify(input);
  }

  let chunks, frontmatterItems = [];
  if (format === "markdown") {
    const md = parseMarkdown(text);
    if (!md) return { error: "Markdown 解析失败", format };
    chunks = md.chunks;
    frontmatterItems = markdownToItems(md);
  } else {
    // 纯文本：按空行分块
    chunks = chunkByBlankLines(text);
  }

  report("chunk", `分块完成: ${chunks.length} 块`);

  if (!chunks.length) {
    return { format, items: [], stats: { total: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, byType: {} }, phases: [], _chunks: [] };
  }

  // ═══════════════════════════════════════════════════════════
  //  阶段 3: LLM 分类
  // ═══════════════════════════════════════════════════════════
  if (!llmCall) {
    // 无 LLM：返回分块结果 + 前端标记（从 wikilink 提取的）
    return {
      format,
      items: sortByPriority(frontmatterItems),
      stats: buildStats(frontmatterItems),
      phases: [
        { phase: "chunk", method: "js", tokenCost: 0, chunkCount: chunks.length },
        { phase: "classify", method: "skipped", tokenCost: 0, reason: "未提供 llmCall" }
      ],
      _chunks: chunks.slice(0, 20)  // 前端可用作展示
    };
  }

  report("classify", "LLM 分类中...");
  const classificationResults = await classify({ chunks, llmCall });
  report("classify", `分类完成: ${classificationResults.length} 条`);

  // ═══════════════════════════════════════════════════════════
  //  阶段 4: LLM 提取
  // ═══════════════════════════════════════════════════════════
  const groups = groupByType(classificationResults, chunks);

  if (Object.keys(groups).length === 0) {
    return {
      format,
      items: sortByPriority(frontmatterItems),
      stats: buildStats(frontmatterItems),
      phases: [
        { phase: "chunk", method: "js", tokenCost: 0, chunkCount: chunks.length },
        { phase: "classify", method: "llm", tokenCost: "medium", resultCount: classificationResults.length },
        { phase: "extract", method: "skipped", tokenCost: 0, reason: "无分类结果" }
      ]
    };
  }

  report("extract", `LLM 提取中: ${Object.keys(groups).join(", ")}`);
  const extractedItems = await extract({ groups, llmCall, options: { maxConcurrent: 2 } });
  report("extract", `提取完成: ${extractedItems.length} 项`);

  // 隐式关系检测
  let relationItems = [];
  if (autoRelations) {
    report("relations", "检测隐式关系...");
    relationItems = detectImplicitRelations(extractedItems, classificationResults);
    report("relations", `检测到 ${relationItems.length} 条关系`);
  }

  // ═══════════════════════════════════════════════════════════
  //  阶段 5: 去重 + 合并
  // ═══════════════════════════════════════════════════════════
  report("dedup", "去重 + 冲突检测...");
  const allItems = [...frontmatterItems, ...extractedItems, ...relationItems];
  const deduped = deduplicate(allItems, existingEntities);
  const sorted = sortByPriority(deduped);

  report("done", `完成: ${sorted.length} 项`);

  return {
    format,
    items: sorted,
    stats: buildStats(sorted),
    dedup: dedupStats(sorted),
    phases: [
      { phase: "chunk", method: "js", tokenCost: 0, chunkCount: chunks.length },
      { phase: "classify", method: "llm+js", tokenCost: "medium", resultCount: classificationResults.length },
      { phase: "extract", method: "llm", tokenCost: "high", itemCount: extractedItems.length },
      { phase: "relations", method: "js", tokenCost: 0, relationCount: relationItems.length },
      { phase: "dedup", method: "js", tokenCost: 0, finalCount: sorted.length }
    ]
  };
}

// ═══════════════════════════════════════════════════════════════
//  纯文本分块
// ═══════════════════════════════════════════════════════════════

function chunkByBlankLines(text, maxChunkSize = 2000) {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length >= 10);
  const chunks = [];
  let index = 0;

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      chunks.push({ index: index++, heading: "", text: para.trim(), length: para.length, wikilinks: [] });
    } else {
      // 大段落：按句号分割
      const sentences = para.split(/(?<=[。！？\.\!\?])/);
      let current = "";
      for (const s of sentences) {
        if (current.length + s.length > maxChunkSize && current.length >= 100) {
          chunks.push({ index: index++, heading: "", text: current.trim(), length: current.length, wikilinks: [] });
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim().length >= 50) {
        chunks.push({ index: index++, heading: "", text: current.trim(), length: current.length, wikilinks: [] });
      }
    }
  }

  return chunks;
}

// ═══════════════════════════════════════════════════════════════
//  统计
// ═══════════════════════════════════════════════════════════════

function buildStats(items = []) {
  const byType = {};
  let high = 0, medium = 0, low = 0;

  for (const item of items) {
    byType[item.typeId] = (byType[item.typeId] || 0) + 1;
    if (item.confidence >= 0.7) high++;
    else if (item.confidence >= 0.4) medium++;
    else low++;
  }

  return {
    total: items.length,
    highConfidence: high,
    mediumConfidence: medium,
    lowConfidence: low,
    byType,
    uniqueEntities: [...new Set(items.map(i => i.entity).filter(Boolean))].length
  };
}

// ═══════════════════════════════════════════════════════════════
//  便捷导出
// ═══════════════════════════════════════════════════════════════

export { parseSTCard, cardToItems } from "./parsers/st-card.js";
export { parseLorebook, lorebookToItems } from "./parsers/nai-lorebook.js";
export { parseMarkdown } from "./parsers/markdown.js";
export { classify } from "./classifier.js";
export { extract } from "./extractor.js";
export { deduplicate, sortByPriority } from "./deduplicator.js";
