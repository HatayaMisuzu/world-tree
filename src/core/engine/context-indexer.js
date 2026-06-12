// ===== 上下文索引器 v1 =====
// 加权全文搜索 + 场景帧提权 + 五机制降噪 + 结果聚类
// 不建独立搜索引擎——利用已有结构化数据的内存索引。
//
// 五机制降噪:
//   ① 类型权重 — 不同类型结果按场景匹配度加权
//   ② 场景帧提权 — 场景实体给关联结果 ×1.5
//   ③ Canon 置信度过滤 — speculative 内容默认不注入
//   ④ 时间相关度衰减 — 远古事件降权，即将触发伏笔提权
//   ⑤ 结果聚类 — 同实体多条命中合并为实体摘要

import { findById } from "./content-registry.js";

// ═══════════════════════════════════════════════════════════════
//  索引构建
// ═══════════════════════════════════════════════════════════════

/**
 * 从已有结构化数据构建内存索引
 * 每轮开始时调用一次（如果数据有变更）
 * @param {Object} dataSources
 * @returns {Object} 索引对象
 */
export function buildIndex(dataSources = {}) {
  const index = {
    documents: [],     // { id, type, entity, text, data, weight }
    typeMap: {},       // typeId → [doc indices]
    entityMap: {}      // entity name → [doc indices]
  };

  let docId = 0;

  // 世界书条目
  for (const entry of (dataSources.worldbookEntries || [])) {
    const doc = {
      id: docId++,
      type: "worldbook-entry",
      entity: entry.title || "",
      text: `${entry.title || ""} ${entry.content || ""} ${(entry.keywords || []).join(" ")}`,
      data: entry,
      baseWeight: 1.0,
      confidence: entry.status === "confirmed" ? 1.0 : entry.status === "proposed" ? 0.3 : 0.7
    };
    addDoc(index, doc);
  }

  // 角色
  for (const ch of (dataSources.characters || [])) {
    const text = `${ch.name} ${ch.role || ""} ${ch.status || ""} ${(ch.traits || []).join(" ")} ${ch.background?.origin || ""}`;
    addDoc(index, {
      id: docId++, type: "character", entity: ch.name, text, data: ch,
      baseWeight: 2.0,  // 角色权重高
      confidence: 1.0
    });
  }

  // 组织
  for (const org of (dataSources.organizations || [])) {
    const text = `${org.name} ${org.type || ""} ${(org.description || "").slice(0, 200)}`;
    addDoc(index, {
      id: docId++, type: "organization", entity: org.name, text, data: org,
      baseWeight: 1.5,
      confidence: 1.0
    });
  }

  // 时间线事件
  for (const ev of (dataSources.timelineEvents || [])) {
    const text = `${ev.title} ${ev.description || ""} ${ev.time || ""}`;
    addDoc(index, {
      id: docId++, type: "timeline", entity: ev.title, text, data: ev,
      baseWeight: 1.2,
      confidence: ev.status === "confirmed" ? 1.0 : ev.status === "likely" ? 0.7 : 0.4
    });
  }

  // 规则
  for (const rule of (dataSources.rules || [])) {
    const text = `${rule.name} ${rule.description || ""} ${(rule.constraints || []).join(" ")}`;
    addDoc(index, {
      id: docId++, type: "rule", entity: rule.name, text, data: rule,
      baseWeight: 0.8,
      confidence: 1.0
    });
  }

  return index;
}

function addDoc(index, doc) {
  index.documents.push(doc);
  const idx = index.documents.length - 1;

  // 类型索引
  if (!index.typeMap[doc.type]) index.typeMap[doc.type] = [];
  index.typeMap[doc.type].push(idx);

  // 实体索引
  if (doc.entity) {
    const key = doc.entity.toLowerCase();
    if (!index.entityMap[key]) index.entityMap[key] = [];
    index.entityMap[key].push(idx);
  }
}

// ═══════════════════════════════════════════════════════════════
//  搜索
// ═══════════════════════════════════════════════════════════════

/**
 * 在索引中搜索
 * @param {Object} index — buildIndex 的输出
 * @param {Object} frame — 场景帧
 * @param {Object} [opts]
 * @returns {Object[]} 搜索结果（已应用五机制降噪）
 */
