// ===== 玩家情绪状态机 v1 =====
// 独立模块，无外部依赖。
// 四维情绪模型：投入度/紧张度/疲劳度/好奇心
// 每维 0-10，默认起始 5（中性）

import { EMOTION_SIGNAL_LENGTHS, EMOTION_SIGNAL_PATTERNS, EMOTION_DELTAS, EMOTION_RANGE, EMOTION_PROFILE_THRESHOLDS } from "./constants.js";

export const EMOTION_DIMENSIONS = ["engagement", "tension", "fatigue", "curiosity"];
export const INITIAL_STATE = { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 };

export function getDefaultEmotionState() {
  return { ...INITIAL_STATE };
}

// ---- 信号检测（从用户输入提取情绪信号） ----

function signalAnalysis(input = "") {
  const text = String(input || "");
  const P = EMOTION_SIGNAL_PATTERNS;
  const L = EMOTION_SIGNAL_LENGTHS;
  const signals = {
    longInput:      text.length > L.LONG_INPUT_MIN,
    veryLongInput:  text.length > L.VERY_LONG_INPUT_MIN,
    shortInput:     text.length > 0 && text.length < L.SHORT_INPUT_MAX,
    hasQuestion:    P.question.test(text),
    hasBrackets:    P.brackets.test(text),
    hasExclamation: P.exclamation.test(text),
    hasAction:      P.action.test(text.trim()),
    hasEmotional:   P.emotional.test(text),
    hasCommandLike: P.commandLike.test(text),
    tenseKeywords:  P.tenseKeywords.test(text),
    curiousKeywords: P.curiousKeywords.test(text),
    fatigueKeywords: P.fatigueKeywords.test(text),
  };
  return signals;
}

// ---- 情绪更新 ----

export function updateEmotionState(prevState, { input = "", turnCount = 0, eventTriggered = false, sceneChanged = false } = {}) {
  const state = { ...(prevState || INITIAL_STATE) };
  const s = signalAnalysis(input);
  const D = EMOTION_DELTAS;
  const R = EMOTION_RANGE;

  // 投入度 engagement
  if (s.veryLongInput) state.engagement = Math.min(R.max, state.engagement + D.engagement.veryLongInput);
  else if (s.longInput) state.engagement = Math.min(R.max, state.engagement + D.engagement.longInput);
  else if (s.shortInput) state.engagement = Math.max(R.min, state.engagement + D.engagement.shortInputDecay);
  if (s.hasExclamation) state.engagement = Math.min(R.max, state.engagement + D.engagement.exclamation);
  if (s.hasAction) state.engagement = Math.min(R.max, state.engagement + D.engagement.action);
  if (s.hasCommandLike) state.engagement = Math.min(R.max, state.engagement + D.engagement.commandLike);

  // 紧张度 tension
  if (s.tenseKeywords) state.tension = Math.min(R.max, state.tension + D.tension.tenseKeywords);
  if (s.hasExclamation) state.tension = Math.min(R.max, state.tension + D.tension.exclamation);
  if (sceneChanged) state.tension = Math.min(R.max, state.tension + D.tension.sceneChanged);
  if (s.hasBrackets) state.tension = Math.max(R.min, state.tension + D.tension.bracketsDecay);
  state.tension += (R.neutral - state.tension) * D.tension.decayRate;

  // 疲劳度 fatigue
  if (s.fatigueKeywords) state.fatigue = Math.min(R.max, state.fatigue + D.fatigue.fatigueKeywords);
  if (s.veryLongInput) state.fatigue = Math.min(R.max, state.fatigue + D.fatigue.veryLongInput);
  if (eventTriggered) state.fatigue = Math.min(R.max, state.fatigue + D.fatigue.eventTriggered);
  if (turnCount > 0 && turnCount % D.fatigue.longRunInterval === 0) state.fatigue = Math.min(R.max, state.fatigue + D.fatigue.longRunDelta);
  state.fatigue = Math.max(R.min, state.fatigue + D.fatigue.naturalRecovery);

  // 好奇心 curiosity
  if (s.curiousKeywords) state.curiosity = Math.min(R.max, state.curiosity + D.curiosity.curiousKeywords);
  if (s.hasQuestion) state.curiosity = Math.min(R.max, state.curiosity + D.curiosity.question);
  if (sceneChanged) state.curiosity = Math.min(R.max, state.curiosity + D.curiosity.sceneChanged);
  if (eventTriggered) state.curiosity = Math.max(R.min, state.curiosity + D.curiosity.eventSatisfy);
  state.curiosity += (R.neutral - state.curiosity) * D.curiosity.decayRate;

  // 钳制到范围
  for (const dim of EMOTION_DIMENSIONS) {
    state[dim] = Math.round(Math.max(R.min, Math.min(R.max, state[dim])) * (10 ** R.roundDecimals)) / (10 ** R.roundDecimals);
  }

  return state;
}

