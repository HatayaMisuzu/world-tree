// ===== 上下文路由器 v1 =====
// 场景帧 → 定向查表。零噪音，确定性输出。
// 不搜索、不模糊匹配——直接用场景中的实体名去各模块中查关联数据。
//
// 输入: sceneFrame { location, characters[], conflict, clues[], time, emotions{} }
// 输出: RouterResult { worldbook[], relations[], memories[], characters[], timeline[], worldState }

import { worldStateSummary, worldStateCompact } from "../data/world-state.js";
import { relationContextFor } from "../data/relations.js";
import { characterMemoryContext } from "./memory-layers.js";

// ═══════════════════════════════════════════════════════════════
//  场景帧定义
// ═══════════════════════════════════════════════════════════════

/**
 * 从 model 构建场景帧
 * @param {Object} model — World Tree model 对象
 * @returns {Object} sceneFrame
 */
export function buildSceneFrame(model) {
  const data = model.moduleData || {};
  const scene = data.scenes?.[0] || {};
  const runtime = data.runtime || {};

  return {
    location: scene.location || scene.title || "",
    time: runtime.currentTime || scene.time || "",
    dayPhase: runtime.dayPhase || "",
    characters: (data.characters || []).map(c => c.name).filter(Boolean),
    conflict: scene.conflict || data.conflict || null,
    clues: data.clues || data.tracking?.filter(t => t.type === "clue") || [],
    emotions: data.characterEmotions || {},
    unresolvedEvents: data.unresolvedEvents || [],
    activeWorldState: data.worldState || {},
    branch: model.selected?.branch || "main",
    round: runtime.turnCount || 0
  };
}

// ═══════════════════════════════════════════════════════════════
//  路由查询
// ═══════════════════════════════════════════════════════════════

/**
 * 按名称匹配世界书条目（精确+模糊）
 */
function routeWorldbook(frame, worldbookEntries = []) {
  if (!worldbookEntries.length) return [];

  const hits = [];
  const searchTerms = new Set([
    frame.location,
    ...frame.characters,
    frame.conflict?.type || "",
    ...(frame.clues || []).map(c => c.description || "").filter(Boolean)
  ].filter(Boolean));

  for (const entry of worldbookEntries) {
    const keys = entry.keywords || entry.triggers || [];
    const title = entry.title || "";
    const content = entry.content || "";
    const combined = [title, content, ...keys].join(" ").toLowerCase();

    let matchScore = 0;
    let matchReason = "";

    for (const term of searchTerms) {
      const t = term.toLowerCase();
      if (!t) continue;
      // 将搜索词拆成子词（中文：每2-3字一组）
      const subTerms = tokenizeChinese(t);

      // 精确关键词匹配
      if (keys.some(k => k.toLowerCase() === t)) {
        matchScore += 3;
        matchReason = `关键词精确匹配: ${term}`;
      }
      // 标题包含
      else if (title.toLowerCase().includes(t)) {
        matchScore += 2;
        matchReason = matchReason || `标题匹配: ${term}`;
      }
      // 内容包含
      else if (content.toLowerCase().includes(t)) {
        matchScore += 1;
        matchReason = matchReason || `内容匹配: ${term}`;
      }
      // 子词匹配（复合词拆分后逐个匹配关键词）
      else if (subTerms.length > 1) {
        const subMatches = subTerms.filter(st => 
          keys.some(k => k.toLowerCase().includes(st) || st.includes(k.toLowerCase()))
        );
        if (subMatches.length >= subTerms.length * 0.5) {
          matchScore += 1;
          matchReason = matchReason || `子词匹配: ${term} → ${subMatches.join(',')}`;
        }
      }
    }

    if (matchScore > 0) {
      hits.push({
        ...entry,
        _routeScore: matchScore,
        _routeReason: matchReason,
        _source: "router"
      });
    }
  }

  return hits.sort((a, b) => b._routeScore - a._routeScore);
}

/**
 * 查询角色关系
 */
function routeRelations(frame, relationsStore) {
  const results = [];
  const names = frame.characters;

  for (const name of names) {
    if (!name) continue;
    // 使用 relations.js 的查询
    const ctx = relationContextFor(name, relationsStore);
    if (ctx) {
      results.push({
        _type: "relation_context",
        _for: name,
        _content: ctx,
        _source: "router"
      });
    }
  }

  return results;
}

/**
 * 查询角色记忆
 */
