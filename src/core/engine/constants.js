// ===== 引擎集中常量 v1 =====
// 所有可调参数集中管理——调整叙事行为只需改此文件。
// 各模块 import 使用，避免硬编码散落。

// ═══════════════════════════════════════════════════════════════
//  emotion-state.js — 信号检测
// ═══════════════════════════════════════════════════════════════

export const EMOTION_SIGNAL_LENGTHS = {
  LONG_INPUT_MIN: 100,
  VERY_LONG_INPUT_MIN: 300,
  SHORT_INPUT_MAX: 20,
};

export const EMOTION_SIGNAL_PATTERNS = {
  question:      /[？?]/,
  brackets:      /[（(].*[)）]/,
  exclamation:   /[！!]/,
  action:        /^(我|他|她|它|他们)/,
  emotional:     /难过|伤心|开心|生气|害怕|紧张|兴奋|郁闷|烦躁|感动/,
  commandLike:   /^\/|检查|配置|修复|为什么|帮我|查/,
  tenseKeywords: /忽然|突然|危险|战斗|逃跑|追逐|黑暗中|被|尖叫|救命|出事了/,
  curiousKeywords: /为什么|怎么回事|原来|谁|什么|难道|是不是|到底|哪里|多久/,
  fatigueKeywords: /累了|困了|-_-|哈欠|算了|随便|就这样|没意思/,
};

// ═══════════════════════════════════════════════════════════════
//  emotion-state.js — 增量 / 衰减
// ═══════════════════════════════════════════════════════════════

export const EMOTION_DELTAS = {
  engagement: {
    veryLongInput:    1.5,
    longInput:        0.8,
    shortInputDecay: -0.3,
    exclamation:      0.5,
    action:           0.3,
    commandLike:      0.3,
  },
  tension: {
    tenseKeywords:  1.2,
    exclamation:    0.3,
    sceneChanged:   0.3,
    bracketsDecay: -0.3,
    decayRate:      0.08,   // 向 5 回归
  },
  fatigue: {
    fatigueKeywords: 1.5,
    veryLongInput:   0.2,
    eventTriggered:  0.5,
    longRunInterval: 10,    // 每 N 轮累加
    longRunDelta:    0.3,
    naturalRecovery:-0.05,
  },
  curiosity: {
    curiousKeywords: 1.0,
    question:        0.5,
    sceneChanged:    0.8,
    eventSatisfy:   -0.5,
    decayRate:       0.06,
  },
};

export const EMOTION_RANGE = { min: 0, max: 10, neutral: 5, roundDecimals: 1 };

// ═══════════════════════════════════════════════════════════════
//  emotion-state.js — 画像阈值
// ═══════════════════════════════════════════════════════════════

export const EMOTION_PROFILE_THRESHOLDS = { high: 7, low: 3 };

// ═══════════════════════════════════════════════════════════════
//  director.js — 事件评分
// ═══════════════════════════════════════════════════════════════

export const EVENT_SCORE = {
  CORE_CHARS_2PLUS:       20,
  CORE_CHARS_1:           10,
  TENSION_PER_POINT:       5,   // (tension - 5) × 5
  HIGH_TENSION_THRESHOLD:  6,
  HIGH_CURIOSITY:          7,
  HIGH_CURIOSITY_BONUS:   10,
  COOLDOWN_MULTIPLIER:     3,
  COOLDOWN_MAX:           15,
  SCENE_CHANGE_BONUS:     10,
  HIGH_FATIGUE_THRESHOLD:  7,
  HIGH_FATIGUE_PENALTY:   15,
  // 环境事件
  AMBIENT_LOW_TENSION_BONUS: 25,
  AMBIENT_LOW_CURIOSITY_BONUS: 10,
  AMBIENT_NO_CORE_CHARS_BONUS: 20,
  AMBIENT_RANDOM_MAX:      10,
  // 综合决策
  JUDGMENT_SCORE_THRESHOLD:    50,
  PROBABILITY_SCORE_THRESHOLD: 25,
  AMBIENT_PROBABILITY_THRESHOLD: 30,
};

// ═══════════════════════════════════════════════════════════════
//  director.js — 节奏分析
// ═══════════════════════════════════════════════════════════════

export const PACING_THRESHOLDS = {
  TIGHT_TENSION_MIN:       7,
  TIGHT_FATIGUE_MIN:       5,
  TIGHT_ENGAGEMENT_MIN:    6,
  LOOSE_TENSION_MAX:       3,
  LOOSE_ENGAGEMENT_MAX:    4,
  LOOSE_FATIGUE_MAX:       4,
  FATIGUE_WARN_THRESHOLD:  7,
  BEST_WINDOW_ENGAGEMENT_MIN: 7,
  BEST_WINDOW_CURIOSITY_MIN:  6,
  BEST_WINDOW_FATIGUE_MAX:    5,
  COOLDOWN_MIN_ROUNDS:     3,
};

// ═══════════════════════════════════════════════════════════════
//  director.js — 预测缓存
// ═══════════════════════════════════════════════════════════════

export const PREDICTION_CACHE = {
  MAX_SIZE:            5,
  SCORE_MIN:          20,
  SCORE_MAX:          50,
  WAIT_BONUS_MULTIPLIER: 3,
  WAIT_BONUS_MAX:     15,
};

// ═══════════════════════════════════════════════════════════════
//  lifecycle.js — 叙事关系自动提取
// ═══════════════════════════════════════════════════════════════

export const POSITIVE_RELATION_WORDS = [
  { word: "救了", delta:  2, desc: "救命之恩" },
  { word: "帮助", delta:  1, desc: "提供帮助" },
  { word: "保护", delta:  2, desc: "保护对方" },
  { word: "支持", delta:  1, desc: "表示支持" },
  { word: "鼓励", delta:  1, desc: "给予鼓励" },
  { word: "安慰", delta:  1, desc: "安慰对方" },
  { word: "信任", delta:  1, desc: "表示信任" },
  { word: "夸奖", delta:  1, desc: "夸奖对方" },
  { word: "赞赏", delta:  1, desc: "赞赏对方" },
  { word: "交给", delta:  1, desc: "托付信任" },
];

export const NEGATIVE_RELATION_WORDS = [
  { word: "背叛", delta: -2, desc: "背叛行为" },
  { word: "攻击", delta: -2, desc: "发动攻击" },
  { word: "伤害", delta: -2, desc: "造成伤害" },
  { word: "欺骗", delta: -1, desc: "欺骗对方" },
  { word: "抛弃", delta: -2, desc: "抛弃对方" },
  { word: "威胁", delta: -1, desc: "发出威胁" },
  { word: "怀疑", delta: -1, desc: "怀疑对方" },
  { word: "反对", delta: -1, desc: "反对对方" },
  { word: "质疑", delta: -1, desc: "质疑对方" },
  { word: "指责", delta: -1, desc: "指责对方" },
];

export const RELATION_TYPE_KEYWORDS = [
  { word: "朋友", type: "friend" },
  { word: "盟友", type: "ally" },
  { word: "敌人", type: "enemy" },
  { word: "师徒", type: "mentor" },
  { word: "恋人", type: "lover" },
  { word: "守护", type: "protector" },
];

// ═══════════════════════════════════════════════════════════════
//  lifecycle.js — 退化检测
// ═══════════════════════════════════════════════════════════════

export const DEGRADATION = {
  CONSECUTIVE_NARRATIVE_MAX:  8,
  VAGUE_INPUT_MIN_LENGTH:     6,
};
