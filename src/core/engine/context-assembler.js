// ===== 上下文组装器 v1 =====
// 合并路由器输出 + 索引器输出 → 去重 → 优先级排序 → 生成最终注入块
// Router 优先（确定性、高置信），Indexer 补充（发现性、低置信需过滤）
//
// 输出: ContextBlocks — 按优先级排序的上下文块列表

import { routerResultToText } from "./context-router.js";
import { indexResultToText } from "./context-indexer.js";

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 组装最终上下文
 * @param {Object} routerResult — route() 的输出
 * @param {Object[]} indexerClusters — search() 的输出
 * @param {Object} options
 * @param {string} options.mode — "worldbook"|"character_card"|"preset"
 * @param {string} options.detail — "full"|"standard"|"compact"
 * @param {number} options.maxTokens — 最大 token 估算
 * @returns {Object} { blocks, summary, stats }
 */
export function assemble(routerResult, indexerClusters, options = {}) {
  const { mode = "worldbook", detail = "standard", maxTokens = 3000 } = options;

  const blocks = [];
  const seen = new Set();  // 已注入实体（去重）

  // ═══════════════════════════════════════════════════════════
  //  第一优先级: Router 产出（确定性）
  // ═══════════════════════════════════════════════════════════

  // 世界书命中（Router）
  for (const wb of (routerResult.worldbook || [])) {
    const key = `wb:${wb.title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    blocks.push({
      priority: 10,
      source: "router",
      type: "worldbook",
      entity: wb.title,
      content: wb.content?.slice(0, 400) || "",
      metadata: { score: wb._routeScore, reason: wb._routeReason }
    });
  }

  // 角色关系（Router）
  for (const rel of (routerResult.relations || [])) {
    const key = `rel:${rel._for}`;
    if (seen.has(key)) continue;
    seen.add(key);

    blocks.push({
      priority: 9,
      source: "router",
      type: "relation",
      entity: rel._for,
      content: rel._content || "",
      metadata: {}
    });
  }

  // 角色记忆（Router）
  for (const mem of (routerResult.memories || [])) {
    const key = `mem:${mem._for}`;
    if (seen.has(key)) continue;
    seen.add(key);

    blocks.push({
      priority: 8,
      source: "router",
      type: "character_memory",
      entity: mem._for,
      content: mem._content || "",
      metadata: {}
    });
  }

  // 时间线（Router）
  for (const tl of (routerResult.timeline || [])) {
    const key = `tl:${tl.id || tl.title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    blocks.push({
      priority: 7,
      source: "router",
      type: "timeline",
      entity: tl.title,
      content: `${tl.time || ""}: ${tl.title} — ${(tl.description || "").slice(0, 200)}`,
      metadata: { type: tl.type, status: tl.status }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  第二优先级: Indexer 产出（发现性，须过滤）
  // ═══════════════════════════════════════════════════════════

  for (const cluster of (indexerClusters || [])) {
    const key = `idx:${cluster.entity}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // 低分集群跳过（噪音过滤）
    if (cluster.avgScore < 0.3 && detail !== "full") continue;

    // 如果 Router 已经覆盖了同一实体，降低 Indexer 优先级
    const alreadyCovered = seen.has(`wb:${cluster.entity}`) ||
      seen.has(`rel:${cluster.entity}`) ||
      seen.has(`mem:${cluster.entity}`);

    blocks.push({
      priority: alreadyCovered ? 3 : 5,
      source: "indexer",
      type: cluster.type || "unknown",
      entity: cluster.entity,
      content: cluster.summary || "",
      metadata: {
        avgScore: cluster.avgScore,
        count: cluster.count,
        clustered: cluster._clustered
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  第三优先级: 世界状态（始终注入）
  // ═══════════════════════════════════════════════════════════

  if (routerResult.worldState) {
    blocks.push({
      priority: 11,  // 最高优先级
      source: "router",
      type: "world_state",
      entity: "world",
      content: JSON.stringify(routerResult.worldState.summary || {}),
      metadata: {}
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  排序 + 裁剪
  // ═══════════════════════════════════════════════════════════

  blocks.sort((a, b) => b.priority - a.priority);

  // Token 预算控制
  const trimmed = trimByTokens(blocks, maxTokens, mode);

  return {
    blocks: trimmed,
    allBlocksCount: blocks.length,
    trimmedCount: blocks.length - trimmed.length,
    stats: {
      routerBlocks: blocks.filter(b => b.source === "router").length,
      indexerBlocks: blocks.filter(b => b.source === "indexer").length,
      byType: countByType(blocks),
      topEntities: blocks.slice(0, 5).map(b => b.entity)
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  Token 预算控制
// ═══════════════════════════════════════════════════════════════

function trimByTokens(blocks, maxTokens, mode) {
  // 简单 Token 估算：中文约 1 字符 ≈ 0.5 token
  // 实际使用更保守的 1 字符 ≈ 1 token 来留余地
  let used = 0;
  const result = [];

  // 角色卡模式：只取最高优先级的 3 块
  if (mode === "character_card") {
    return blocks.slice(0, 3);
  }

  for (const block of blocks) {
    const estimatedTokens = (block.content || "").length;
    if (used + estimatedTokens > maxTokens) {
      // 还剩空间但不够完整内容 → 截断
      if (used < maxTokens * 0.8) {
        const remaining = maxTokens - used - 50;
        if (remaining > 100) {
          result.push({ ...block, content: (block.content || "").slice(0, remaining) + "..." });
        }
      }
      break;
    }
    used += estimatedTokens;
    result.push(block);
  }

  return result;
}

function countByType(blocks) {
  const map = {};
  for (const b of blocks) {
    map[b.type] = (map[b.type] || 0) + 1;
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════
//  生成 LLM Prompt 注入文本
// ═══════════════════════════════════════════════════════════════

/**
 * 将 assembled blocks 转换为 LLM system prompt 中的上下文段落
 * @param {Object[]} blocks
 * @param {string} mode
 * @returns {string}
 */
export function blocksToPrompt(blocks, mode = "worldbook") {
  if (!blocks.length) return "";

  const sections = [];
  let currentType = "";

  for (const block of blocks) {
    // 同类型连续块合并到一个标题下
    if (block.type !== currentType) {
      currentType = block.type;
      sections.push("", `【${typeLabel(block.type)}】`);
    }

    // 角色卡模式：更简洁的格式
    if (mode === "character_card") {
      sections.push(`${block.content?.slice(0, 200)}`);
    } else {
      // 世界书/预设模式：带来源标记
      const sourceTag = block.source === "indexer" ? "[检索]" : "";
      sections.push(`${sourceTag}${block.content?.slice(0, 400)}`);
    }
  }

  return sections.join("\n").trim();
}

function typeLabel(type) {
  const labels = {
    "worldbook": "场景设定",
    "relation": "角色关系",
    "character_memory": "角色认知",
    "timeline": "相关事件",
    "world_state": "世界状态",
    "character": "角色信息",
    "organization": "组织信息",
    "rule": "世界规则",
    "location": "地点信息"
  };
  return labels[type] || type;
}

// ═══════════════════════════════════════════════════════════════
//  便捷函数：一站式组装
// ═══════════════════════════════════════════════════════════════

/**
 * 一站式：从原始数据到 LLM 注入文本
 */
export function assembleAndFormat(routerResult, indexerClusters, mode = "worldbook", detail = "standard") {
  const { blocks, stats } = assemble(routerResult, indexerClusters, { mode, detail });
  const promptText = blocksToPrompt(blocks, mode);
  return { promptText, blocks, stats };
}
