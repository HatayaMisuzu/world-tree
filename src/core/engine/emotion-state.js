// ===== 玩家情绪状态机 v1 =====
// 独立模块，无外部依赖。
// 四维情绪模型：投入度/紧张度/疲劳度/好奇心
// 每维 0-10，默认起始 5（中性）

export const EMOTION_DIMENSIONS = ["engagement", "tension", "fatigue", "curiosity"];
export const INITIAL_STATE = { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 };

export function getDefaultEmotionState() {
  return { ...INITIAL_STATE };
}

// ---- 信号检测（从用户输入提取情绪信号） ----

function signalAnalysis(input = "") {
  const text = String(input || "");
  const signals = {
    longInput: text.length > 100,
    veryLongInput: text.length > 300,
    shortInput: text.length > 0 && text.length < 20,
    hasQuestion: /[？?]/.test(text),
    hasBrackets: /[（(]/.test(text) && /[)）]/.test(text),
    hasExclamation: /[！!]/.test(text),
    hasAction: /^(我|他|她|它|他们)/.test(text.trim()),
    hasEmotional: /难过|伤心|开心|生气|害怕|紧张|兴奋|郁闷|烦躁|感动/.test(text),
    hasCommandLike: /^\/|检查|配置|修复|为什么|帮我|查/.test(text),
    tenseKeywords: /忽然|突然|危险|战斗|逃跑|追逐|黑暗中|被|尖叫|救命|出事了/.test(text),
    curiousKeywords: /为什么|怎么回事|原来|谁|什么|难道|是不是|到底|哪里|多久/.test(text),
    fatigueKeywords: /累了|困了|-_-|哈欠|算了|随便|就这样|没意思/.test(text)
  };
  return signals;
}

// ---- 情绪更新 ----

export function updateEmotionState(prevState, { input = "", turnCount = 0, eventTriggered = false, sceneChanged = false } = {}) {
  const state = { ...(prevState || INITIAL_STATE) };
  const s = signalAnalysis(input);

  // 投入度 engagement
  if (s.veryLongInput) state.engagement = Math.min(10, state.engagement + 1.5);
  else if (s.longInput) state.engagement = Math.min(10, state.engagement + 0.8);
  else if (s.shortInput) state.engagement = Math.max(1, state.engagement - 0.3);
  if (s.hasExclamation) state.engagement = Math.min(10, state.engagement + 0.5);
  if (s.hasAction) state.engagement = Math.min(10, state.engagement + 0.3);
  if (s.hasCommandLike) state.engagement = Math.min(10, state.engagement + 0.3);

  // 紧张度 tension
  if (s.tenseKeywords) state.tension = Math.min(10, state.tension + 1.2);
  if (s.hasExclamation) state.tension = Math.min(10, state.tension + 0.3);
  if (sceneChanged) state.tension = Math.min(10, state.tension + 0.3); // 新环境轻度紧张
  if (s.hasBrackets) state.tension = Math.max(1, state.tension - 0.3); // 括号指令=玩家主动控制，紧张降低
  // 自然衰减：每轮向 5 回归
  state.tension += (5 - state.tension) * 0.08;

  // 疲劳度 fatigue
  if (s.fatigueKeywords) state.fatigue = Math.min(10, state.fatigue + 1.5);
  if (s.veryLongInput) state.fatigue = Math.min(10, state.fatigue + 0.2);
  if (eventTriggered) state.fatigue = Math.min(10, state.fatigue + 0.5); // 事件消耗注意力
  // 长期运行积累
  if (turnCount > 0 && turnCount % 10 === 0) state.fatigue = Math.min(10, state.fatigue + 0.3);
  // 疲劳自然恢复（缓慢）
  state.fatigue = Math.max(1, state.fatigue - 0.05);

  // 好奇心 curiosity
  if (s.curiousKeywords) state.curiosity = Math.min(10, state.curiosity + 1.0);
  if (s.hasQuestion) state.curiosity = Math.min(10, state.curiosity + 0.5);
  if (sceneChanged) state.curiosity = Math.min(10, state.curiosity + 0.8); // 新场景激发好奇
  if (eventTriggered) state.curiosity = Math.max(1, state.curiosity - 0.5); // 事件满足了部分好奇
  // 自然衰减
  state.curiosity += (5 - state.curiosity) * 0.06;

  // 钳制到 0-10
  for (const dim of EMOTION_DIMENSIONS) {
    state[dim] = Math.round(Math.max(0, Math.min(10, state[dim])) * 10) / 10;
  }

  return state;
}

// ---- 情绪画像（给 Director 和 LLM 用） ----

export function getEmotionProfile(state) {
  const s = state || INITIAL_STATE;
  const dominant = [];
  if (s.engagement >= 7) dominant.push("high-engagement");
  else if (s.engagement <= 3) dominant.push("low-engagement");
  if (s.tension >= 7) dominant.push("stressed");
  else if (s.tension <= 3) dominant.push("relaxed");
  if (s.fatigue >= 7) dominant.push("fatigued");
  if (s.curiosity >= 7) dominant.push("curious");
  else if (s.curiosity <= 3) dominant.push("satisfied");

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
