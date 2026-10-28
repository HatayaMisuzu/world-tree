// Director 子模块：事件评分、触发判定与节奏分析。
// 由 director.js 拆出，行为不变；director.js 会重新导出。

import { getDefaultEmotionState } from "./emotion-state.js";
import { rngFrom } from "../../shared/determinism.js";
import { EVENT_SCORE, PACING_THRESHOLDS } from "./constants.js";
import { selectHookEvent } from "./director-story-hooks.js";

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
  if (coreChars >= 2) scores.core += EVENT_SCORE.CORE_CHARS_2PLUS;
  else if (coreChars === 1) scores.core += EVENT_SCORE.CORE_CHARS_1;
  reasons.push(`角色在场: ${coreChars}人 → +${coreChars >= 2 ? EVENT_SCORE.CORE_CHARS_2PLUS : coreChars === 1 ? EVENT_SCORE.CORE_CHARS_1 : 0}`);

  // ② 情绪张力：紧张+投入 → 适合核心事件
  const tension = emotion.tension || 5;
  const engagement = emotion.engagement || 5;
  const tensionScore = (tension - 5) * EVENT_SCORE.TENSION_PER_POINT;
  scores.core += Math.max(0, tensionScore);
  if (tension > EVENT_SCORE.HIGH_TENSION_THRESHOLD) reasons.push(`高张力(t=${tension}) → +${tensionScore}`);

  // ③ 好奇心：好奇高 → 适合抛出信息型事件
  const curiosity = emotion.curiosity || 5;
  if (curiosity >= EVENT_SCORE.HIGH_CURIOSITY) { scores.core += EVENT_SCORE.HIGH_CURIOSITY_BONUS; reasons.push(`高好奇(c=${curiosity}) → +${EVENT_SCORE.HIGH_CURIOSITY_BONUS}`); }

  // ④ 冷却期：距离上次事件越久，权重越高
  const roundsSinceLast = (round || 0) - (context.lastEventRound || 0);
  const cooldownBonus = Math.min(EVENT_SCORE.COOLDOWN_MAX, roundsSinceLast * EVENT_SCORE.COOLDOWN_MULTIPLIER);
  if (roundsSinceLast > 0) { scores.core += cooldownBonus; reasons.push(`冷却期: ${roundsSinceLast}轮 → +${cooldownBonus}`); }

  // ⑤ 场景变化：新场景天然适合触发新事件
  if (sceneChanged) { scores.core += EVENT_SCORE.SCENE_CHANGE_BONUS; reasons.push(`场景变化 → +${EVENT_SCORE.SCENE_CHANGE_BONUS}`); }

  // ⑥ 疲劳度调节：疲劳过高时降低核心事件得分
  const fatigue = emotion.fatigue || 5;
  if (fatigue >= EVENT_SCORE.HIGH_FATIGUE_THRESHOLD) { scores.core = Math.max(0, scores.core - EVENT_SCORE.HIGH_FATIGUE_PENALTY); reasons.push(`高疲劳(f=${fatigue}) → -${EVENT_SCORE.HIGH_FATIGUE_PENALTY} (核心事件降权)`); }

  // ---- 环境事件评分（氛围型） ----

  // ① 疲劳/低压 → 适合轻松调剂
  if (fatigue >= EVENT_SCORE.HIGH_FATIGUE_THRESHOLD - 1 || tension <= PACING_THRESHOLDS.LOOSE_TENSION_MAX) { scores.ambient += EVENT_SCORE.AMBIENT_LOW_TENSION_BONUS; reasons.push(`疲劳/低压 → 环境事件+${EVENT_SCORE.AMBIENT_LOW_TENSION_BONUS}`); }

  // ② 好奇心低 → 推进式事件
  if (curiosity <= PACING_THRESHOLDS.LOOSE_TENSION_MAX) { scores.ambient += EVENT_SCORE.AMBIENT_LOW_CURIOSITY_BONUS; reasons.push(`低好奇 → 环境事件+${EVENT_SCORE.AMBIENT_LOW_CURIOSITY_BONUS}`); }

  // ③ 角色少 → 更适合环境事件
  if (coreChars === 0) { scores.ambient += EVENT_SCORE.AMBIENT_NO_CORE_CHARS_BONUS; reasons.push(`无核心角色 → 环境事件+${EVENT_SCORE.AMBIENT_NO_CORE_CHARS_BONUS}`); }

  // ④ 随机波动（避免完全确定性）
  scores.ambient += rngFrom(context.rng, context.worldSeed ?? "world-tree", round || 0, "director.ambient").next() * EVENT_SCORE.AMBIENT_RANDOM_MAX;

  // ---- 综合决策 ----
  const method = scores.core > EVENT_SCORE.JUDGMENT_SCORE_THRESHOLD ? "judgment" : (scores.core > EVENT_SCORE.PROBABILITY_SCORE_THRESHOLD || scores.ambient > EVENT_SCORE.AMBIENT_PROBABILITY_THRESHOLD) ? "probability" : "none";
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
  // 方案 A：没有已有线索/动机可引出 → 不触发（节奏/情绪分再高也不凭空制造冲突）
  const hooks = Array.isArray(context.storyHooks) ? context.storyHooks : [];
  if (!hooks.length) return { trigger: false, method: "no_grounded_hook", event: null };

  if (assessment.method === "judgment") {
    // 计分制：分数够高就触发，不用概率
    return {
      trigger: true,
      method: "judgment",
      event: selectHookEvent(hooks, { ...context, forceLevel: assessment.type === "ambient" ? "light" : null })
    };
  }

  // 概率制：以分数/100 作为概率权重
  const weight = (assessment.score || 0) / 100;
  if (rngFrom(context.rng, context.worldSeed ?? "world-tree", context.round || 0, "director.trigger").next() < weight) {
    return {
      trigger: true,
      method: "probability",
      probability: weight,
      event: selectHookEvent(hooks, { ...context, forceLevel: assessment.type === "ambient" ? "light" : null })
    };
  }

  return { trigger: false, method: "probability_miss", event: null };
}