export function search(index, frame, opts = {}) {
  if (!index || !index.documents.length) return [];

  // 从场景帧提取搜索词
  const terms = extractSearchTerms(frame);
  if (!terms.length) return [];

  // 对每个搜索词执行全文搜索
  const allHits = [];
  for (const term of terms) {
    const hits = fulltextSearch(index, term);
    allHits.push(...hits);
  }

  if (!allHits.length) return [];

  // 去重（同一 doc 可被多个 term 命中，取最高分）
  const byDoc = new Map();
  for (const hit of allHits) {
    const existing = byDoc.get(hit.docId);
    if (!existing || hit._rawScore > existing._rawScore) {
      byDoc.set(hit.docId, hit);
    }
  }
  const deduped = [...byDoc.values()];

  // ═══ 五机制降噪 ═══

  // ① 类型权重
  const weighted = deduped.map(hit => ({
    ...hit,
    _score: hit._rawScore * (hit._doc?.baseWeight || 1.0)
  }));

  // ② 场景帧提权
  const boosted = weighted.map(hit => {
    let boost = 1.0;
    const doc = hit._doc;
    if (!doc) return hit;

    // 实体在场景角色中 → ×1.5
    if (frame.characters?.some(c => c.toLowerCase() === (doc.entity || "").toLowerCase())) {
      boost *= 1.5;
    }
    // 实体是当前地点 → ×1.5
    if ((doc.entity || "").toLowerCase() === (frame.location || "").toLowerCase()) {
      boost *= 1.5;
    }
    // 关联实体含场景角色 → ×1.3
    const relatedChars = doc.data?.relatedEntities?.characters || [];
    if (relatedChars.some(c => frame.characters?.includes(c))) {
      boost *= 1.3;
    }

    return { ...hit, _score: hit._score * boost, _boost: boost };
  });

  // ③ Canon 置信度过滤
  const filtered = boosted.filter(hit => {
    const conf = hit._doc?.confidence ?? 1.0;
    // proposed 条目仅当没有更好结果时才保留
    if (conf < 0.5) {
      const hasBetter = boosted.some(h =>
        h._doc?.type === hit._doc?.type && (h._doc?.confidence ?? 1.0) >= 0.7
      );
      return !hasBetter;
    }
    return true;
  });

  // ④ 时间相关度衰减
  const timeAdjusted = filtered.map(hit => {
    if (hit._doc?.type !== "timeline") return hit;
    const timeStr = hit._doc?.data?.time || "";
    const timeMatch = timeStr.match(/第\s*(\d+)\s*天/);
    if (!timeMatch) return hit;

    const eventDay = parseInt(timeMatch[1]);
    const currentDay = frame.dayNumber || frame.round || 0;
    const dayDiff = Math.abs(currentDay - eventDay);

    let timeWeight = 1.0;
    if (dayDiff === 0) timeWeight = 1.5;       // 当天事件提权
    else if (dayDiff <= 2) timeWeight = 1.2;    // 近期事件略提
    else if (dayDiff > 30) timeWeight = 0.5;    // 远古事件降权
    else if (dayDiff > 100) timeWeight = 0.3;

    // 伏笔事件不受衰减（即将触发）
    if (hit._doc?.data?.type === "foreshadowing") timeWeight = Math.max(timeWeight, 1.2);

    return { ...hit, _score: hit._score * timeWeight, _timeWeight: timeWeight };
  });

  // ⑤ 结果聚类
  return clusterByEntity(timeAdjusted, opts.maxClusters || 10);
}

// ═══════════════════════════════════════════════════════════════
//  全文搜索
// ═══════════════════════════════════════════════════════════════

function fulltextSearch(index, term) {
  const hits = [];
  const lowerTerm = term.toLowerCase();
  if (lowerTerm.length < 2) return hits;

  for (const doc of index.documents) {
    // 跳过低置信度 speculative 条目
    if ((doc.confidence || 1.0) < 0.3) continue;

    const text = doc.text.toLowerCase();
    const idx = text.indexOf(lowerTerm);
    if (idx < 0) continue;

    // 计算原始得分（位置越靠前 + 频率越高 → 分数越高）
    const positionScore = 1.0 - (idx / Math.max(text.length, 1));
    const frequencyScore = countOccurrences(text, lowerTerm) * 0.3;
    const exactMatch = text.includes(` ${lowerTerm} `) ? 1.5 : 1.0;
    const titleMatch = (doc.entity || "").toLowerCase().includes(lowerTerm) ? 2.0 : 1.0;

    const rawScore = (positionScore + frequencyScore + exactMatch + titleMatch) / 4;

    hits.push({
      docId: doc.id,
      _doc: doc,
      _rawScore: rawScore,
      _term: term,
      _matchedIn: idx < 50 ? "title" : "content"
    });
  }

  return hits.sort((a, b) => b._rawScore - a._rawScore);
}

function countOccurrences(text, term) {
  let count = 0, pos = 0;
  while ((pos = text.indexOf(term, pos)) >= 0) { count++; pos += term.length; }
  return count;
}

