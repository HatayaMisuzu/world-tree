// ===== 全局叙事记忆系统 v2 (v0.9.0) =====
// 跨模块的长期记忆快照库
// 每轮结束后自动创建快照，包含：场景摘要/角色状态/情绪画像
// 检索：关键词 + 情绪相似度 + 时效性加权
// 🆕 v0.9.0: _why(为什么创建) + _provenance(来源追溯) + explainMemoryMatch(为什么检索到)
//
// 存储：data/engine/global-memory/snapshots.json（追加密）

const MEMORY_STORE = { snapshots: [], maxSize: 200 };
let memoryIdCounter = 0;
let compiledIndex = null;

export const GLOBAL_MEMORY_PATH = "data/engine/global-memory/snapshots.json";

// ═══════════════════════════════════════════════════════════════
//  快照创建
// ═══════════════════════════════════════════════════════════════

/**
 * 创建一条全局记忆快照 (v0.9.0 可解释版)
 * @param {Object} opts
 * @param {string} opts.moduleKey - 模组标识
 * @param {string} opts.branch - 分支
 * @param {string} opts.scene - 当前场景
 * @param {number} opts.round - 轮次
 * @param {Object} opts.emotion - 情绪状态 {engagement, tension, fatigue, curiosity}
 * @param {string} opts.summary - 本轮叙事摘要（50-150字）
 * @param {string[]} opts.keywords - 关键词列表
 * @param {string[]} opts.keyEvents - 关键事件列表
 * @param {Object} opts.characterStatus - 角色状态 {角色名: 状态}
 * @param {string} opts.input - 用户原始输入
 * @param {string} opts.narrative - LLM 回复（前300字摘要）
 * 
 * 🆕 v0.9.0 可解释字段
 * @param {Object} [opts.why] - 为什么值得记住
 * @param {string} opts.why.trigger - "player_action"|"scene_change"|"emotional_peak"|"conflict_escalation"|"revelation"|"routine"
 * @param {string} opts.why.significance - 一句话说明
 * @param {string} [opts.why.causalLink] - 前因记忆ID
 * @param {Object} [opts.provenance] - 溯源标记
 * @param {string} opts.provenance.source - "director"|"player"|"writer"|"guardian"
 * @param {string} [opts.provenance.inputDigest] - 玩家输入摘要
 * @param {string} [opts.provenance.outputDigest] - LLM输出核心
 * @param {string} opts.provenance.confidence - "confirmed"|"likely"|"speculative"
 * @param {string[]} [opts.provenance.affectedEntities] - 受影响实体
 * @param {Object} [opts.provenance.turnContext] - 本轮上下文{ pacing, eventIntensity, directorDecision }
 * @returns {Object} 创建的快照
 */
export function createMemorySnapshot(opts = {}) {
  const {
    moduleKey = "unknown",
    branch = "main",
    scene = "",
    round = 0,
    emotion = {},
    summary = "",
    keywords = [],
    keyEvents = [],
    characterStatus = {},
    input = "",
    narrative = "",
    // 🆕 v0.9.0
    why = null,
    provenance = null
  } = opts;

  // 自动提取关键词（如果未提供）
  const autoKeywords = keywords.length
    ? keywords
    : extractKeywords(summary || narrative || input);

  const snapshot = {
    id: `mem-${++memoryIdCounter}`,
    timestamp: new Date().toISOString(),
    moduleKey,
    branch,
    scene: scene || "未知场景",
    round,
    emotion: {
      engagement: emotion.engagement ?? 5,
      tension: emotion.tension ?? 5,
      fatigue: emotion.fatigue ?? 5,
      curiosity: emotion.curiosity ?? 5
    },
    summary: (summary || narrative || input || "").slice(0, 300),
    keywords: autoKeywords.slice(0, 15),
    keyEvents: (keyEvents || []).slice(0, 5),
    characterStatus: characterStatus || {},
    narrativePreview: (narrative || "").slice(0, 200),

    // 🆕 v0.9.0 可解释字段
    _why: why ? {
      trigger: why.trigger || inferTrigger(input, narrative, emotion),
      significance: why.significance || buildSignificance(input, narrative, keyEvents),
      causalLink: why.causalLink || null
    } : {
      trigger: inferTrigger(input, narrative, emotion),
      significance: buildSignificance(input, narrative, keyEvents),
      causalLink: null
    },

    _provenance: provenance ? {
      source: provenance.source || "writer",
      inputDigest: provenance.inputDigest || (input || "").slice(0, 50),
      outputDigest: provenance.outputDigest || extractCore(narrative || "", 50),
      confidence: provenance.confidence || "likely",
      affectedEntities: provenance.affectedEntities || [],
      turnContext: provenance.turnContext || {}
    } : {
      source: "writer",
      inputDigest: (input || "").slice(0, 50),
      outputDigest: extractCore(narrative || "", 50),
      confidence: "likely",
      affectedEntities: [],
      turnContext: {}
    }
  };

  MEMORY_STORE.snapshots.push(snapshot);

  // 裁剪超出上限
  if (MEMORY_STORE.snapshots.length > MEMORY_STORE.maxSize) {
    MEMORY_STORE.snapshots = MEMORY_STORE.snapshots.slice(-MEMORY_STORE.maxSize);
  }

  // 索引失效，需要重建
  compiledIndex = null;

  return snapshot;
}