function routeCharacterMemories(frame) {
  const results = [];
  for (const name of frame.characters) {
    if (!name) continue;
    const ctx = characterMemoryContext(name);
    if (ctx) {
      results.push({
        _type: "character_memory",
        _for: name,
        _content: ctx,
        _source: "router"
      });
    }
  }
  return results;
}

/**
 * 查询时间线相关事件
 */
function routeTimeline(frame, timelineStore) {
  const events = timelineStore?.events || [];
  if (!events.length) return [];

  return events
    .filter(e => {
      if (!e.relatedEntities) return false;
      const entities = [
        ...(e.relatedEntities.characters || []),
        ...(e.relatedEntities.locations || []),
        ...(e.relatedEntities.organizations || [])
      ];
      return entities.some(entity =>
        frame.characters.includes(entity) || frame.location === entity
      );
    })
    .slice(0, 5)
    .map(e => ({
      ...e,
      _source: "router",
      _match: "entity_link"
    }));
}

/**
 * 查询世界状态
 */
function routeWorldState(frame) {
  return {
    summary: frame.activeWorldState || {},
    _source: "router"
  };
}

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 执行路由查询
 * @param {Object} frame — buildSceneFrame 的输出
 * @param {Object} dataSources — 数据源
 * @param {Object[]} dataSources.worldbookEntries — 世界书条目
 * @param {Object} [dataSources.relationsStore] — 关系存储
 * @param {Object} [dataSources.timelineStore] — 时间线存储
 * @returns {Object} RouterResult
 */
export function route(frame, dataSources = {}) {
  if (!frame || !frame.location && !frame.characters.length) {
    return { worldbook: [], relations: [], memories: [], timeline: [], worldState: null, isEmpty: true };
  }

  const result = {
    worldbook: routeWorldbook(frame, dataSources.worldbookEntries || []),
    relations: routeRelations(frame, dataSources.relationsStore),
    memories: routeCharacterMemories(frame),
    timeline: routeTimeline(frame, dataSources.timelineStore),
    worldState: routeWorldState(frame),
    frame,
    isEmpty: false,
    stats: {
      worldbookHits: 0,
      relationContexts: 0,
      memoryContexts: 0,
      timelineHits: 0
    }
  };

  result.stats.worldbookHits = result.worldbook.length;
  result.stats.relationContexts = result.relations.length;
  result.stats.memoryContexts = result.memories.length;
  result.stats.timelineHits = result.timeline.length;

  return result;
}

/**
 * 生成路由结果的 LLM 注入摘要
 * @param {Object} routerResult
 * @param {string} detail — "full" | "standard" | "compact"
 * @returns {string}
 */
export function routerResultToText(routerResult, detail = "standard") {
  if (routerResult.isEmpty) return "未加载世界数据。";

  const sections = [];

  // 世界书命中
  if (routerResult.worldbook.length) {
    sections.push("【世界书·场景命中】");
    const limit = detail === "compact" ? 2 : (detail === "full" ? 10 : 5);
    for (const wb of routerResult.worldbook.slice(0, limit)) {
      const content = detail === "compact"
        ? wb.content?.slice(0, 80)
        : wb.content?.slice(0, 300);
      sections.push(`  [${wb.title}] ${content}${content?.length >= 300 ? "..." : ""}`);
    }
  }

  // 角色关系
  if (routerResult.relations.length && detail !== "compact") {
    sections.push("【角色关系·场景相关】");
    for (const rel of routerResult.relations) {
      sections.push(rel._content);
    }
  }

  // 角色记忆
  if (routerResult.memories.length && detail !== "compact") {
    sections.push("【角色记忆】");
    for (const mem of routerResult.memories) {
      sections.push(mem._content);
    }
  }

  return sections.join("\n") || "无场景相关信息。";
}

// 导出 sceneFrame 构建器，供外部直接使用
export { worldStateSummary, worldStateCompact };

/** 简单中文分词：每2-3字一组 */
function tokenizeChinese(text) {
  if (!text || text.length <= 2) return [text];
  const tokens = [];
  // 2-gram
  for (let i = 0; i < text.length - 1; i++) {
    tokens.push(text.slice(i, i + 2));
  }
  // 3-gram
  for (let i = 0; i < text.length - 2; i++) {
    tokens.push(text.slice(i, i + 3));
  }
  // 也保留原词
  tokens.unshift(text);
  return [...new Set(tokens)];
}
