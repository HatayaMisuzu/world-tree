import { extractTelemetryData, telemetryWorldName } from "./telemetry-data-extractor.js";
// ===== 世界脉象 v1 (World Telemetry) =====
// 自适应维度池 + LLM 个性化选择 + 趋势追踪 + 三层输出（用户/LLM/系统）
// 
// 核心设计:
//   ① 维度池 — 15个预定义维度，每个标注适用世界类型
//   ② LLM自适应 — 读世界书后选择适用维度 + 可生成专属自定义维度
//   ③ 趋势追踪 — 每轮对比上一轮，输出变化方向和幅度
//   ④ 三层输出 — 用户看摘要 / LLM得hints / 系统得alerts
//
// 关键原则: 只读不写——所有数据来自已有模块，不创造新事实

// ═══════════════════════════════════════════════════════════════
//  维度池（15个预定义维度）
// ═══════════════════════════════════════════════════════════════

export const DIMENSION_POOL = [
  {
    id: "stability",
    name: "稳定度",
    description: "世界秩序是否稳定",
    applicableWorlds: ["*"],   // 全部适用
    defaultWeight: 0.25,
    calculate: (data) => clamp(100 - (data.conflictIntensity || 0) * 25 - (data.unresolvedEvents || 0) * 5, 0, 100),
    warningThreshold: 50,
    criticalThreshold: 30,
    direction: "lower_is_worse",
    hintOnLow: ["increase_cohesion", "resolve_conflicts", "reduce_chaos"],
    hintOnHigh: ["maintain_balance"]
  },
  {
    id: "chaos",
    name: "混乱度",
    description: "事件密度和场景切换频率",
    applicableWorlds: ["*"],
    defaultWeight: 0.10,
    calculate: (data) => clamp((data.eventDensity || 0) * 50 + (data.sceneSwitchRate || 0) * 30, 0, 100),
    warningThreshold: 60,
    criticalThreshold: 80,
    direction: "higher_is_worse",
    hintOnHigh: ["slow_pacing", "focus_threads", "reduce_new_events"],
    hintOnLow: ["introduce_variety"]
  },
  {
    id: "mystery",
    name: "神秘度",
    description: "未回收伏笔和未知线索浓度",
    applicableWorlds: ["*"],
    defaultWeight: 0.10,
    calculate: (data) => clamp((data.unresolvedForeshadowing || 0) * 10 + (data.unknownClues || 0) * 8, 0, 100),
    warningThreshold: 60,
    criticalThreshold: 80,
    direction: "higher_is_worse",
    hintOnHigh: ["reveal_partial", "resolve_foreshadowing", "avoid_new_mysteries"],
    hintOnLow: ["plant_foreshadowing"]
  },
  {
    id: "war_risk",
    name: "战争风险",
    description: "阵营敌意和势力冲突升温",
    applicableWorlds: ["epic", "scifi", "wuxia", "dark_fantasy"],
    defaultWeight: 0.15,
    calculate: (data) => clamp((data.hostileRelations || 0) * 8 + (data.factionTension || 0) * 15, 0, 100),
    warningThreshold: 60,
    criticalThreshold: 80,
    direction: "higher_is_worse",
    hintOnHigh: ["increase_tension", "surface_faction_pressure", "avoid_comedy"],
    hintOnLow: ["maintain_peace"]
  },
  {
    id: "character_stress",
    name: "角色压力",
    description: "主要角色精神/身体/处境压力",
    applicableWorlds: ["*"],
    defaultWeight: 0.15,
    calculate: (data) => {
      // 恐惧×0.3 + 疲惫×0.25 + 愤怒×0.2 + 悲伤×0.15 + 危机×0.1
      const stress = (data.fearAvg || 0) * 0.3
        + (data.fatigueAvg || 0) * 0.25
        + (data.angerAvg || 0) * 0.2
        + (data.sadnessAvg || 0) * 0.15
        + (data.crisisCount || 0) * 0.1;
      return clamp(stress, 0, 100);
    },
    warningThreshold: 60,
    criticalThreshold: 75,
    direction: "higher_is_worse",
    hintOnHigh: ["reduce_pressure", "provide_relief", "avoid_crisis"],
    hintOnLow: ["maintain_engagement"]
  },
  {
    id: "faction_conflict",
    name: "阵营冲突",
    description: "阵营间敌对关系占比",
    applicableWorlds: ["epic", "scifi", "wuxia", "urban"],
    defaultWeight: 0.10,
    calculate: (data) => clamp(
      data.totalRelations > 0 ? (data.hostileRelations / data.totalRelations) * 100 : 0, 0, 100
    ),
    warningThreshold: 50,
    criticalThreshold: 70,
    direction: "higher_is_worse",
    hintOnHigh: ["emphasize_diplomacy", "create_common_enemy"],
    hintOnLow: []
  },
  {
    id: "rule_completeness",
    name: "规则完整度",
    description: "世界规则是否足够支撑推演",
    applicableWorlds: ["*"],
    defaultWeight: 0.05,
    calculate: (data) => clamp(
      data.expectedRules > 0 ? (data.confirmedRules / data.expectedRules) * 100 : 50, 0, 100
    ),
    warningThreshold: 40,
    criticalThreshold: 20,
    direction: "lower_is_worse",
    hintOnLow: ["suggest_rule_expansion", "avoid_magic_heavy_plots"],
    hintOnHigh: []
  },
  {
    id: "narrative_momentum",
    name: "叙事动能",
    description: "剧情推进力——是否有足够燃料",
    applicableWorlds: ["*"],
    defaultWeight: 0.10,
    calculate: (data) => clamp(
      (data.activeObjectives || 0) * 10 + (data.openConflicts || 0) * 15 + (data.unfinishedScenes || 0) * 5, 0, 100
    ),
    warningThreshold: 30,   // 动能太低——故事停滞
    criticalThreshold: 15,
    direction: "lower_is_worse",
    hintOnLow: ["introduce_new_objective", "escalate_existing_conflict", "add_time_pressure"],
    hintOnHigh: ["focus_priorities", "resolve_subplots"]
  },
  {
    id: "memory_load",
    name: "记忆负载",
    description: "上下文记忆压力——不代表坏，只代表需关注",
    applicableWorlds: ["*"],
    defaultWeight: 0.05,
    calculate: (data) => clamp(
      data.memoryCapacity > 0
        ? ((data.recentFacts || 0) + (data.activeThreads || 0) + (data.keyEvents || 0)) / data.memoryCapacity * 100
        : 30, 0, 100
    ),
    warningThreshold: 70,
    criticalThreshold: 85,
    direction: "higher_is_worse",
    hintOnHigh: ["compress_context", "prune_old_memories", "resolve_threads"],
    hintOnLow: []
  },
  {
    id: "magical_balance",
    name: "魔法平衡",
    description: "魔法体系是否稳定",
    applicableWorlds: ["epic", "scifi", "wuxia", "magical_girl"],
    defaultWeight: 0.08,
    calculate: (data) => clamp(100 - (data.magicAnomalies || 0) * 15 - (data.forbiddenSpells || 0) * 20, 0, 100),
    warningThreshold: 50,
    criticalThreshold: 30,
    direction: "lower_is_worse",
    hintOnLow: ["introduce_magic_consequence", "limit_spell_usage"],
    hintOnHigh: []
  },
  {
    id: "social_stability",
    name: "社会安定",
    description: "社会秩序和治安状况",
    applicableWorlds: ["urban", "campus", "daily", "magical_girl"],
    defaultWeight: 0.10,
    calculate: (data) => clamp(100 - (data.socialUnrest || 0) * 10 - (data.crimeEvents || 0) * 8, 0, 100),
    warningThreshold: 55,
    criticalThreshold: 35,
    direction: "lower_is_worse",
    hintOnLow: ["surface_social_tension", "introduce_authority_response"],
    hintOnHigh: ["maintain_peaceful_tone"]
  },
  {
    id: "romance_tension",
    name: "关系张力",
    description: "角色间情感关系的动态变化",
    applicableWorlds: ["character_card", "campus", "daily", "magical_girl"],
    defaultWeight: 0.12,
    calculate: (data) => clamp((data.relationChanges || 0) * 8 + (data.emotionalEvents || 0) * 10, 0, 100),
    warningThreshold: 70,
    criticalThreshold: 85,
    direction: "neutral",  // 张力高不一定坏
    hintOnHigh: ["deepen_emotional_scenes", "create_intimate_moments"],
    hintOnLow: ["introduce_emotional_beat"]
  },
  {
    id: "technology_drift",
    name: "科技偏移",
    description: "科技体系是否偏离设定基准",
    applicableWorlds: ["scifi"],
    defaultWeight: 0.08,
    calculate: (data) => clamp((data.techAnomalies || 0) * 15 + (data.unexplainedTech || 0) * 10, 0, 100),
    warningThreshold: 50,
    criticalThreshold: 70,
    direction: "higher_is_worse",
    hintOnHigh: ["enforce_tech_consistency", "explain_anomalies"],
    hintOnLow: []
  },
  {
    id: "corruption_level",
    name: "腐化程度",
    description: "黑暗力量和道德堕落的影响",
    applicableWorlds: ["dark_fantasy", "wuxia"],
    defaultWeight: 0.08,
    calculate: (data) => clamp((data.darkEvents || 0) * 10 + (data.moralViolations || 0) * 12, 0, 100),
    warningThreshold: 55,
    criticalThreshold: 75,
    direction: "higher_is_worse",
    hintOnHigh: ["introduce_purification_quest", "show_corruption_consequences"],
    hintOnLow: []
  },
  {
    id: "hope_index",
    name: "希望指数",
    description: "正面事件和角色成长",
    applicableWorlds: ["daily", "campus", "magical_girl", "healing"],
    defaultWeight: 0.08,
    calculate: (data) => clamp((data.positiveEvents || 0) * 10 + (data.characterGrowth || 0) * 12, 0, 100),
    warningThreshold: 30,   // 希望太低
    criticalThreshold: 15,
    direction: "lower_is_worse",
    hintOnLow: ["create_uplifting_moment", "show_character_growth", "introduce_hope_symbol"],
    hintOnHigh: ["maintain_warmth"]
  }
];

