// ===== 分类器 =====
// LLM 分类器：文本块 → 内容类型
// 可独立于 World Tree 运行，仅依赖 types.js 的类型定义

import { classifierSystemPrompt, CONTENT_TYPES, guessTypeFromKeywords } from "./types.js";

/**
 * 构建分类请求的 User Prompt
 * @param {Object[]} chunks - 文本块数组 [{ index, heading, text }]
 * @returns {string}
 */
function buildClassifierPrompt(chunks) {
  const blocks = chunks.map(c => {
    const headingInfo = c.heading ? ` [标题: ${c.heading}]` : "";
    return `--- 段落 ${c.index}${headingInfo} ---\n${c.text.slice(0, 1500)}`;
  }).join("\n\n");

  return `分析以下文档段落，判断每个段落包含什么类型的世界设定内容。\n\n${blocks}`;
}

/**
 * LLM 分类器
 * @param {Object} opts
 * @param {Object[]} opts.chunks - 文本块数组
 * @param {Function} opts.llmCall - LLM 调用函数 async (systemPrompt, userPrompt) => string
 * @returns {Object[]} 分类结果 [{ blockIndex, typeIds, confidence, entities, reason }]
 */
export async function classify({ chunks = [], llmCall } = {}) {
  if (!chunks.length) return [];
  if (!llmCall) throw new Error("classifier 需要 llmCall 函数");

  // 先做一轮 JS 预筛：按关键词快速判断
  const preScreened = chunks.map(c => ({
    ...c,
    _jsGuess: guessTypeFromKeywords(c.text),
    _jsConfidence: Math.min(0.6, guessTypeFromKeywords(c.text).length * 0.2)
  }));

  // 对于 JS 预筛置信度 ≥ 0.5 的块，直接使用；其余交给 LLM
  const needLLM = preScreened.filter(c => c._jsConfidence < 0.5);
  const jsResults = preScreened
    .filter(c => c._jsConfidence >= 0.5)
    .map(c => ({
      blockIndex: c.index,
      typeIds: c._jsGuess.slice(0, 3),
      confidence: c._jsConfidence,
      entities: [],
      reason: "关键词匹配",
      _source: "js"
    }));

  if (!needLLM.length) return jsResults;

  // 调用 LLM 分类
  const systemPrompt = classifierSystemPrompt();
  const userPrompt = buildClassifierPrompt(needLLM);
  let llmResults;

  try {
    const response = await llmCall(systemPrompt, userPrompt);
    llmResults = parseClassifierResponse(response, needLLM);
  } catch (err) {
    // LLM 失败时回退到 JS 分类
    llmResults = needLLM.map(c => ({
      blockIndex: c.index,
      typeIds: c._jsGuess.length ? c._jsGuess.slice(0, 2) : ["worldbook-entry"],
      confidence: 0.3,
      entities: [],
      reason: `LLM分类失败(${err.message})，回退关键词匹配`,
      _source: "fallback"
    }));
  }

  return [...jsResults, ...llmResults];
}

/**
 * 解析 LLM 分类响应
 */
function parseClassifierResponse(response, chunks) {
  const text = String(response || "");

  // 尝试提取 JSON 数组（平衡括号匹配，避免嵌套/多数组错误）
  let json;
  const jsonStr = extractBalancedJSONArray(text);
  if (jsonStr) {
    try {
      json = JSON.parse(jsonStr);
    } catch {
      // 尝试修复常见 JSON 错误
      try {
        const cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')  // 移除尾部逗号
          .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // 加引号
        json = JSON.parse(cleaned);
      } catch {
        json = null;
      }
    }
  }

  if (json && Array.isArray(json)) {
    return json.map(item => ({
      blockIndex: item.blockIndex ?? item.block_index ?? 0,
      typeIds: (item.typeIds || item.type_ids || item.types || ["worldbook-entry"]).filter(
        id => CONTENT_TYPES.some(t => t.id === id)
      ),
      confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
      entities: item.entities || [],
      reason: item.reason || "",
      _source: "llm"
    }));
  }

  // 解析失败，对每个块回退
  return chunks.map(c => ({
    blockIndex: c.index,
    typeIds: ["worldbook-entry"],
    confidence: 0.2,
    entities: [],
    reason: "LLM响应无法解析",
    _source: "fallback"
  }));
}

/**
 * 将分类结果按类型合并
 * @param {Object[]} classificationResults
 * @param {Object[]} chunks
 * @returns {Object} { character: [chunks], location: [chunks], ... }
 */
export function groupByType(classificationResults, chunks) {
  const groups = {};

  for (const result of classificationResults) {
    const chunk = chunks.find(c => c.index === result.blockIndex);
    if (!chunk) continue;

    for (const typeId of result.typeIds) {
      if (!groups[typeId]) groups[typeId] = [];
      groups[typeId].push({
        ...chunk,
        confidence: result.confidence,
        entities: result.entities,
        reason: result.reason,
        _source: result._source
      });
    }
  }

  return groups;
}

/** 平衡括号匹配提取 JSON 数组（避免嵌套/多数组时的贪婪匹配错误） */
function extractBalancedJSONArray(text) {
  // 找到第一个 '['
  const start = text.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === "\"") { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
