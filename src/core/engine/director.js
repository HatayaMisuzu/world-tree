// ===== Director 层 v1 =====
// 叙事导演层：介于 prepareTurn 与 buildEnginePacket 之间
// 职责：情绪评估 → 叙事需求分析 → 事件评分 → 节奏控制 → 事件预测缓存
// 依赖：emotion-state.js；子模块 director-prediction-cache / director-story-hooks / director-scoring

import { getEmotionProfile, updateEmotionState, formatEmotionState } from "./emotion-state.js";
import { deriveRng } from "../../shared/determinism.js";
import { createDirectionPacket, normalizeDirectionPacket, summarizeDirectionPacket, PACING_OPTIONS, PRESSURE_OPTIONS, EVENT_INTENSITY_OPTIONS } from "./direction-packet.js";
import { getStoryteller, applyStorytellerPacing } from "./storytellers.js";
import { cacheEventPrediction, checkEventCache, pruneEventCache, getEventCache } from "./director-prediction-cache.js";
import { collectStoryHooks, recordDirectorDecision, selectHookEvent, lastTriggeredRound } from "./director-story-hooks.js";
import { calculateEventScore, shouldTriggerEvent, analyzePacing } from "./director-scoring.js";
// 子模块的公开 API 继续从 director.js 导出（调用方不变）
export { exportPredictionStores, importPredictionStores, clearPredictionStore, cacheEventPrediction, checkEventCache, pruneEventCache, getEventCache, resetPredictionCache } from "./director-prediction-cache.js";
export { collectStoryHooks, lastTriggeredRound, exportDirectorLog, importDirectorLog, resetDirectorLog, getDirectorDecisions, selectHookEvent } from "./director-story-hooks.js";
export { calculateEventScore, shouldTriggerEvent, analyzePacing } from "./director-scoring.js";

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
    plotState = {}, lastEventRound: givenLastEventRound = 0, worldSeed = "world-tree", moduleData = null
  } = opts;
  // 冷却起点：调用方传入值与决策日志里最近一次触发取较大者（主管线此前总传 0，冷却从不生效）
  const lastEventRound = Math.max(givenLastEventRound || 0, lastTriggeredRound(round) ?? 0);
  const storyHooks = Array.isArray(opts.storyHooks) ? opts.storyHooks : collectStoryHooks(moduleData || {});

  // 1. 更新情绪状态
  const updatedEmotion = updateEmotionState(emotionState, { input, turnCount: round, sceneChanged });
  const emotionProfile = getEmotionProfile(updatedEmotion);

  // 2. 评估叙事节奏
  const pacing = analyzePacing(updatedEmotion, round, lastEventRound);

  // 2.5 检查事件预测缓存（优先于新事件评估）
  const cacheContext = { emotion: updatedEmotion, proximity: proximityEntities, round, sceneChanged, storyHooks };
  // 冷却期内缓存也不升级（冷却 = 本轮不出新事件）；缓存条目保留到冷却结束
  const cooling = pacing.advices.some(a => a.signal === "事件冷却");
  const cacheResult = cooling ? { promoted: false } : checkEventCache(cacheContext);

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
      round, sceneChanged, plotState, lastEventRound, worldSeed
    });
    triggerResult = { trigger: false, method: "pacing_blocked", event: null };

    // 边界分（20-50）的未触发事件→缓存，等后续轮次自然冒泡
    const hookEvent = selectHookEvent(storyHooks, { round, worldSeed, forceLevel: assessment.type === "ambient" ? "light" : "moderate" });
    if (hookEvent && assessment.score >= 20 && assessment.score <= 50) {
      cacheEventPrediction(assessment, hookEvent, { round, worldType: opts.worldType || "daily" });
    }
  } else {
    // 正常评估
    assessment = calculateEventScore({
      emotion: updatedEmotion, proximity: proximityEntities,
      round, sceneChanged, plotState, lastEventRound, worldSeed
    });
    triggerResult = shouldTriggerEvent(assessment, { round, sceneChanged, worldType: opts.worldType || "daily", worldSeed, storyHooks });

    // 边缘分（20-50）但未触发→缓存
    const hookEvent = !triggerResult.trigger && selectHookEvent(storyHooks, { round, worldSeed, forceLevel: assessment.type === "ambient" ? "light" : "moderate" });
    if (hookEvent && assessment.score >= 20 && assessment.score <= 50) {
      cacheEventPrediction(assessment, hookEvent, { round, worldType: opts.worldType || "daily" });
    }
  }

  // 清理过期缓存
  pruneEventCache(round);

  // 决策进入世界状态（engineSnapshot.director），供存档/读档与确定性哈希覆盖
  recordDirectorDecision({
    round,
    trigger: Boolean(triggerResult.trigger),
    method: triggerResult.method,
    hookId: triggerResult.event?.hookId || null,
    level: triggerResult.trigger ? (triggerResult.event?.level || null) : null,
    title: triggerResult.trigger ? (triggerResult.event?.title || null) : null,
    hooksAvailable: storyHooks.length,
    score: Math.round((assessment?.score || 0) * 1000) / 1000
  });

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
    telemetryHints = [], worldSeed = "world-tree"
  } = opts;

  // 🆕 加载叙事者配置
  const storyteller = getStoryteller(storytellerId);

  // 复用或重新计算 Director 结果
  const result = existingResult || directNarrative({
    emotionState, input, proximityEntities,
    round, sceneChanged, plotState, lastEventRound, worldType, worldSeed, moduleData
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
    chosenPacing = applyStorytellerPacing(storyteller, emotion.state, deriveRng(worldSeed, round, "storyteller.pacing")) || pacingMap[signal] || "hold";
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