// ═══════════════════════════════════════════════════════════════
//  _why 推断函数（当调用方未提供时自动推断）
// ═══════════════════════════════════════════════════════════════

function inferTrigger(input = "", narrative = "", emotion = {}) {
  const i = String(input || "").trim();
  const n = String(narrative || "").trim();

  // 场景转换
  if (/来到|到达|前往|进入|回到|返回|离开|出发/.test(i)) return "scene_change";
  if (/第二天|次日|第二天早上|过了一夜|晚上|清晨/.test(i)) return "scene_change";

  // 情绪高峰
  const tension = emotion.tension ?? 5;
  if (tension >= 8) return "emotional_peak";
  if (tension <= 2 && (emotion.fatigue ?? 5) >= 7) return "routine";

  // 冲突升级
  if (/冲突|战斗|对峙|争吵|威胁|警告/.test(n) || /战斗|攻击|打|杀/.test(i)) return "conflict_escalation";

  // 揭示
  if (/秘密|真相|原来|其实|发现|揭露/.test(n) || /为什么|答案|秘密/.test(i)) return "revelation";

  // 玩家行动
  if (/^(我|我们)/.test(i) && i.length > 4) return "player_action";

  return "routine";
}

function buildSignificance(input = "", narrative = "", keyEvents = []) {
  if (keyEvents.length) return keyEvents[0].slice(0, 80);
  const core = extractCore(narrative, 80);
  if (core) return core;
  if (input) return `玩家: ${input.slice(0, 50)}`;
  return "常规回合";
}

function extractCore(text, maxLen = 80) {
  const t = String(text || "").trim();
  if (!t) return "";
  // 跳过标记段，提取叙事核心
  const narrativeMatch = t.match(/【叙事】\s*\n?([\s\S]*?)(?=\n【[^】]+】|$)/);
  const body = narrativeMatch ? narrativeMatch[1].trim() : t;
  // 取首句
  const firstSentence = body.split(/[。！？\n]/)[0];
  return firstSentence.slice(0, maxLen);
}

// ═══════════════════════════════════════════════════════════════
//  检索
// ═══════════════════════════════════════════════════════════════

/**
 * 从全局记忆中检索相关快照
 * @param {Object} query
 * @param {string} query.text - 查询文本（用户输入/当前场景摘要）
 * @param {Object} query.emotion - 当前情绪状态
 * @param {string} query.moduleKey - 当前模组（⚠️ 必要字段——用于存档隔离，不传则返回空）
 * @param {number} query.limit - 返回上限（默认5）
 * @param {number} query.minScore - 最低匹配分（默认10）
 * @returns {Array} 排序后的快照列表（含 _score, _reasons, _matchExplanation）
 */