// ═══════════════════════════════════════════════════════════════
//  节奏分析
// ═══════════════════════════════════════════════════════════════

export function analyzePacing(emotion, round = 0, lastEventRound = 0) {
  const { engagement, tension, fatigue, curiosity } = emotion || getDefaultEmotionState(); // curiosity 此前未解构：高投入时抛 ReferenceError
  const T = PACING_THRESHOLDS;
  const advices = [];

  // 节奏过紧：高张力+高投入+高疲劳
  if (tension >= T.TIGHT_TENSION_MIN && fatigue >= T.TIGHT_FATIGUE_MIN && engagement >= T.TIGHT_ENGAGEMENT_MIN) {
    advices.push({
      signal: "节奏过紧",
      severity: "advise",
      advice: "连续高张力，建议插入一段温和的日常互动或环境描写来释放压力，然后再推主线。"
    });
  }

  // 节奏过松：低张力+低好奇+低投入
  if (tension <= T.LOOSE_TENSION_MAX && engagement <= T.LOOSE_ENGAGEMENT_MAX && fatigue <= T.LOOSE_FATIGUE_MAX) {
    advices.push({
      signal: "节奏过松",
      severity: "advise",
      advice: "叙事节奏偏平：可从已有未解线索或角色既有动机中推进一步；没有合适线索时保持平静，不要新造冲突。"
    });
  }

  // 疲劳预警
  if (fatigue >= T.FATIGUE_WARN_THRESHOLD) {
    advices.push({
      signal: "玩家疲劳",
      severity: "warning",
      advice: "玩家疲劳度较高，本轮避免重大事件和复杂信息，以轻松、简洁、角色互动为主。"
    });
  }

  // 最佳窗口期
  if (engagement >= T.BEST_WINDOW_ENGAGEMENT_MIN && curiosity >= T.BEST_WINDOW_CURIOSITY_MIN && fatigue <= T.BEST_WINDOW_FATIGUE_MAX) {
    advices.push({
      signal: "最佳窗口",
      severity: "signal",
      advice: "玩家处于高投入+高好奇状态，适合推进关键剧情或深入角色互动。趁这个机会抛出重要信息。"
    });
  }

  // 冷却不足
  const roundsSinceLast = round - (lastEventRound || 0);
  if (roundsSinceLast < T.COOLDOWN_MIN_ROUNDS && roundsSinceLast > 0) {
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