// ═══════════════════════════════════════════════════════════════
//  遥测存储
// ═══════════════════════════════════════════════════════════════

const TELEMETRY_STORE = {
  profiles: {},           // { worldName: { activeDimensions, customDimensions, weights } }
  history: {},            // { worldName: [{ round, dimensions: {}, overall, hints, alerts }] }
  maxHistory: 50
};

// ═══════════════════════════════════════════════════════════════
//  LLM 自适应选择
// ═══════════════════════════════════════════════════════════════

/**
 * 生成维度选择 prompt（供外部 LLM 调用）
 * @param {Object} worldInfo — { worldbookSummary, worldType, worldName }
 * @returns {string} LLM prompt
 */
export function buildDimensionSelectionPrompt(worldInfo = {}) {
  const pool = DIMENSION_POOL.map(d =>
    `  ${d.id}(${d.name}): ${d.description} [适用: ${d.applicableWorlds.join('/')}]`
  ).join("\n");

  return [
    "你是世界态势配置器。根据世界书的设定，为该世界选择合适的态势维度。",
    "",
    `世界名称: ${worldInfo.worldName || "未知"}`,
    `世界类型: ${worldInfo.worldType || "daily"}`,
    `世界书摘要: ${worldInfo.worldbookSummary || "无"}`,
    "",
    "【可用维度池】",
    pool,
    "",
    "【任务】",
    "1. 从维度池中选择适合这个世界的维度（4-7个）",
    "2. 可以为这个世界生成1-2个专属自定义维度（如'魔法少女力''灵力浓度''变身稳定度'）",
    "3. 为每个维度设置权重（总和=1.0）",
    "",
    "输出JSON:",
    `{
  "activeDimensions": ["stability", "chaos", ...],
  "customDimensions": [
    {
      "id": "custom_id",
      "name": "维度名",
      "description": "描述",
      "dataHint": "从哪里获取数据（角色状态/事件类型/世界书条目等）",
      "defaultWeight": 0.1,
      "warningThreshold": 50,
      "criticalThreshold": 30
    }
  ],
  "weightOverrides": { "stability": 0.3, ... },
  "reasoning": "选择理由（一句话）"
}`,
    "",
    "规则:",
    "- 都市魔法少女世界 → 选social_stability/romance_tension/hope_index，不选war_risk",
    "- 史诗战争世界 → 选war_risk/faction_conflict/corruption_level",
    "- 日常治愈世界 → 选romance_tension/hope_index/social_stability",
    "- 总维度数 4-7 个",
    "- 权重总和 = 1.0",
    "- 输出纯 JSON"
  ].join("\n");
}

