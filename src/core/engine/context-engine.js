// ===== 上下文引擎 v1 =====
// World Tree 统一上下文组装入口，当前由 world-engine.js 的 buildEnginePacket 调用。
// 整合 Router + Indexer + Assembler，向各模式 Packet Builder 提供 promptText。
//
// 对外唯一接口: assembleContext(model, options) → { promptText, blocks, stats, sceneFrame }
//
// 模式策略：不同 dataMode 控制哪些数据源被使用、多少细节、多少 token

import { buildSceneFrame, route, routerResultToText } from "./context-router.js";
import { buildIndex, search, indexResultToText } from "./context-indexer.js";
import { assemble, blocksToPrompt } from "./context-assembler.js";
import { budgetFor } from "./context-budget.js";
import { applyDirectorModeToContext } from "./director-modes.js";

// ═══════════════════════════════════════════════════════════════
//  模式策略配置
// ═══════════════════════════════════════════════════════════════

const MODE_STRATEGIES = {
  worldbook: {
    routerEnabled: true,
    indexerEnabled: true,
    detail: "full",
    maxTokens: 4000,
    // 注：Indexer 中的角色/组织/时间线直接从 model 提取，不受此限制
    includeWorldState: true,
    includeRelations: true,
    includeTimeline: true,
    includeCharacterMemory: true
  },
  character_card: {
    routerEnabled: true,    // 仅路由角色卡相关
    indexerEnabled: false,  // 不开全文搜索
    detail: "compact",
    maxTokens: 1500,
    includeWorldState: false,
    includeRelations: false,
    includeTimeline: false,
    includeCharacterMemory: true  // 角色自己的记忆
  },
  preset: {
    routerEnabled: true,
    indexerEnabled: true,
    detail: "standard",
    maxTokens: 2500,
    includeWorldState: true,
    includeRelations: false,
    includeTimeline: false,
    includeCharacterMemory: false
  }
};

// ═══════════════════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 组装上下文 — 供 LLM 调用的统一入口
 * @param {Object} model — World Tree model 对象
 * @param {Object} [options]
 * @param {string} [options.mode] — "worldbook"|"character_card"|"preset"，默认从 engineState 取
 * @param {string} [options.contextBudget] — "generous"|"balanced"|"tight"|"emergency"
 * @param {boolean} [options.skipIndexer] — 跳过索引器（节省 token）
 * @returns {Object} { promptText, blocks, stats, sceneFrame }
 */
export function assembleContext(model, options = {}) {
  // 确定模式策略
  const dataMode = options.mode || model.engineState?.dataMode || "worldbook";
  const directorMode = options.directorMode || model.engineState?.directorMode || "light_novel";
  const strategy = MODE_STRATEGIES[dataMode] || MODE_STRATEGIES.worldbook;

  const effectiveStrategy = applyDirectorModeToContext(directorMode, strategy);

  // Token 预算
  const budget = budgetFor(options.contextBudget || model.engineState?.contextBudget || "balanced");
  const maxTokens = effectiveStrategy.maxTokens;
  const detail = budget.knowledgeMode === "names-only" ? "compact"
    : budget.knowledgeMode === "summary" ? "standard"
    : effectiveStrategy.detail;

  // 构建场景帧
  const sceneFrame = buildSceneFrame(model);

  // Router
  let routerResult = { worldbook: [], relations: [], memories: [], timeline: [], worldState: null, isEmpty: true };
  if (effectiveStrategy.routerEnabled) {
    const dataSources = {
      worldbookEntries: model.moduleData?.worldbook?.entries || model.moduleData?.worldbook || [],
      relationsStore: model.moduleData?.relations || null,
      timelineStore: model.moduleData?.timeline || null
    };
    routerResult = route(sceneFrame, dataSources);

    // 按策略过滤不需要的类型
    if (!effectiveStrategy.includeRelations) routerResult.relations = [];
    if (!effectiveStrategy.includeTimeline) routerResult.timeline = [];
    if (!effectiveStrategy.includeCharacterMemory) routerResult.memories = [];
    if (!effectiveStrategy.includeWorldState) routerResult.worldState = null;
  }

  // Indexer
  let indexerClusters = [];
  if (effectiveStrategy.indexerEnabled && !options.skipIndexer) {
    const index = buildIndex({
      worldbookEntries: model.moduleData?.worldbook?.entries || model.moduleData?.worldbook || [],
      characters: model.moduleData?.characters || [],
      organizations: model.moduleData?.organizations || [],
      timelineEvents: model.moduleData?.timeline?.events || [],
      rules: model.moduleData?.rules || []
    });
    indexerClusters = search(index, sceneFrame, { maxClusters: dataMode === "character_card" ? 3 : 10 });
  }

  // Assembler
  const assembled = assemble(routerResult, indexerClusters, {
    mode: dataMode,
    detail,
    maxTokens
  });

  const promptText = blocksToPrompt(assembled.blocks, dataMode);

  return {
    promptText,
    blocks: assembled.blocks,
    stats: assembled.stats,
    allBlocksCount: assembled.allBlocksCount,
    trimmedCount: assembled.trimmedCount,
    sceneFrame,
    mode: dataMode,
    strategy
  };
}

/**
 * 获取当前模式策略（供外部查询）
 */
export function getModeStrategy(dataMode) {
  return MODE_STRATEGIES[dataMode] || MODE_STRATEGIES.worldbook;
}

/**
 * 注册自定义模式策略（扩展用）
 */
export function registerModeStrategy(modeId, strategy) {
  MODE_STRATEGIES[modeId] = { ...MODE_STRATEGIES.worldbook, ...strategy };
}

// ═══════════════════════════════════════════════════════════════
//  便捷导出
// ═══════════════════════════════════════════════════════════════

export { buildSceneFrame, route, routerResultToText } from "./context-router.js";
export { buildIndex, search, indexResultToText } from "./context-indexer.js";
export { assemble, blocksToPrompt } from "./context-assembler.js";
