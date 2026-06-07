// ===== Director 层 v1 =====
// 叙事导演层：介于 prepareTurn 与 buildEnginePacket 之间
// 职责：情绪评估 → 叙事需求分析 → 事件评分 → 节奏控制 → 事件预测缓存
//
// 依赖：emotion-state.js, random-events.js (仅环境事件)

import { getEmotionProfile, updateEmotionState, getDefaultEmotionState, formatEmotionState } from "./emotion-state.js";
import { proposeRandomEvent } from "../data/random-events.js";
import { createDirectionPacket, normalizeDirectionPacket, summarizeDirectionPacket, PACING_OPTIONS, PRESSURE_OPTIONS, EVENT_INTENSITY_OPTIONS } from "./direction-packet.js";
import { getStoryteller, applyStorytellerModifiers, applyStorytellerPacing, storytellerStrategySummary } from "./storytellers.js";

// ═══════════════════════════════════════════════════════════════
//  事件预测缓存 — 延迟触发的"边缘事件"在后续轮次自然冒泡
// ═══════════════════════════════════════════════════════════════

const PREDICTION_CACHE = { events: [], maxSize: 5 };
let cacheIdCounter = 0;

/**
 * 将未触发但有潜力的事件存入缓存
 * @param {Object} assessment - calculateEventScore 的返回
 * @param {Object} eventTemplate - 事件对象（含 level/title/proposal）
 * @param {Object} context - { worldType, round, score, reason }
 */
export function cacheEventPrediction(assessment, eventTemplate = null, context = {}) {
  if (!assessment || assessment.method === "none") return;

  // 只缓存评分在 20-50 之间（接近触发但没够的）
  const score = assessment.score || 0;
  if (score < 20 || score > 50) return;

  // 避免重复缓存相似事件
  const sameType = PREDICTION_CACHE.events.find(
    (e) => e.type === assessment.type && e.status === "pending" && e.worldType === context.worldType
  );
  if (sameType) return; // 同类型已有待触发事件

  // 如果缓存已满，移除最旧的 pending 事件
  if (PREDICTION_CACHE.events.filter((e) => e.status === "pending").length >= PREDICTION_CACHE.maxSize) {
    const oldest = PREDICTION_CACHE.events
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.round - b.round)[0];
    if (oldest) oldest.status = "evicted";
  }

  const entry = {
    id: `cache-${++cacheIdCounter}`,
    createdAt: new Date().toISOString(),
    round: context.round || 0,
    score,
    type: assessment.type,
    event: eventTemplate || { level: assessment.type === "ambient" ? "light" : "moderate", title: "待定", proposal: "" },
    worldType: context.worldType || "daily",
    status: "pending",
    reason: assessment.reason || ""
  };
  PREDICTION_CACHE.events.push(entry);
}

/**
 * 检查缓存中有没有可以升级触发的事件
 * @param {Object} context - { emotion, proximity, round, sceneChanged }
 * @returns {{ promoted: boolean, event: Object|null, source: Object|null }}
 */
export function checkEventCache(context = {}) {
  const { emotion, proximity = [], round = 0, sceneChanged = false } = context;
  const pending = PREDICTION_CACHE.events.filter((e) => e.status === "pending");

  if (!pending.length) return { promoted: false, event: null, source: null };

  // 排序：按 score 从高到低 + 等待轮次加成
  for (const entry of pending) {
    const waitBonus = Math.min(15, (round - entry.round) * 3);
    entry.effectiveScore = entry.score + waitBonus;
  }
  pending.sort((a, b) => (b.effectiveScore || 0) - (a.effectiveScore || 0));

  const best = pending[0];
  const effectiveScore = best.effectiveScore || best.score;

  // 检查当前条件是否还匹配
  const coreChars = (proximity || []).filter((e) => e.proximity?.level === 0 && e.type === "character").length;

  // 条件恶化：无人可互动的事件，但场景中没有人
  if (best.type === "core" && coreChars === 0) {
    best.status = "stale";
    return { promoted: false, event: null, source: null };
  }

  // 升级判断
  if (effectiveScore >= 50 || (effectiveScore >= 35 && sceneChanged)) {
    best.status = "activated";
    const event = best.event;

    // 如果是 light 事件但等待了太久，升级到 moderate
    if (event.level === "light" && (round - best.round) >= 5) {
      event.level = "moderate";
      event.title = "中等事件（缓存升级）";
    }

    return {
      promoted: true,
      event: {
        ...event,
        marker: event.level === "major" ? "★" : event.level === "moderate" ? "◆" : "·",
        canIncorporate: event.level === "major",
        canBackground: event.level !== "light",
        cached: true,
        cacheId: best.id,
        promotedAt: new Date().toISOString()
      },
      source: best
    };
  }

  // 超时淘汰
  if (round - best.round > 10) {
    best.status = "expired";
  }

  // 这个 entry 保留缓存，下次再评估
  return { promoted: false, event: null, source: null };
}