/**
 * 注册世界的遥测配置
 * @param {string} worldName
 * @param {Object} config — LLM 返回的 JSON 解析结果
 */
export function registerTelemetryProfile(worldName, config = {}) {
  const activeIds = config.activeDimensions || ["stability", "chaos", "mystery", "character_stress", "narrative_momentum"];
  const customDims = config.customDimensions || [];
  const weights = config.weightOverrides || {};

  // 构建激活维度列表
  const activeDimensions = [];
  for (const id of activeIds) {
    const poolDim = DIMENSION_POOL.find(d => d.id === id);
    if (poolDim) {
      activeDimensions.push({
        ...poolDim,
        weight: weights[id] || poolDim.defaultWeight
      });
    }
  }

  // 添加自定义维度
  for (const custom of customDims) {
    activeDimensions.push({
      id: custom.id,
      name: custom.name,
      description: custom.description || "",
      applicableWorlds: ["*"],
      defaultWeight: custom.defaultWeight || 0.1,
      weight: custom.defaultWeight || 0.1,
      calculate: null,  // 自定义维度需要外部提供计算函数
      warningThreshold: custom.warningThreshold || 50,
      criticalThreshold: custom.criticalThreshold || 30,
      direction: "lower_is_worse",
      hintOnLow: [],
      hintOnHigh: [],
      isCustom: true,
      dataHint: custom.dataHint || ""
    });
  }

  TELEMETRY_STORE.profiles[worldName] = {
    activeDimensions,
    customDimensions: customDims,
    config,
    registeredAt: new Date().toISOString()
  };

  return TELEMETRY_STORE.profiles[worldName];
}