export function searchMemorySnapshots(query = {}) {
  const {
    text = "",
    emotion = {},
    moduleKey = null,
    limit = 5,
    minScore = 10
  } = query;

  if (!MEMORY_STORE.snapshots.length) return [];

  // ⚠️ 存档隔离：只返回当前模组的记忆，绝不污染
  const scopedSnapshots = moduleKey
    ? MEMORY_STORE.snapshots.filter((s) => s.moduleKey === moduleKey)
    : [];

  if (!scopedSnapshots.length) return [];

  const queryKeywords = extractKeywords(text);
  const curEmotion = emotion;

  // 为每个快照打分
  const scored = scopedSnapshots.map((snap) => {
    let score = 0;
    const reasons = [];

    // ① 关键词匹配（最高40分）
    if (queryKeywords.length > 0) {
      const snapKeywords = new Set([
        ...(snap.keywords || []),
        ...extractKeywords(snap.summary),
        ...extractKeywords(snap.scene)
      ]);
      let matchCount = 0;
      const matchedWords = [];
      for (const qk of queryKeywords) {
        if (snapKeywords.has(qk)) {
          matchCount++;
          matchedWords.push(qk);
        }
      }
      const kwScore = Math.min(40, (matchCount / Math.max(queryKeywords.length, 1)) * 40);
      if (kwScore > 0) reasons.push(`关键词"${matchedWords.slice(0, 5).join('/')}" +${kwScore.toFixed(0)}`);
      score += kwScore;
    }

    // ② 情绪相似度（最高25分）
    const snapEm = snap.emotion || {};
    const emDiff = Math.abs((snapEm.engagement ?? 5) - (curEmotion.engagement ?? 5))
      + Math.abs((snapEm.tension ?? 5) - (curEmotion.tension ?? 5))
      + Math.abs((snapEm.fatigue ?? 5) - (curEmotion.fatigue ?? 5))
      + Math.abs((snapEm.curiosity ?? 5) - (curEmotion.curiosity ?? 5));
    const emScore = Math.max(0, 25 - emDiff * 2);
    if (emScore > 5) reasons.push(`情绪相似 +${emScore.toFixed(0)}`);
    score += emScore;

    // ③ 时效性（最高20分）
    const recentBonus = Math.max(0, 20 - (query._currentRound || 0 - snap.round) * 0.5);
    if (recentBonus > 0) reasons.push(`时效 +${recentBonus.toFixed(0)}`);
    score += recentBonus;

    // 🆕 v0.9.0 ④ 因果链加分（最高15分）
    const causalBonus = snap._why?.causalLink ? 5 : 0;
    if (causalBonus > 0) reasons.push("因果链 +5");
    score += causalBonus;

    return { snapshot: snap, score, reasons, detailReasons: reasons };
  });

  // 排序 + 截断
  const results = scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      ...s.snapshot,
      _score: Math.round(s.score),
      _reasons: s.reasons,
      _matchExplanation: buildMatchExplanation(s.snapshot, s.reasons)
    }));

  return results;
}

// ═══════════════════════════════════════════════════════════════
//  构建记忆注入段（给 LLM prompt 用）
// ═══════════════════════════════════════════════════════════════

/**
 * 将检索到的记忆格式化为 LLM 可读的文本段 (v0.9.0 可解释版)
 * @param {Array} memories - searchMemorySnapshots 的返回
 * @returns {string} 格式化的记忆段
 */
export function formatMemorySection(memories = []) {
  if (!memories.length) return "";

  const lines = ["【叙事记忆 — 以下是与当前情境相关的过往事件】"];
  
  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    const emotionStr = `e=${mem.emotion.engagement} t=${mem.emotion.tension} f=${mem.emotion.fatigue} c=${mem.emotion.curiosity}`;
    const why = mem._why || {};
    const prov = mem._provenance || {};
    
    // 🆕 置信度标记
    const confIcon = prov.confidence === "confirmed" ? "✓" : prov.confidence === "speculative" ? "?" : "~";
    
    lines.push(
      `[#${i + 1}] 第${mem.round}轮 · ${mem.scene} ${confIcon}`,
      `  摘要: ${mem.summary.slice(0, 150)}`,
      // 🆕 为什么记住
      `  原因: ${why.significance || ""} (${translateTrigger(why.trigger)})`,
      // 🆕 来源
      prov.affectedEntities?.length ? `  涉及: ${prov.affectedEntities.join(", ")}` : "",
      mem.keyEvents?.length ? `  事件: ${mem.keyEvents.join(" / ")}` : "",
      `  情绪: ${emotionStr} 匹配: ${mem._score}分`,
      why.causalLink ? `  前因: →${why.causalLink}` : "",
      ""
    );
  }
  lines.push("注意：标记「✓」为已确认事实，「~」为可能事实，「?」为推测。");
  lines.push("记忆仅作为上下文参考，当前叙事不应被过往记忆完全束缚。");
  
  return lines.filter(Boolean).join("\n");
}

/**
 * 🆕 v0.9.0 解释一条记忆为什么被检索到
 * @param {Object} memory - 单条记忆快照
 * @returns {string} 人类可读的解释
 */