/**
 * 清理过期缓存
 * @param {number} currentRound
 * @param {number} ttl - 缓存存活轮数上限
 */
export function pruneEventCache(currentRound = 0, ttl = 8) {
  const before = PREDICTION_CACHE.events.length;
  PREDICTION_CACHE.events = PREDICTION_CACHE.events.filter((e) => {
    if (e.status === "activated" || e.status === "evicted") return false;
    if (currentRound - e.round > ttl) {
      e.status = "expired";
      return false;
    }
    return true;
  });
  return { removed: before - PREDICTION_CACHE.events.length, remaining: PREDICTION_CACHE.events.length };
}

/** 获取完整缓存状态（调试用） */
export function getEventCache() {
  return {
    size: PREDICTION_CACHE.events.length,
    maxSize: PREDICTION_CACHE.maxSize,
    pending: PREDICTION_CACHE.events.filter((e) => e.status === "pending").length,
    events: PREDICTION_CACHE.events.map((e) => ({
      id: e.id, score: e.score, type: e.type, status: e.status,
      level: e.event?.level, round: e.round,
      waitRounds: e.waitRounds
    }))
  };
}

/** 重置预测缓存（切换模组/存档时调用） */
export function resetPredictionCache() {
  PREDICTION_CACHE.events = [];
  cacheIdCounter = 0;
}

// ═══════════════════════════════════════════════════════════════
//  事件评分系统（替代原有的纯概率判定）
// ═══════════════════════════════════════════════════════════════

/**
 * 评估当前叙事状态下某类事件的"适合度"分数
 * @param {Object} context - { worldType, round, proximity, emotion, plotState, sceneChanged }
 * @returns {{ score: number, method: "judgment"|"probability", reason: string[], type: "core"|"ambient"|"both" }}
 */