// ═══════════════════════════════════════════════════════════════
//  运行时计算
// ═══════════════════════════════════════════════════════════════

/**
 * 每轮计算世界脉象
 * @param {string} worldName
 * @param {number} round
 * @param {Object} data — 各数据源汇总 { conflictIntensity, unresolvedEvents, ... }
 * @param {Object} [customCalcFns] — 自定义维度的计算函数 { custom_id: (data) => number }
 * @returns {Object} telemetry snapshot
 */
export function calculateTelemetry(worldName, round, data = {}, customCalcFns = {}) {
  const safeFns = customCalcFns || {};
  const profile = TELEMETRY_STORE.profiles[worldName];
  if (!profile) {
    // 无配置时返回默认维度
    return calculateDefault(worldName, data, round);
  }

  const dimensions = {};
  const allHints = [];
  const alerts = [];

  for (const dim of profile.activeDimensions) {
    let value;

    if (dim.isCustom && safeFns[dim.id]) {
      value = clamp(safeFns[dim.id](data), 0, 100);
    } else if (dim.calculate) {
      value = dim.calculate(data);
    } else {
      value = 50; // 默认中位
    }

    // 趋势计算
    const trend = calculateTrend(worldName, dim.id, value, round);

    // 阈值检查
    let status = "normal";
    if (dim.direction === "lower_is_worse") {
      if (value <= dim.criticalThreshold) status = "critical";
      else if (value <= dim.warningThreshold) status = "warning";
    } else if (dim.direction === "higher_is_worse") {
      if (value >= dim.criticalThreshold) status = "critical";
      else if (value >= dim.warningThreshold) status = "warning";
    }

    // 生成 hints
    if (status !== "normal") {
      const hints = dim.direction === "lower_is_worse"
        ? dim.hintOnLow
        : dim.hintOnHigh;
      for (const h of hints) allHints.push(h);
    }

    if (status === "critical") {
      alerts.push({
        dimension: dim.id,
        name: dim.name,
        value,
        trend: trend.delta > 0 ? `↑${trend.delta}` : `↓${Math.abs(trend.delta)}`,
        status: "critical",
        message: `${dim.name} ${value} 处于危险范围`,
        consecutiveRounds: trend.consecutiveDirection || 0
      });
    } else if (status === "warning" && trend.consecutiveDirection >= 3) {
      alerts.push({
        dimension: dim.id,
        name: dim.name,
        value,
        trend: trend.delta > 0 ? `↑${trend.delta}` : `↓${Math.abs(trend.delta)}`,
        status: "warning",
        message: `${dim.name} 连续 ${trend.consecutiveDirection} 轮恶化`,
        consecutiveRounds: trend.consecutiveDirection
      });
    }

    dimensions[dim.id] = {
      name: dim.name,
      value,
      weight: dim.weight,
      status,
      trend,
      isCustom: dim.isCustom || false
    };
  }

  // 综合评分（加权平均）
  let overall = 0, totalWeight = 0;
  for (const [id, d] of Object.entries(dimensions)) {
    overall += contributionValue(d) * (d.weight || 0.1);
    totalWeight += d.weight || 0.1;
  }
  overall = totalWeight > 0 ? clamp(Math.round(overall / totalWeight), 0, 100) : 50;

  // 整体状态
  const overallStatus = alerts.filter(a => a.status === "critical").length > 0 ? "critical"
    : alerts.length > 0 ? "warning" : "stable";

  const snapshot = {
    worldName,
    round,
    overall,
    overallStatus,
    dimensions,
    hints: [...new Set(allHints)].slice(0, 5),
    alerts,
    timestamp: new Date().toISOString()
  };

  // 存历史
  if (!TELEMETRY_STORE.history[worldName]) TELEMETRY_STORE.history[worldName] = [];
  TELEMETRY_STORE.history[worldName].push(snapshot);
  if (TELEMETRY_STORE.history[worldName].length > TELEMETRY_STORE.maxHistory) {
    TELEMETRY_STORE.history[worldName] = TELEMETRY_STORE.history[worldName].slice(-TELEMETRY_STORE.maxHistory);
  }

  return snapshot;
}