export function explainMemoryMatch(memory = null) {
  if (!memory) return "未检索到记忆";
  
  const parts = [`[${memory.round}轮] ${memory.scene}`];
  
  if (memory._reasons?.length) {
    parts.push(`匹配原因: ${memory._reasons.join(", ")}`);
  }
  
  const why = memory._why || {};
  if (why.trigger) {
    parts.push(`触发: ${translateTrigger(why.trigger)}`);
  }
  if (why.significance) {
    parts.push(`关键: ${why.significance}`);
  }
  
  const prov = memory._provenance || {};
  if (prov.confidence) {
    const confLabel = prov.confidence === "confirmed" ? "已确认" : 
                      prov.confidence === "speculative" ? "推测" : "可能";
    parts.push(`可靠度: ${confLabel}`);
  }
  
  parts.push(`评分: ${memory._score || "?"}分`);
  
  return parts.join(" | ");
}

/**
 * 🆕 v0.9.0 构建记忆匹配的详细解释（用于 searchMemorySnapshots 返回）
 */
function buildMatchExplanation(snapshot, reasons) {
  const lines = [
    `记忆 ${snapshot.id} (第${snapshot.round}轮) 因以下原因被匹配:`,
    ...reasons.map((r, i) => `  ${i + 1}. ${r}`),
  ];
  
  const why = snapshot._why || {};
  if (why.causalLink) {
    lines.push(`  📎 存在因果链: →${why.causalLink}`);
  }
  
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════

function translateTrigger(trigger) {
  const map = {
    player_action: "玩家行动",
    scene_change: "场景转换",
    emotional_peak: "情绪高峰",
    conflict_escalation: "冲突升级",
    revelation: "关键揭示",
    routine: "常规推进"
  };
  return map[trigger] || trigger || "未知";
}

// 中文 + 英文关键词提取（简单实现）
const STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "你", "他", "她", "它",
  "有", "就", "也", "和", "这", "那", "不", "都", "要",
  "把", "被", "让", "给", "会", "能", "去", "来", "到",
  "说", "看", "想", "知", "道", "还", "没", "很", "太",
  "但", "而", "或", "与", "及", "上", "下", "里", "中",
  "着", "过", "了", "吗", "呢", "吧", "啊", "哦", "嗯",
  "the", "a", "an", "is", "are", "was", "were", "it", "this",
  "that", "i", "you", "he", "she", "they", "we", "and", "or",
  "in", "on", "at", "to", "for", "of", "with", "by", "from"
]);

function extractKeywords(text = "") {
  if (!text) return [];
  const str = String(text).toLowerCase();
  const chineseBigrams = [];
  const chars = str.replace(/[^\u4e00-\u9fff]/g, " ");
  for (let i = 0; i < chars.length - 1; i++) {
    const bigram = chars.slice(i, i + 2).trim();
    if (bigram.length === 2 && !STOP_WORDS.has(bigram)) {
      chineseBigrams.push(bigram);
    }
  }
  const englishWords = str.match(/[a-z]{2,}/g) || [];
  const singleChars = [...chars].filter(c => c.trim() && !STOP_WORDS.has(c) && c.length === 1);

  const all = [...chineseBigrams, ...englishWords, ...singleChars];
  return [...new Set(all)].slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════
//  序列化
// ═══════════════════════════════════════════════════════════════

export function serializeGlobalMemory() {
  return { snapshots: MEMORY_STORE.snapshots, version: 2 };
}

export function loadGlobalMemory(data = {}) {
  if (data?.snapshots && Array.isArray(data.snapshots)) {
    MEMORY_STORE.snapshots = data.snapshots;
    const maxId = data.snapshots.reduce((max, s) => {
      const num = parseInt((s.id || "mem-0").replace("mem-", ""), 10);
      return num > max ? num : max;
    }, 0);
    memoryIdCounter = maxId;
  }
}

export function getMemoryStats() {
  return {
    total: MEMORY_STORE.snapshots.length,
    maxSize: MEMORY_STORE.maxSize,
    modules: [...new Set(MEMORY_STORE.snapshots.map((s) => s.moduleKey))],
    lastSnapshot: MEMORY_STORE.snapshots.length
      ? MEMORY_STORE.snapshots[MEMORY_STORE.snapshots.length - 1].timestamp
      : null,
    // 🆕 v0.9.0
    withCausalChain: MEMORY_STORE.snapshots.filter((s) => s._why?.causalLink).length,
    confirmedCount: MEMORY_STORE.snapshots.filter((s) => s._provenance?.confidence === "confirmed").length
  };
}