export function calculateEventScore(context = {}) {
  const { emotion = getDefaultEmotionState(), proximity = [], round = 0, sceneChanged = false, plotState = {} } = context;
  const scores = { core: 0, ambient: 0 };
  const reasons = [];

  // ---- 核心事件评分（剧情驱动型） ----

  // ① 角色在场度：核心环角色越多，越适合触发核心事件
  const coreChars = (proximity || []).filter((e) => e.proximity?.level === 0 && e.type === "character").length;
  if (coreChars >= 2) scores.core += 20;
  else if (coreChars === 1) scores.core += 10;
  reasons.push(`角色在场: ${coreChars}人 → +${coreChars >= 2 ? 20 : coreChars === 1 ? 10 : 0}`);

  // ② 情绪张力：紧张+投入 → 适合核心事件
  const tension = emotion.tension || 5;
  const engagement = emotion.engagement || 5;
  const tensionScore = (tension - 5) * 5;
  scores.core += Math.max(0, tensionScore);
  if (tension > 6) reasons.push(`高张力(t=${tension}) → +${tensionScore}`);

  // ③ 好奇心：好奇高 → 适合抛出信息型事件
  const curiosity = emotion.curiosity || 5;
  if (curiosity >= 7) { scores.core += 10; reasons.push(`高好奇(c=${curiosity}) → +10`); }

  // ④ 冷却期：距离上次事件越久，权重越高
  const roundsSinceLast = (round || 0) - (context.lastEventRound || 0);
  const cooldownBonus = Math.min(15, roundsSinceLast * 3);
  if (roundsSinceLast > 0) { scores.core += cooldownBonus; reasons.push(`冷却期: ${roundsSinceLast}轮 → +${cooldownBonus}`); }

  // ⑤ 场景变化：新场景天然适合触发新事件
  if (sceneChanged) { scores.core += 10; reasons.push("场景变化 → +10"); }

  // ⑥ 疲劳度调节：疲劳过高时降低核心事件得分
  const fatigue = emotion.fatigue || 5;
  if (fatigue >= 7) { scores.core = Math.max(0, scores.core - 15); reasons.push(`高疲劳(f=${fatigue}) → -15 (核心事件降权)`); }

  // ---- 环境事件评分（氛围型） ----

  // ① 疲劳/低压 → 适合轻松调剂
  if (fatigue >= 6 || tension <= 3) { scores.ambient += 25; reasons.push("疲劳/低压 → 环境事件+25"); }

  // ② 好奇心低 → 推进式事件
  if (curiosity <= 3) { scores.ambient += 10; reasons.push("低好奇 → 环境事件+10"); }

  // ③ 角色少 → 更适合环境事件
  if (coreChars === 0) { scores.ambient += 20; reasons.push("无核心角色 → 环境事件+20"); }

  // ④ 随机波动（避免完全确定性）
  scores.ambient += Math.random() * 10;

  // ---- 综合决策 ----
  const method = scores.core > 50 ? "judgment" : (scores.core > 25 || scores.ambient > 30) ? "probability" : "none";
  const eventType = scores.core > scores.ambient ? "core" : "ambient";

  return {
    score: Math.max(scores.core, scores.ambient),
    method,
    type: eventType,
    coreScore: scores.core,
    ambientScore: scores.ambient,
    reason: reasons.join("; ")
  };
}

/**
 * 判断是否应该触发事件
 * @param {{ score: number, method: string, type: string }} assessment
 * @param {Object} context
 * @returns {{ trigger: boolean, method: string, event: Object|null }}
 */
export function shouldTriggerEvent(assessment, context = {}) {
  if (!assessment || assessment.method === "none") {
    return { trigger: false, method: "none", event: null };
  }

  if (assessment.method === "judgment") {
    // 计分制：分数够高就触发，不用概率
    return {
      trigger: true,
      method: "judgment",
      event: proposeRandomEvent({
        ...context,
        forceLevel: assessment.type === "ambient" ? "light" : null,
        forceScore: assessment.score
      })
    };
  }

  // 概率制：以分数/100 作为概率权重
  const weight = (assessment.score || 0) / 100;
  if (Math.random() < weight) {
    return {
      trigger: true,
      method: "probability",
      probability: weight,
      event: proposeRandomEvent({
        ...context,
        forceLevel: assessment.type === "ambient" ? "light" : null
      })
    };
  }

  return { trigger: false, method: "probability_miss", event: null };
}

// ═══════════════════════════════════════════════════════════════
//  节奏分析
// ═══════════════════════════════════════════════════════════════

