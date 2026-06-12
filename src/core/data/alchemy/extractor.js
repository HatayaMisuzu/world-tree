// ===== 提取器 =====
// LLM 提取器：分类后的文本组 → Schema 填充的结构化数据
// 可独立于 World Tree 运行，仅依赖 types.js 的 Schema

import { extractorSystemPrompt, loadSchema, getRequiredFields } from "./types.js";

/**
 * 构建提取请求的 User Prompt
 * @param {string} typeId - 内容类型 ID
 * @param {Object[]} chunks - 该类型的文本块数组
 */
function buildExtractorPrompt(typeId, chunks) {
  const typeName = chunks[0]?.typeName || typeId;
  const texts = chunks.map((c, i) =>
    `[来源 ${i + 1}]${c.heading ? ` (${c.heading})` : ""}\n${c.text.slice(0, 2000)}`
  ).join("\n\n---\n\n");

  return `从以下文本中提取"${typeName}"相关信息。\n\n${texts}`;
}

/**
 * 解析 LLM 提取响应
 */
function parseExtractorResponse(response) {
  const text = String(response || "").trim();

  // 空响应检测
  if (!text || text === "{}" || text === "[]") return { _empty: true };

  // 尝试提取 JSON
  let json;
  // 去掉可能的 markdown 代码块标记
  const cleanText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    json = JSON.parse(cleanText);
  } catch {
    // 尝试提取第一个 JSON 对象
    const objMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        json = JSON.parse(objMatch[0]);
      } catch {
        return { _empty: true, _parseError: true, _raw: text.slice(0, 200) };
      }
    } else {
      return { _empty: true, _parseError: true, _raw: text.slice(0, 200) };
    }
  }

  return json || { _empty: true };
}

/**
 * LLM 提取器
 * @param {Object} opts
 * @param {Object} opts.groups - classify + groupByType 的输出 { character: [chunks], ... }
 * @param {Function} opts.llmCall - LLM 调用函数
 * @param {Object} [opts.options] - 选项 { maxConcurrent: 3 }
 * @returns {Object[]} items 数组
 */
export async function extract({ groups = {}, llmCall, options = {} } = {}) {
  if (!llmCall) throw new Error("extractor 需要 llmCall 函数");
  if (!Object.keys(groups).length) return [];

  const maxConcurrent = options.maxConcurrent || 3;
  const items = [];

  // 对每种类型分别提取
  const typeIds = Object.keys(groups);
  for (let i = 0; i < typeIds.length; i += maxConcurrent) {
    const batch = typeIds.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (typeId) => {
      const chunks = groups[typeId];
      if (!chunks.length) return [];

      const systemPrompt = extractorSystemPrompt(typeId);
      const userPrompt = buildExtractorPrompt(typeId, chunks);

      try {
        const response = await llmCall(systemPrompt, userPrompt);
        const data = parseExtractorResponse(response);

        if (data._empty) {
          // 空结果也记录，让用户知道
          return [{
            typeId,
            typeName: chunks[0]?.typeName || typeId,
            entity: chunks[0]?.heading || `未命名${typeId}`,
            confidence: 0.1,
            source: "llm_extraction",
            data: {},
            missingFields: getRequiredFields(typeId) || [],
            conflicts: [],
            _empty: true,
            _reason: data._parseError ? "LLM响应解析失败" : "文本中未提取到该类型信息"
          }];
        }

        // 检查必填字段
        const required = getRequiredFields(typeId);
        const missing = required.filter(f => !data[f] || data[f] === null);

        return [{
          typeId,
          typeName: chunks[0]?.typeName || typeId,
          entity: data.name || data.title || data.id || chunks[0]?.heading || `未命名${typeId}`,
          confidence: estimateConfidence(data, missing, required),
          source: "llm_extraction",
          data,
          missingFields: missing,
          conflicts: [],
          _sourceChunks: chunks.map(c => c.index)
        }];
      } catch (err) {
        return [{
          typeId,
          typeName: typeId,
          entity: chunks[0]?.heading || `提取失败`,
          confidence: 0,
          source: "error",
          data: {},
          missingFields: [],
          conflicts: [],
          _error: err.message
        }];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    items.push(...batchResults.flat());
  }

  return items.filter(item => !item._empty || item.missingFields.length === 0);
}

/** 基于填充率估算置信度 */
function estimateConfidence(data, missing, required) {
  if (!data || Object.keys(data).length <= 1) return 0.2;
  const totalFields = Object.keys(data).filter(k => !k.startsWith("_")).length;
  const filledFields = totalFields - missing.length;
  const fillRate = required.length ? filledFields / required.length : filledFields / Math.max(totalFields, 1);
  return Math.min(0.95, Math.max(0.2, fillRate * 0.9));
}

/**
 * 从提取结果中检测隐式关系
 * 分析同一 chunk 中的多个实体，推断关系
 * @param {Object[]} items - 已提取的 items
 * @param {Object[]} classificationResults - 分类结果
 * @returns {Object[]} 关系 items
 */
export function detectImplicitRelations(items, classificationResults) {
  const relations = [];
  const entityItems = items.filter(i =>
    ["character", "organization", "faction"].includes(i.typeId) && i.confidence >= 0.5
  );

  // 从同一 chunk 中出现的多个实体推断关系
  const chunkEntities = {}; // { chunkIndex: [entity names] }
  for (const result of classificationResults) {
    for (const entity of result.entities || []) {
      if (!chunkEntities[result.blockIndex]) chunkEntities[result.blockIndex] = [];
      chunkEntities[result.blockIndex].push(entity);
    }
  }

  // 同一 chunk 中出现 ≥2 个实体 → 可能有关联
  const seen = new Set();
  for (const [chunkIdx, entities] of Object.entries(chunkEntities)) {
    const unique = [...new Set(entities)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = [unique[i], unique[j]].sort().join("||");
        if (seen.has(key)) continue;
        seen.add(key);

        relations.push({
          typeId: "relation",
          typeName: "关系",
          entity: `${unique[i]} ↔ ${unique[j]}`,
          confidence: 0.5,
          source: "implicit_detection",
          data: {
            source: unique[i],
            target: unique[j],
            type: "complex",         // 默认复杂（无法从邻近关系中推断具体类型）
            attitude: 0,
            description: `在同一段落(${chunkIdx})中被提及，可能存在关联`,
            origin: "内容炼金台自动检测"
          },
          missingFields: ["type"],
          conflicts: []
        });
      }
    }
  }

  return relations;
}