// ---- 情绪画像（给 Director 和 LLM 用） ----

export function getEmotionProfile(state) {
  const s = state || INITIAL_STATE;
  const T = EMOTION_PROFILE_THRESHOLDS;
  const dominant = [];
  if (s.engagement >= T.high) dominant.push("high-engagement");
  else if (s.engagement <= T.low) dominant.push("low-engagement");
  if (s.tension >= T.high) dominant.push("stressed");
  else if (s.tension <= T.low) dominant.push("relaxed");
  if (s.fatigue >= T.high) dominant.push("fatigued");
  if (s.curiosity >= T.high) dominant.push("curious");
  else if (s.curiosity <= T.low) dominant.push("satisfied");

  return {
    state: s,
    dominant,
    advice: generateAdvice(s)
  };
}

function generateAdvice(state) {
  const tips = [];
  const { engagement, tension, fatigue, curiosity } = state;

  if (fatigue >= 7) {
    tips.push("玩家疲劳度较高——当前轮叙事宜轻缓，避免引入需要深度投入的新事件。");
  }
  if (tension >= 8 && fatigue < 6) {
    tips.push("紧张度高但精力尚可——适合推进核心冲突或揭示关键信息。");
  }
  if (tension >= 8 && fatigue >= 6) {
    tips.push("紧张+疲劳并存——建议提供喘息空间（自然过渡/温和互动），缓解后再推进关键剧情。");
  }
  if (curiosity >= 7 && tension < 6) {
    tips.push("好奇心高涨——适合抛出悬念线索、揭示部分秘密。");
  }
  if (engagement <= 4 && curiosity <= 4) {
    tips.push("投入度和好奇心均低——建议触发轻量新事件或引入新角色来重新激发兴趣。");
  }
  if (engagement >= 7 && curiosity >= 6) {
    tips.push("高投入+高好奇——内容接收度最佳窗口，适合推进复杂剧情或揭示重要信息。");
  }
  if (tension <= 3 && curiosity <= 4 && fatigue <= 4) {
    tips.push("一切平稳——可考虑用轻松调剂事件维持节奏，或给一段细腻的角色互动描写。");
  }

  return tips;
}

// ---- 维度名称中文化 ----

export const DIMENSION_LABELS = {
  engagement: "投入度",
  tension: "紧张度",
  fatigue: "疲劳度",
  curiosity: "好奇心"
};

export function formatEmotionState(state) {
  const s = state || INITIAL_STATE;
  return EMOTION_DIMENSIONS.map((dim) => {
    const label = DIMENSION_LABELS[dim];
    const bar = "█".repeat(Math.round(s[dim])) + "░".repeat(10 - Math.round(s[dim]));
    return `  ${label}: ${bar} ${s[dim]}`;
  }).join("\n");
}

/** 重置情绪状态（切换存档/模组时调用） */
export function resetEmotionState() {
  return { ...INITIAL_STATE };
}