// ═══════════════════════════════════════════════════════════════
//  搜索词提取
// ═══════════════════════════════════════════════════════════════

function extractSearchTerms(frame) {
  const terms = [];

  // 地点
  if (frame.location) terms.push(frame.location);

  // 角色名
  terms.push(...(frame.characters || []));

  // 冲突关键词
  if (frame.conflict?.type) terms.push(frame.conflict.type);
  if (frame.conflict?.stakes) terms.push(frame.conflict.stakes);

  // 线索关键词（取前 5 个字）
  for (const clue of (frame.clues || [])) {
    const desc = clue.description || clue;
    if (typeof desc === "string" && desc.length >= 2) {
      terms.push(desc.slice(0, 8));
    }
  }

  // 情绪关键词
  for (const [name, emotion] of Object.entries(frame.emotions || {})) {
    if (emotion?.emotion) terms.push(emotion.emotion);
  }

  // 去重 + 去短词
  return [...new Set(terms.filter(t => t && t.length >= 2))];
}

// ═══════════════════════════════════════════════════════════════
//  ⑤ 结果聚类
// ═══════════════════════════════════════════════════════════════

function clusterByEntity(hits, maxClusters = 10) {
  // 按实体分组
  const clusters = new Map();
  const unclustered = [];

  for (const hit of hits) {
    const entity = hit._doc?.entity;
    if (entity) {
      if (!clusters.has(entity)) {
        clusters.set(entity, { entity, items: [], totalScore: 0, type: hit._doc?.type });
      }
      const cluster = clusters.get(entity);
      cluster.items.push(hit);
      cluster.totalScore += hit._score || 0;
    } else {
      unclustered.push(hit);
    }
  }

  // 聚类内排序 + 降噪（同实体只保留 top 3）
  const result = [];
  for (const [entity, cluster] of clusters) {
    cluster.items.sort((a, b) => (b._score || 0) - (a._score || 0));
    cluster.topItems = cluster.items.slice(0, 3);
    cluster.avgScore = cluster.totalScore / cluster.items.length;

    result.push({
      _clustered: true,
      entity,
      type: cluster.type,
      count: cluster.items.length,
      avgScore: cluster.avgScore,
      topItem: cluster.topItems[0]?._doc?.data,
      summary: generateClusterSummary(cluster),
      _items: cluster.topItems
    });
  }

  // 未聚类的单独列出
  for (const hit of unclustered.slice(0, 5)) {
    result.push({
      _clustered: false,
      entity: hit._doc?.entity || "(未知)",
      type: hit._doc?.type,
      count: 1,
      avgScore: hit._score || 0,
      topItem: hit._doc?.data,
      summary: hit._doc?.text?.slice(0, 120) || "",
      _items: [hit]
    });
  }

  // 按总分排序
  result.sort((a, b) => b.avgScore - a.avgScore);

  return result.slice(0, maxClusters);
}

function generateClusterSummary(cluster) {
  if (cluster.items.length === 1) {
    return cluster.items[0]._doc?.text?.slice(0, 150) || "";
  }
  return `${cluster.items.length} 条相关信息，涉及${cluster.type || "多种类型"}`;
}

// ═══════════════════════════════════════════════════════════════
//  索引结果生成 LLM 注入文本
// ═══════════════════════════════════════════════════════════════

export function indexResultToText(clusters, detail = "standard") {
  if (!clusters || !clusters.length) return "无额外检索发现。";

  const lines = ["【智能检索·场景发现】"];
  const limit = detail === "compact" ? 3 : (detail === "full" ? 10 : 6);

  for (const cluster of clusters.slice(0, limit)) {
    const icon = typeIcon(cluster.type);
    const scoreBar = "█".repeat(Math.min(5, Math.round(cluster.avgScore * 5)));

    if (cluster._clustered && cluster.count > 1) {
      lines.push(`  ${icon} ${cluster.entity} (${cluster.count}条) ${scoreBar}`);
      for (const item of cluster._items.slice(0, 2)) {
        const excerpt = item._doc?.text?.slice(0, 100) || "";
        lines.push(`     ${excerpt}`);
      }
    } else {
      lines.push(`  ${icon} ${cluster.entity} ${scoreBar} ${cluster.summary?.slice(0, 120)}`);
    }
  }

  return lines.join("\n");
}

function typeIcon(type) {
  const icons = {
    "character": "👤", "organization": "🏛️", "location": "📍",
    "timeline": "📜", "rule": "📖", "worldbook-entry": "📚",
    "item": "🗡️", "faction": "⚔️", "relation": "🔗"
  };
  return icons[type] || "📄";
}