// ═══════════════════════════════════════════════════════════════
//  趋势计算
// ═══════════════════════════════════════════════════════════════

function calculateTrend(worldName, dimId, currentValue, round) {
  const history = TELEMETRY_STORE.history[worldName] || [];
  if (history.length < 1) return { delta: 0, direction: "stable", consecutiveDirection: 0 };

  const prev = history[history.length - 1];
  const prevValue = prev.dimensions?.[dimId]?.value;

  if (prevValue === undefined) return { delta: 0, direction: "stable", consecutiveDirection: 0 };

  const delta = Math.round(currentValue - prevValue);
  const direction = delta > 2 ? "rising" : delta < -2 ? "falling" : "stable";

  // 连续方向
  let consecutiveDirection = 1;
  for (let i = history.length - 1; i >= 0; i--) {
    const val = history[i].dimensions?.[dimId]?.value;
    if (val === undefined) break;
    const prevDelta = i > 0 ? val - (history[i - 1]?.dimensions?.[dimId]?.value || val) : 0;
    if ((delta > 0 && prevDelta > 0) || (delta < 0 && prevDelta < 0)) {
      consecutiveDirection++;
    } else {
      break;
    }
  }

  return { delta, direction, consecutiveDirection };
}

// ═══════════════════════════════════════════════════════════════
//  三层输出
// ═══════════════════════════════════════════════════════════════

/**
 * ① 用户层：简洁摘要
 */