export function analyzePacing(emotion, round = 0, lastEventRound = 0) {
  const { engagement, tension, fatigue } = emotion || getDefaultEmotionState();
  const advices = [];

  // 节奏过紧：高张力+高投入+高疲劳
  if (tension >= 7 && fatigue >= 5 && engagement >= 6) {
    advices.push({
      signal: "节奏过紧",
      severity: "advise",
      advice: "连续高张力，建议插入一段温和的日常互动或环境描写来释放压力，然后再推主线。"
    });
  }

  // 节奏过松：低张力+低好奇+低投入
  if (tension <= 3 && engagement <= 4 && fatigue <= 4) {
    advices.push({
      signal: "节奏过松",
      severity: "advise",
      advice: "叙事节奏偏平，可考虑放入一个轻量悬念或角色小互动来提升张力。"
    });
  }

  // 疲劳预警
  if (fatigue >= 7) {
    advices.push({
      signal: "玩家疲劳",
      severity: "warning",
      advice: "玩家疲劳度较高，本轮避免重大事件和复杂信息，以轻松、简洁、角色互动为主。"
    });
  }

  // 最佳窗口期
  if (engagement >= 7 && curiosity >= 6 && fatigue <= 5) {
    advices.push({
      signal: "最佳窗口",
      severity: "signal",
      advice: "玩家处于高投入+高好奇状态，适合推进关键剧情或深入角色互动。趁这个机会抛出重要信息。"
    });
  }

  // 冷却不足
  const roundsSinceLast = round - (lastEventRound || 0);
  if (roundsSinceLast < 3 && roundsSinceLast > 0) {
    advices.push({
      signal: "事件冷却",
      severity: "info",
      advice: `上次事件仅过去 ${roundsSinceLast} 轮，建议本轮聚焦角色互动而非新事件。已阻止新事件触发以保护叙事沉浸。`
    });
  }

  return {
    tempo: advices.length === 0 ? "normal" : advices.some(a => a.severity === "warning") ? "tense" : advices[0]?.signal || "normal",
    advices,
    // 关键标志
    blockNewEvents: advices.some(a => a.signal === "事件冷却" || a.signal === "玩家疲劳"),
    preferCharacterInteraction: advices.some(a => a.signal === "玩家疲劳" || a.signal === "节奏过紧")
  };
}

// ═══════════════════════════════════════════════════════════════
//  导演层主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 导演层评估主入口
 * @param {Object} opts
 * @param {Object} opts.emotionState - 当前玩家情绪状态
 * @param {Object} opts.input - 用户输入分析
 * @param {Array} opts.proximityEntities - 邻近环实体列表
 * @param {number} opts.round - 当前轮次
 * @param {boolean} opts.sceneChanged - 本轮是否场景变换
 * @param {Object} opts.plotState - 剧情状态（可选）
 * @returns {Object} { emotionProfile, eventAssessment, pacing, emotionAdvice }
 */
export function directNarrative(opts = {}) {
  const {
    emotionState,
    input = "",
    proximityEntities = [],
    round = 0,
    sceneChanged = false,
    plotState = {},
    lastEventRound = 0
  } = opts;

  // 1. 更新情绪状态
  const updatedEmotion = updateEmotionState(emotionState, { input, turnCount: round, sceneChanged });
  const emotionProfile = getEmotionProfile(updatedEmotion);

  // 2. 评估叙事节奏
  const pacing = analyzePacing(updatedEmotion, round, lastEventRound);

  // 2.5 检查事件预测缓存（优先于新事件评估）
  const cacheContext = { emotion: updatedEmotion, proximity: proximityEntities, round, sceneChanged };
  const cacheResult = checkEventCache(cacheContext);

  let assessment, triggerResult;

  if (cacheResult.promoted) {
    // 缓存有可升级的事件 → 直接用
    assessment = {
      score: cacheResult.source?.effectiveScore || 60,
      method: "cache_promotion",
      type: cacheResult.source?.type || "ambient",
      coreScore: 0,
      ambientScore: 0,
      reason: `缓存升级: ${cacheResult.source?.reason || ""}`
    };
    triggerResult = {
      trigger: true,
      method: "cache_promotion",
      event: cacheResult.event,
      cacheId: cacheResult.source?.id
    };
  } else if (pacing.blockNewEvents) {
    // 节奏阻止新事件
    assessment = calculateEventScore({
      emotion: updatedEmotion, proximity: proximityEntities,
      round, sceneChanged, plotState, lastEventRound
    });
    triggerResult = { trigger: false, method: "pacing_blocked", event: null };

    // 边界分（20-50）的未触发事件→缓存，等后续轮次自然冒泡
    if (assessment.score >= 20 && assessment.score <= 50) {
      cacheEventPrediction(assessment, proposeRandomEvent({
        round, sceneChanged, worldType: opts.worldType || "daily",
        forceLevel: assessment.type === "ambient" ? "light" : "moderate"
      }), { round, worldType: opts.worldType || "daily" });
    }
  } else {
    // 正常评估
    assessment = calculateEventScore({
      emotion: updatedEmotion, proximity: proximityEntities,
      round, sceneChanged, plotState, lastEventRound
    });
    triggerResult = shouldTriggerEvent(assessment, { round, sceneChanged, worldType: opts.worldType || "daily" });

    // 边缘分（20-50）但未触发→缓存
    if (!triggerResult.trigger && assessment.score >= 20 && assessment.score <= 50) {
      cacheEventPrediction(assessment, triggerResult.event || proposeRandomEvent({
        round, sceneChanged, worldType: opts.worldType || "daily",
        forceLevel: assessment.type === "ambient" ? "light" : "moderate"
      }), { round, worldType: opts.worldType || "daily" });
    }
  }

  // 清理过期缓存
  pruneEventCache(round);

  // 3. 缓存状态信息
  const cacheInfo = getEventCache();

  // 4. 整合返回
  return {
    emotion: {
      state: updatedEmotion,
      profile: emotionProfile,
      formatted: formatEmotionState(updatedEmotion)
    },
    event: {
      assessment,
      trigger: triggerResult
    },
    pacing,
    cache: cacheInfo,
    // 给 LLM prompt 注入的叙事建议
    narrativeAdvice: [
      ...emotionProfile.advice,
      ...pacing.advices.map(a => a.advice),
      triggerResult.trigger
        ? `检测到事件触发契机（${triggerResult.method}模式，type=${assessment.type}）`
        : (cacheInfo.pending > 0
          ? `缓存中有 ${cacheInfo.pending} 个待触发事件等待合适时机自动冒泡。`
          : ""),
      cacheResult.promoted
        ? `（此轮事件来自缓存升级——边缘事件等待 ${round - (cacheResult.source?.round || round)} 轮后自然冒泡触发）`
        : ""
    ].filter(Boolean)
  };
}

