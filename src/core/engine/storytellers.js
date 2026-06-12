// ===== 叙事者风格系统 v1.0 =====
// 叙事者不是"文风皮肤"，而是 Director 层的事件调度策略配置。
// 优先级：疲劳保护 > 剧情连续性 > 玩家情绪 > 叙事者风格 > 文风偏好

// ═══════════════════════════════════════════════════════════════
//  1. 叙事者预设
// ═══════════════════════════════════════════════════════════════

export const STORYTELLERS = {
  classic: {
    id: "classic",
    name: "稳定剧作家",
    tier: "basic",
    description: "平衡稳健的叙事者。传统三幕式节奏，稳定回收伏笔，适合大多数故事和新手。不会有太大意外，也不会太慢。",
    // 事件调度参数（0-1）
    eventFrequency: 0.55,     // 事件触发基准频率
    pressureBias: 0.5,        // 压力倾向（>0.5 偏高压）
    randomness: 0.25,         // 随机波动幅度
    restBias: 0.5,            // 喘息窗口长度倾向
    revealBias: 0.55,         // 信息揭示倾向（>0.5 偏主动揭示）
    relationshipBias: 0.45,   // 关系事件倾向
    mysteryBias: 0.45,        // 悬念/谜题倾向
    dangerBias: 0.45,         // 危险/冲突倾向
    fatigueProtection: 0.8,   // 疲劳保护阈值（越高越早降压）
    // 叙事策略
    pressureCurve: "gradual", // gradual | escalating | soft | unstable | slow_burn | arc_based | quest_based
    revealStyle: "partial_then_payoff",
    choiceClarity: "medium",
    rewardFrequency: "medium",
    pacingHint: "平稳推进，好奇→紧张→释放→新伏笔"
  },

  cruel: {
    id: "cruel",
    name: "残酷命运",
    tier: "basic",
    description: "高压生存叙事者。资源会减少，安全窗口很短，选择经常有代价。适合末日、黑暗奇幻、战争故事。",
    eventFrequency: 0.8,
    pressureBias: 0.85,
    randomness: 0.45,
    restBias: 0.25,
    revealBias: 0.35,
    relationshipBias: 0.35,
    mysteryBias: 0.45,
    dangerBias: 0.9,
    fatigueProtection: 0.65,
    pressureCurve: "escalating",
    revealStyle: "hard_truths",
    choiceClarity: "medium",
    rewardFrequency: "low",
    pacingHint: "不断升压，安全窗口短，选择有代价。但疲劳过高时仍会降压保护。"
  },

  gentle: {
    id: "gentle",
    name: "温柔看护者",
    tier: "basic",
    description: "低压陪伴叙事者。很少打断，不频繁引入危机，重视角色回应和情绪回声。适合角色卡、日常、治愈故事。",
    eventFrequency: 0.25,
    pressureBias: 0.2,
    randomness: 0.15,
    restBias: 0.85,
    revealBias: 0.45,
    relationshipBias: 0.85,
    mysteryBias: 0.25,
    dangerBias: 0.15,
    fatigueProtection: 0.95,
    pressureCurve: "soft",
    revealStyle: "intimate",
    choiceClarity: "high",
    rewardFrequency: "high",
    pacingHint: "慢节奏，安全感，亲密。重视角色如何回应，而非外部事件。"
  },

  mystery: {
    id: "mystery",
    name: "悬疑织网者",
    tier: "basic",
    description: "推理调查叙事者。擅长埋线索、半揭示、控制信息缺口、重视伏笔回收。适合侦探、悬疑、克苏鲁调查。",
    eventFrequency: 0.4,
    pressureBias: 0.55,
    randomness: 0.2,
    restBias: 0.4,
    revealBias: 0.7,
    relationshipBias: 0.35,
    mysteryBias: 0.9,
    dangerBias: 0.5,
    fatigueProtection: 0.75,
    pressureCurve: "slow_burn",
    revealStyle: "clue_first",
    choiceClarity: "medium",
    rewardFrequency: "medium",
    pacingHint: "慢热，线索优先，解释延迟，保持克制。中后段收束。"
  },

  chaos: {
    id: "chaos",
    name: "疯狂骰子",
    tier: "basic",
    description: "不可预测的叙事者。小事可能变大，大危机后可能立刻有奖励。适合荒诞冒险、废土、沙盒故事。",
    eventFrequency: 0.6,
    pressureBias: 0.5,
    randomness: 0.9,
    restBias: 0.45,
    revealBias: 0.5,
    relationshipBias: 0.5,
    mysteryBias: 0.5,
    dangerBias: 0.55,
    fatigueProtection: 0.7,
    pressureCurve: "unstable",
    revealStyle: "random",
    choiceClarity: "low",
    rewardFrequency: "variable",
    pacingHint: "忽快忽慢，不可预测，荒诞刺激。但 Guardian 会确保世界规则不被破坏。"
  },

  // ═══════════════════════════════════════════════════════════
  //  高级叙事者（tier: advanced — 高级设置中可选）
  // ═══════════════════════════════════════════════════════════

  epic: {
    id: "epic",
    name: "史诗编年史家",
    tier: "advanced",
    description: "宏大历史叙事者。个人选择影响组织和历史，事件后果更长线。适合高魔史诗、王国战争、星际文明。",
    eventFrequency: 0.5,
    pressureBias: 0.55,
    randomness: 0.3,
    restBias: 0.4,
    revealBias: 0.6,
    relationshipBias: 0.4,
    mysteryBias: 0.5,
    dangerBias: 0.6,
    fatigueProtection: 0.75,
    pressureCurve: "arc_based",
    revealStyle: "historical",
    choiceClarity: "medium",
    rewardFrequency: "medium",
    pacingHint: "中慢节奏，事件影响范围大，后果长线。个人选择影响历史。"
  },

  intimate: {
    id: "intimate",
    name: "角色导演",
    tier: "advanced",
    description: "人物关系叙事者。放大沉默、犹豫、心动、愧疚。事件不是重点，重点在于角色如何回应。适合恋爱、羁绊、家庭 Drama。",
    eventFrequency: 0.2,
    pressureBias: 0.3,
    randomness: 0.1,
    restBias: 0.8,
    revealBias: 0.35,
    relationshipBias: 0.95,
    mysteryBias: 0.2,
    dangerBias: 0.1,
    fatigueProtection: 0.9,
    pressureCurve: "soft",
    revealStyle: "intimate",
    choiceClarity: "high",
    rewardFrequency: "high",
    pacingHint: "慢节奏，聚焦角色内心。放大细微互动——沉默、犹豫、回避、靠近。"
  },

  adventure: {
    id: "adventure",
    name: "冒险主持人",
    tier: "advanced",
    description: "跑团式叙事者。目标清晰，行动感强，经常给选择。适合 DND、地牢探索、星际冒险。",
    eventFrequency: 0.65,
    pressureBias: 0.55,
    randomness: 0.35,
    restBias: 0.45,
    revealBias: 0.5,
    relationshipBias: 0.4,
    mysteryBias: 0.4,
    dangerBias: 0.7,
    fatigueProtection: 0.7,
    pressureCurve: "quest_based",
    revealStyle: "action_first",
    choiceClarity: "high",
    rewardFrequency: "high",
    pacingHint: "中快节奏，目标明确，选择清晰，经常给行动点和奖励。"
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. 叙事者评分修正器
// ═══════════════════════════════════════════════════════════════

/**
 * 优先级顺序（不可颠倒）：
 *   1. 疲劳保护（硬覆盖）
 *   2. 剧情连续性
 *   3. 玩家当前情绪
 *   4. 叙事者风格
 *   5. 文风偏好
 */

/**
 * 根据叙事者调整事件评分
 * @param {number} baseScore - 基础事件评分（来自 director.calculateEventScore）
 * @param {Object} storyteller - STORYTELLERS 中的预设
 * @param {Object} emotion - 当前情绪 { engagement, tension, fatigue, curiosity }
 * @returns {{ score: number, adjustments: string[] }}
 */
export function applyStorytellerModifiers(baseScore, storyteller = STORYTELLERS.classic, emotion = {}) {
  const st = storyteller || STORYTELLERS.classic;
  const adjustments = [];
  let score = baseScore;
  const fatigue = emotion.fatigue || 5;

  // ── 1. 叙事者事件频率 ──
  const freqMod = 0.5 + st.eventFrequency;
  score *= freqMod;
  adjustments.push(`📊 事件频率(${st.name})：× ${freqMod.toFixed(2)}`);

  // ── 2. 叙事者压力倾向 × 当前情绪张力 ──
  const tension = emotion.tension || 5;
  const pressureMod = 0.5 + st.pressureBias * (tension / 10);
  score *= pressureMod;
  if (st.pressureBias > 0.7) {
    adjustments.push(`⚡ 高压倾向(${st.name})：× ${pressureMod.toFixed(2)}`);
  }

  // ── 3. 叙事者随机波动 ──
  if (st.randomness > 0.3) {
    const randomFactor = 0.5 + Math.random() * st.randomness * 2;
    score *= randomFactor;
    adjustments.push(`🎲 随机波动(${st.name})：× ${randomFactor.toFixed(2)}`);
  }

  // ── 4. 叙事者特定加成 ──
  if (st.relationshipBias > 0.7 && emotion.engagement > 6) {
    score *= 1.2;
    adjustments.push(`💕 关系加成：× 1.2`);
  }
  if (st.mysteryBias > 0.7 && emotion.curiosity > 6) {
    score *= 1.3;
    adjustments.push(`🔍 悬疑加成(c=${emotion.curiosity})：× 1.3`);
  }
  if (st.dangerBias > 0.7 && emotion.tension > 6) {
    score *= 1.15;
    adjustments.push(`💀 危险加成(t=${emotion.tension})：× 1.15`);
  }

  // ═══════════════════════════════════════════════════════
  //  ⚠️ 疲劳保护（硬截断，永远最后执行，优先级最高）
  // ═══════════════════════════════════════════════════════
  if (fatigue >= 8) {
    score = Math.min(score, 15);
    adjustments.push(`🔒 疲劳保护(f=${fatigue})：硬截断到≤15`);
  } else if (fatigue >= 7) {
    score *= 0.4;
    adjustments.push(`🛡️ 疲劳保护(f=${fatigue})：× 0.4`);
  } else if (fatigue >= 6 && st.fatigueProtection > 0.7) {
    score *= 0.7;
    adjustments.push(`🛡️ 叙事者疲劳保护(f=${fatigue})：× 0.7`);
  }

  return {
    score: Math.round(Math.max(0, score)),
    adjustments,
    storyteller: st.id
  };
}

/**
 * 根据叙事者调整方向包的 pacing 建议
 * @returns {string} pacing 值
 */
export function applyStorytellerPacing(storyteller = STORYTELLERS.classic, emotion = {}) {
  const st = storyteller || STORYTELLERS.classic;
  const fatigue = emotion.fatigue || 5;

  // 疲劳保护永远最高优先级
  if (fatigue >= 8) return "relief";
  if (fatigue >= 7 && st.fatigueProtection > 0.5) return "relief";

  // 叙事者节奏曲线
  switch (st.pressureCurve) {
    case "escalating": return "escalate";
    case "soft":       return "hold";
    case "unstable":   return Math.random() > 0.5 ? "hook" : "relief";
    case "slow_burn":  return emotion.curiosity > 6 ? "reveal_partial" : "hold";
    case "arc_based":  return "hold";
    case "quest_based": return emotion.engagement > 5 ? "hook" : "hold";
    default:           return "hold";
  }
}

/**
 * 生成叙事者策略摘要（注入 Direction Packet 和 Writer prompt）
 */
export function storytellerStrategySummary(storyteller = STORYTELLERS.classic) {
  const st = storyteller || STORYTELLERS.classic;
  return [
    `【叙事者：${st.name}】`,
    `节奏曲线: ${st.pressureCurve}  |  揭示风格: ${st.revealStyle}`,
    `事件频率: ${Math.round(st.eventFrequency * 100)}%  |  随机度: ${Math.round(st.randomness * 100)}%`,
    `关系倾向: ${Math.round(st.relationshipBias * 100)}%  |  悬念倾向: ${Math.round(st.mysteryBias * 100)}%  |  危险倾向: ${Math.round(st.dangerBias * 100)}%`,
    `写作提示: ${st.pacingHint}`
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════
//  3. 便捷工具
// ═══════════════════════════════════════════════════════════════

export function getStoryteller(id = "classic") {
  return STORYTELLERS[id] || STORYTELLERS.classic;
}

export function listBasicStorytellers() {
  return Object.values(STORYTELLERS).filter(s => s.tier === "basic");
}

export function listAdvancedStorytellers() {
  return Object.values(STORYTELLERS).filter(s => s.tier === "advanced");
}

export function listAllStorytellers() {
  return Object.values(STORYTELLERS);
}

export default {
  STORYTELLERS,
  applyStorytellerModifiers,
  applyStorytellerPacing,
  storytellerStrategySummary,
  getStoryteller,
  listBasicStorytellers,
  listAdvancedStorytellers,
  listAllStorytellers
};