export function userSummary(snapshot) {
  if (!snapshot) return "世界脉象未初始化";

  const statusIcon = snapshot.overallStatus === "critical" ? "🔴"
    : snapshot.overallStatus === "warning" ? "🟡" : "🟢";

  const statusNames = { stable: "平稳", warning: "暗流涌动", critical: "临界" };
  const statusText = statusNames[snapshot.overallStatus] || snapshot.overallStatus;

  const dims = Object.entries(snapshot.dimensions || {})
    .sort(([, a], [, b]) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 4)
    .map(([, d]) => {
      const trendStr = d.trend.delta > 0 ? `↑${d.trend.delta}`
        : d.trend.delta < 0 ? `↓${Math.abs(d.trend.delta)}` : "→";
      const warn = d.status === "critical" ? "⚠️" : d.status === "warning" ? "⚡" : "";
      return `${d.name} ${d.value}${warn} ${trendStr}`;
    })
    .join(" | ");

  return `${statusIcon} 世界脉动：${statusText} · 综合 ${snapshot.overall}\n${dims}`;
}

/**
 * ② LLM 层：导演提示
 */
export function directorHints(snapshot) {
  if (!snapshot) return [];
  return snapshot.hints || [];
}

/**
 * ③ 系统层：告警列表
 */
export function systemAlerts(snapshot) {
  if (!snapshot) return [];
  return snapshot.alerts || [];
}

/**
 * LLM 注入用紧凑文本
 */
export function telemetryForLLM(snapshot) {
  if (!snapshot) return "";

  const dims = Object.entries(snapshot.dimensions || {})
    .map(([, d]) => {
      const trendStr = d.trend.delta > 0 ? `+${d.trend.delta}` : d.trend.delta < 0 ? `${d.trend.delta}` : "0";
      return `  ${d.name}: ${d.value} (${trendStr})${d.status !== "normal" ? " ⚠" : ""}`;
    })
    .join("\n");

  const hints = snapshot.hints?.length
    ? `\n导演倾向: ${snapshot.hints.join(", ")}`
    : "";

  return `【世界脉象】综合 ${snapshot.overall} · ${snapshot.overallStatus}\n${dims}${hints}`;
}

// ═══════════════════════════════════════════════════════════════
//  默认计算（无 LLM 配置时使用）
// ═══════════════════════════════════════════════════════════════

function calculateDefault(worldName, data, round) {
  const defaultDims = ["stability", "chaos", "mystery", "character_stress", "narrative_momentum"];
  const profile = {
    activeDimensions: defaultDims.map(id => {
      const d = DIMENSION_POOL.find(p => p.id === id);
      return { ...d, weight: d?.defaultWeight || 0.2 };
    }),
    customDimensions: []
  };

  // Register a per-world default profile so trend history never crosses worlds.
  const fallbackWorldName = worldName || "_default";
  TELEMETRY_STORE.profiles[fallbackWorldName] = profile;
  return calculateTelemetry(fallbackWorldName, round, data, {});
}

// ═══════════════════════════════════════════════════════════════
//  工具
// ═══════════════════════════════════════════════════════════════

function contributionValue(d = {}) {
  if (d.direction === "higher_is_worse") return 100 - (d.value || 0);
  if (d.direction === "neutral") return 50;
  return d.value || 0;
}

export function calculateWorldTelemetry({ model = {}, engineState = {}, directorResult = null, overlayPatch = null, round = 0, worldName = "" } = {}) {
  const resolvedWorldName = worldName || telemetryWorldName(model);
  const data = extractTelemetryData({ model, engineState, directorResult, overlayPatch });
  const snapshot = calculateTelemetry(resolvedWorldName, round || model.turnCount || 0, data, {});
  return { snapshot, data, worldName: resolvedWorldName };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getHistory(worldName, limit = 10) {
  return (TELEMETRY_STORE.history[worldName] || []).slice(-limit);
}

export function getProfile(worldName) {
  return TELEMETRY_STORE.profiles[worldName] || null;
}

export function resetTelemetry(worldName) {
  delete TELEMETRY_STORE.profiles[worldName];
  delete TELEMETRY_STORE.history[worldName];
}