// ═══════════════════════════════════════════════════════════════
//  方向包生成 — 将 Director 分析结果打包为结构化方向包
//  当前为纯 JS 实现（LLM 决策层将在 Phase 7 接入）
// ═══════════════════════════════════════════════════════════════

/**
 * 生成 Narrative Direction Packet
 * @param {Object} opts - 同 directNarrative()
 * @param {Object} [opts.existingResult] - 可选的已计算 results（避免重复计算）
 * @returns {Object} { packet, summary, result }
 */
export function generateDirectionPacket(opts = {}) {
  const {
    emotionState,
    input = "",
    proximityEntities = [],
    round = 0,
    sceneChanged = false,
    plotState = {},
    lastEventRound = 0,
    worldType = "daily",
    existingResult = null,
    moduleData = {},
    llmAnalysis = null,    // 🆕 LLM 输入分析（可选）
    worldSubType = "classic",  // 🆕 classic | tabletop | rpg | sim | murder-mystery
    storytellerId = "classic",  // 🆕 叙事者风格
    telemetrySnapshot = null,
    telemetryHints = []
  } = opts;

  // 🆕 加载叙事者配置
  const storyteller = getStoryteller(storytellerId);

  // 复用或重新计算 Director 结果
  const result = existingResult || directNarrative({
    emotionState, input, proximityEntities,
    round, sceneChanged, plotState, lastEventRound, worldType
  });

  const emotion = result.emotion;
  const pacing = result.pacing;
  const event = result.event;
  const cache = result.cache;

  // — 混合模式：LLM 理解 + JS 守卫 —
  //
  //   LLM 负责：理解语义（intent、情绪弦外音、叙事节奏建议）
  //   JS 负责：冷却检查、疲劳降权、事件评分、缓存管理、长度约束
  //   LLM 的建议通过 JS 守卫才能写入最终方向包

  const text = String(input || "");
  const profile = emotion.profile;
  const dominant = profile.dominant.length ? profile.dominant[0] : "neutral";

  // ① intent：LLM 理解优先，JS 正则兜底
  let intent = "narrative";
  if (llmAnalysis?.intent) {
    intent = llmAnalysis.intent;
  } else {
    if (/[？?]/.test(text)) intent = "question";
    else if (/^(我|他|她|我们)/.test(text.trim())) intent = "action";
    else if (/^(好|行|嗯|哦|啊|走吧|继续)/.test(text.trim()) && text.length < 20) intent = "acknowledgment";
    else if (/为什么|怎么回事|难道/.test(text)) intent = "inquiry";
  }

  // ② 情绪更新：JS 的数字是基准，LLM 的 delta 作为微调
  if (llmAnalysis?.engagementDelta != null) {
    emotion.state.engagement = Math.max(0, Math.min(10, emotion.state.engagement + llmAnalysis.engagementDelta));
  }
  if (llmAnalysis?.tensionDelta != null) {
    emotion.state.tension = Math.max(0, Math.min(10, emotion.state.tension + llmAnalysis.tensionDelta));
  }
  if (llmAnalysis?.curiosityDelta != null) {
    emotion.state.curiosity = Math.max(0, Math.min(10, emotion.state.curiosity + llmAnalysis.curiosityDelta));
  }
  if (llmAnalysis?.fatigueDelta != null) {
    emotion.state.fatigue = Math.max(0, Math.min(10, emotion.state.fatigue + llmAnalysis.fatigueDelta));
  }

  // ③ pacing：疲劳保护 → 叙事者节奏 → LLM 建议 → JS 兜底
  let chosenPacing = "hold";
  const signal = pacing.advices?.[0]?.signal || "normal";
  const pacingMap = {
    "节奏过紧": "relief", "节奏过松": "hook", "最佳窗口": "escalate",
    "玩家疲劳": "relief", "事件冷却": "hold",
    "normal": event.trigger.trigger ? "escalate" : "hold"
  };
  if (pacing.blockNewEvents) {
    chosenPacing = "relief"; // JS 守卫：冷却/疲劳时强制 relief
  } else if (llmAnalysis?.pacingSuggestion && PACING_OPTIONS.includes(llmAnalysis.pacingSuggestion)) {
    chosenPacing = llmAnalysis.pacingSuggestion;
  } else {
    // 🆕 叙事者节奏倾向
    chosenPacing = applyStorytellerPacing(storyteller, emotion.state) || pacingMap[signal] || "hold";
  }

  // ④ pressure：LLM 建议优先，JS 紧张度映射兜底
  const t = emotion.state.tension || 5;
  let chosenPressure = t >= 8 ? "high" : t >= 6 ? "medium" : t <= 3 ? "low" : "medium";
  if (llmAnalysis?.pressureSuggestion && PRESSURE_OPTIONS.includes(llmAnalysis.pressureSuggestion)) {
    chosenPressure = llmAnalysis.pressureSuggestion;
  }

  // World Telemetry closes the loop: KPI readings change current-turn strategy.
  const telemetryDims = telemetrySnapshot?.dimensions || {};
  const telemetryHintSet = new Set([...(telemetrySnapshot?.hints || []), ...(telemetryHints || [])]);
  if ((telemetryDims.character_stress?.value || 0) >= 75 || telemetryHintSet.has("provide_relief")) {
    chosenPacing = "relief";
    chosenPressure = "low";
  } else if ((telemetryDims.war_risk?.value || 0) >= 70 || telemetryHintSet.has("increase_tension")) {
    if (!pacing.blockNewEvents) {
      chosenPacing = "escalate";
      chosenPressure = chosenPressure === "low" ? "medium" : chosenPressure;
    }
  } else if ((telemetryDims.mystery?.value || 0) >= 70 || telemetryHintSet.has("resolve_foreshadowing")) {
    chosenPacing = "reveal_partial";
  } else if ((telemetryDims.memory_load?.value || 0) >= 80 || telemetryHintSet.has("compress_context")) {
    chosenPacing = "simplify";
  }

  // ⑤ eventIntensity：JS 事件触发状态为准，LLM 不下调已触发事件
  let chosenIntensity = event.trigger.trigger
    ? (event.trigger.event?.level === "major" ? "major"
      : event.trigger.event?.level === "moderate" ? "moderate" : "light")
    : "none";
  if (!event.trigger.trigger && llmAnalysis?.eventIntensitySuggestion &&
      EVENT_INTENSITY_OPTIONS.includes(llmAnalysis.eventIntensitySuggestion)) {
    chosenIntensity = llmAnalysis.eventIntensitySuggestion;
  }

  // ⑥ emotionalTarget：JS 基准 + LLM 补充
  const increase = [];
  const decrease = [];
  const hold = [];
  if (emotion.state.engagement < 5) increase.push("engagement"); else hold.push("engagement");
  if (emotion.state.tension < 3) increase.push("tension");
  else if (emotion.state.tension > 7) decrease.push("tension"); else hold.push("tension");
  if (emotion.state.fatigue > 6) decrease.push("fatigue");
  if (emotion.state.curiosity < 4) increase.push("curiosity");
  // LLM 补充（不替换，只追加）
  if (llmAnalysis?.emotionalTarget?.increase) {
    for (const e of llmAnalysis.emotionalTarget.increase) {
      if (!increase.includes(e)) increase.push(e);
    }
  }
  if (llmAnalysis?.emotionalTarget?.decrease) {
    for (const e of llmAnalysis.emotionalTarget.decrease) {
      if (!decrease.includes(e)) decrease.push(e);
    }
  }

  // ⑦ sceneGoal：LLM 优先
  let sceneGoal = sceneChanged ? "熟悉新场景，建立环境感知" : "推进当前互动，保持叙事节奏";
  if (llmAnalysis?.sceneGoal) sceneGoal = llmAnalysis.sceneGoal;

  // ⑧ mustInclude/mustNotInclude：LLM 建议经过 JS 守卫过滤
  let mustInclude = [];
  let mustNotInclude = [];

  // JS 守卫规则（始终生效，无论是否使用 LLM）
  if (result.event.trigger.trigger) {
    mustInclude.push(`回应/融入事件: ${result.event.trigger.event?.title || ""}`);
  }
  if (sceneChanged) mustInclude.push("描述新场景的环境和氛围");
  if (emotion.state.fatigue >= 7) {
    mustNotInclude.push("引入新危机、新敌人、复杂信息");
    mustNotInclude.push("需要深度思考的复杂情节");
  }
  if (chosenPacing === "relief") mustNotInclude.push("大幅提升紧张感的新事件");
  if (telemetryHintSet.has("provide_relief")) mustInclude.push("安排短暂喘息或低压互动，让角色压力回落");
  if (telemetryHintSet.has("surface_faction_pressure")) mustInclude.push("自然露出阵营紧张的迹象，但不要直接创造未经确认的战争事实");
  if (telemetryHintSet.has("resolve_foreshadowing")) mustInclude.push("回收或部分揭示一个已有伏笔，避免继续堆叠新谜团");
  if (telemetryHintSet.has("compress_context")) mustNotInclude.push("引入大量新设定、新角色或复杂背景信息");
  if (emotion.state.fatigue < 5 && emotion.state.curiosity >= 6) {
    mustInclude.push("回应玩家好奇心，给出有价值的线索或信息");
  }

  // LLM 建议（通过 JS 守卫后采纳）
  if (llmAnalysis?.suggestedMustInclude) {
    for (const item of llmAnalysis.suggestedMustInclude) {
      // JS 守卫：检查不与 mustNotInclude 冲突
      const conflicts = mustNotInclude.some((n) =>
        item.includes(n.replace(/^.+?[:：]?\s*/, "").slice(0, 4))
      );
      if (!conflicts && !mustInclude.includes(item)) {
        mustInclude.push(item);
      }
    }
  }
  if (llmAnalysis?.suggestedMustNotInclude) {
    for (const item of llmAnalysis.suggestedMustNotInclude) {
      if (!mustNotInclude.includes(item)) mustNotInclude.push(item);
    }
  }

  // ⑨ 情绪备注：LLM 的弦外音优先
  const notes = llmAnalysis?.emotionalSubtext || profile.advice[0] || "";

  // 推断写作约束
  const lengthMap = { "节奏过紧": "short", "节奏过松": "medium", "玩家疲劳": "short" };
  const chosenLength = lengthMap[signal] || "medium";
  const endWith = result.event.trigger.trigger ? "让玩家选择是否回应新事件" : "自然收束，留一个可互动的点";
  const choices = result.event.trigger.trigger ? "optional_2_to_3" : "none";

  // — 打包 —
  const packet = createDirectionPacket(`turn-${round}`, "worldbook", worldSubType);
  packet.playerAnalysis = {
    intent,
    engagement: emotion.state.engagement,
    tension: emotion.state.tension,
    fatigue: emotion.state.fatigue,
    curiosity: emotion.state.curiosity,
    dominant,
    notes   // 🆕 混合模式：LLM 弦外音优先，JS 兜底
  };
  packet.storyState = {
    currentScene: moduleData?.scenes?.[0]?.title || "",
    currentConflict: moduleData?.plotState?.conflict || "",
    openThreads: moduleData?.tracking?.filter(t => t.name === "foreshadowing").flatMap(t => t.items || []) || [],
    resolvedThreads: moduleData?.tracking?.filter(t => t.name === "resolved").flatMap(t => t.items || []) || [],
    activeCharacters: moduleData?.characters?.slice(0, 8).map(c => c.name) || [],
    relevantMemories: (result._relevantMemories || []).map(m => m.id || m.summary?.slice(0, 60) || "")
  };
  packet.directorDecision = {
    pacing: chosenPacing,
    pressure: chosenPressure,
    eventIntensity: chosenIntensity,
    sceneGoal: sceneChanged ? "熟悉新场景，建立环境感知" : "推进当前互动，保持叙事节奏",
    emotionalTarget: { increase, decrease, hold }
  };
  packet.contentPlan = {
    mustInclude,
    mayInclude: [],
    mustNotInclude
  };
  packet.writingConstraints = {
    style: "",
    length: chosenLength,
    perspective: "third_person",
    endWith,
    choices
  };
  packet.stateUpdatesExpected = {
    newClues: [],
    relationshipChanges: [],
    sceneStateChanges: sceneChanged ? ["场景切换"] : [],
    memoryCandidates: [emotion.state.engagement >= 5 ? "本轮可能有重要互动" : ""].filter(Boolean)
  };
  packet.debug = {
    source: "director",
    version: "1.0",
    confidence: result.event.trigger.trigger ? 0.7 : 0.5,
    warnings: pacing.advices.filter(a => a.severity === "warning").map(a => a.advice),
    storyteller: storytellerId,
    telemetry: telemetrySnapshot ? {
      overall: telemetrySnapshot.overall,
      status: telemetrySnapshot.overallStatus,
      hints: telemetrySnapshot.hints || []
    } : null  // 🆕 叙事者标记
  };

  return {
    packet: normalizeDirectionPacket(packet),
    summary: summarizeDirectionPacket(packet),
    result: {
      ...result,
      telemetry: telemetrySnapshot ? {
        snapshot: telemetrySnapshot,
        hints: telemetrySnapshot.hints || []
      } : null
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  情绪标记段解析（从 LLM 输出解析【情绪】标记）
// ═══════════════════════════════════════════════════════════════

/**
 * 从 LLM 输出的 sections 中解析【情绪】标记
 * @param {Object} sections - 解析后的标记段
 * @returns {Object|null} 情绪更新建议
 */
export function parseEmotionSection(sections = {}) {
  const emotionRaw = sections["情绪"];
  if (!emotionRaw) return null;

  // 期望格式：player: engagement=6, tension=4, fatigue=5, curiosity=7
  // 或纯文本建议
  const lines = String(emotionRaw || "").split("\n").map(l => l.trim()).filter(Boolean);
  const result = {};
  for (const line of lines) {
    // 尝试解析 player: engagement=6, tension=4 格式
    const match = line.match(/player:\s*(.+)/i);
    if (match) {
      const pairs = match[1].split(",").map(s => s.trim());
      for (const pair of pairs) {
        const [key, val] = pair.split("=").map(s => s.trim());
        if (["engagement", "tension", "fatigue", "curiosity"].includes(key)) {
          result[key] = parseFloat(val);
        }
      }
    }
  }
  return Object.keys(result).length ? result : null;
}

