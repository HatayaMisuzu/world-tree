// ===== 五层记忆体系 v1 =====
// 构建于 global-memory.js（快照层）之上，提供分层记忆管理。
//
// 五层架构：
//   L1 短期记忆 (STM)    — 当前对话上下文（最近 N 轮），每轮自动轮转
//   L2 会话记忆 (Session) — 本次冒险重要内容，跨场景保留
//   L3 角色记忆 (Character)— 某角色知道什么（认知边界）
//   L4 世界记忆 (World)   — 已成为世界事实的内容（canon）
//   L5 玩家记忆 (Player)  — 用户偏好/选择/风格（持久化）
//
// 检索优先级：L1 > L2 > L3 > L4 > L5（越近越优先）
// 持久化策略：L1不持久、L2会话级、L3按角色文件、L4世界级、L5跨会话

// ═══════════════════════════════════════════════════════════════
//  内存存储
// ═══════════════════════════════════════════════════════════════

const MEMORY_LAYERS = {
  stm: {
    entries: [],            // 最近对话轮次 [{ round, userInput, narrativeSummary, keywords, emotion }]
    maxEntries: 10,         // 最大保留轮次
    currentRound: 0
  },
  session: {
    entries: [],            // [{ id, type, summary, importance, round, timestamp }]
    keyEvents: [],          // 关键时刻
    decisions: [],          // 玩家决策
    discoveries: []         // 重要发现
  },
  character: {
    // { 角色名: { known: [], suspected: [], unknown: [], misconceptions: [], secrets: [] } }
    maps: {}
  },
  world: {
    entries: [],            // 世界事实 [{ id, fact, source, confidence, category, timestamp }]
    confirmedCount: 0
  },
  player: {
    preferences: {},        // { narrativeStyle, pace, difficulty, etc }
    choices: [],            // 重大选择历史
    patterns: {}            // 行为模式 { favorsAction, avoidsConflict, etc }
  }
};

// ═══════════════════════════════════════════════════════════════
//  L1: 短期记忆
// ═══════════════════════════════════════════════════════════════

/**
 * 追加一轮短期记忆
 */
export function stmPush({ userInput = "", narrativeSummary = "", keywords = [], emotion = {} } = {}) {
  const entry = {
    round: ++MEMORY_LAYERS.stm.currentRound,
    userInput: String(userInput).slice(0, 300),
    narrativeSummary: String(narrativeSummary).slice(0, 300),
    keywords,
    emotion,
    timestamp: new Date().toISOString()
  };
  MEMORY_LAYERS.stm.entries.push(entry);

  // 轮转：超过上限移除最旧
  if (MEMORY_LAYERS.stm.entries.length > MEMORY_LAYERS.stm.maxEntries) {
    const removed = MEMORY_LAYERS.stm.entries.shift();
    // 重要内容升级到 L2
    if (removed.emotion?.intensity === "高" || removed.keywords?.length >= 3) {
      promoteToSession(removed, "stm_overflow");
    }
  }

  return entry;
}

/** 获取最近 N 轮短期记忆 */
export function stmRecent(n = 3) {
  return MEMORY_LAYERS.stm.entries.slice(-n);
}

/** 获取短期记忆上下文（用于 LLM 注入） */
export function stmContext(maxTokens = 1000) {
  const recent = stmRecent(5);
  if (!recent.length) return "";

  return recent.map((e, i) => {
    const label = i === recent.length - 1 ? "【本轮】" : `【前${recent.length - i - 1}轮】`;
    return `${label}\n  玩家: ${e.userInput.slice(0, 120)}\n  叙事: ${e.narrativeSummary.slice(0, 120)}`;
  }).join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  L2: 会话记忆
// ═══════════════════════════════════════════════════════════════

/** 记录会话级重要时刻 */
export function sessionRecord({ type, summary, importance = "medium", keywords = [] }) {
  const entry = {
    id: `session-${Date.now()}`,
    type,                    // event / decision / discovery / emotional_peak / plot_twist
    summary,
    importance,              // low / medium / high / critical
    keywords,
    round: MEMORY_LAYERS.stm.currentRound,
    timestamp: new Date().toISOString()
  };

  MEMORY_LAYERS.session.entries.push(entry);

  if (type === "decision") {
    MEMORY_LAYERS.session.decisions.push(entry);
  } else if (type === "discovery") {
    MEMORY_LAYERS.session.discoveries.push(entry);
  } else if (importance === "high" || importance === "critical") {
    MEMORY_LAYERS.session.keyEvents.push(entry);
  }

  return entry;
}

/** 获取会话摘要 */
export function sessionSummary() {
  const entries = MEMORY_LAYERS.session.entries;
  return {
    totalEvents: entries.length,
    keyEvents: MEMORY_LAYERS.session.keyEvents.slice(-5).map(e => e.summary),
    decisions: MEMORY_LAYERS.session.decisions.slice(-5).map(e => e.summary),
    discoveries: MEMORY_LAYERS.session.discoveries.slice(-5).map(e => e.summary),
    currentRound: MEMORY_LAYERS.stm.currentRound
  };
}

// ═══════════════════════════════════════════════════════════════
//  L3: 角色记忆（每个角色知道什么）
// ═══════════════════════════════════════════════════════════════

/** 初始化某个角色的记忆 */
export function initCharacterMemory(name) {
  if (!MEMORY_LAYERS.character.maps[name]) {
    MEMORY_LAYERS.character.maps[name] = {
      known: [],           // 已知信息
      suspected: [],       // 猜测/怀疑
      unknown: [],         // 明确不知道
      misconceptions: [],  // 误解
      secrets: []          // 角色自身的秘密
    };
  }
  return MEMORY_LAYERS.character.maps[name];
}

/** 角色得知某事（unknown → known） */
export function characterLearns(name, fact, source = "narrative") {
  const mem = initCharacterMemory(name);
  // 从未知列表移除
  mem.unknown = mem.unknown.filter(u => u !== fact);
  // 加入已知
  if (!mem.known.includes(fact)) {
    mem.known.push({ fact, source, learnedAt: new Date().toISOString() });
  }
  // 检查是否修正了误解
  mem.misconceptions = mem.misconceptions.filter(m => m !== fact);
  return mem;
}

/** 角色产生猜测 */
export function characterSuspects(name, suspicion, basis = "") {
  const mem = initCharacterMemory(name);
  mem.suspected.push({ suspicion, basis, at: new Date().toISOString() });
  return mem;
}

/** 角色保持某个秘密 */
export function characterKeepsSecret(name, secret) {
  const mem = initCharacterMemory(name);
  if (!mem.secrets.includes(secret)) {
    mem.secrets.push(secret);
  }
  return mem;
}

/** 获取角色认知摘要（LLM 注入用） */
export function characterMemoryContext(name) {
  const mem = MEMORY_LAYERS.character.maps[name];
  if (!mem) return "";

  const lines = [];
  if (mem.known.length) {
    lines.push(`  已知: ${mem.known.slice(-5).map(k => typeof k === 'object' ? k.fact : k).join('; ')}`);
  }
  if (mem.suspected.length) {
    lines.push(`  猜测: ${mem.suspected.slice(-3).map(s => s.suspicion).join('; ')}`);
  }
  if (mem.misconceptions.length) {
    lines.push(`  误解: ${mem.misconceptions.join('; ')}`);
  }
  if (mem.secrets.length) {
    lines.push(`  秘密: ${mem.secrets.join('; ')}（不向其他角色透露）`);
  }

  return lines.length ? `【${name} 的认知】\n${lines.join('\n')}` : "";
}

// ═══════════════════════════════════════════════════════════════
//  L4: 世界记忆
// ═══════════════════════════════════════════════════════════════

/**
 * 确认一个世界事实
 * @param {string} fact - 事实描述
 * @param {string} source - 来源（narrative / player / guardian / canon）
 * @param {string} confidence - confirmed / likely / speculative
 * @param {string} category - character / location / rule / event / relation
 */
export function confirmWorldFact(fact, source = "narrative", confidence = "confirmed", category = "event") {
  const entry = {
    id: `world-${Date.now()}`,
    fact,
    source,
    confidence,
    category,
    round: MEMORY_LAYERS.stm.currentRound,
    timestamp: new Date().toISOString()
  };

  MEMORY_LAYERS.world.entries.push(entry);
  if (confidence === "confirmed") {
    MEMORY_LAYERS.world.confirmedCount++;
  }

  return entry;
}

/** 检索世界事实 */
export function queryWorldFacts(keyword = "", category = "", limit = 10) {
  let results = MEMORY_LAYERS.world.entries;

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    results = results.filter(e => e.fact.toLowerCase().includes(kw));
  }
  if (category) {
    results = results.filter(e => e.category === category);
  }

  return results.slice(-limit).reverse();
}

/** 获取世界事实摘要 */
export function worldFactsSummary(limit = 20) {
  const confirmed = MEMORY_LAYERS.world.entries.filter(e => e.confidence === "confirmed").slice(-limit);
  return confirmed.map(e => `• ${e.fact}`).join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  L5: 玩家记忆
// ═══════════════════════════════════════════════════════════════

/** 记录玩家偏好 */
export function setPlayerPreference(key, value) {
  MEMORY_LAYERS.player.preferences[key] = {
    value,
    updatedAt: new Date().toISOString()
  };
}

/** 获取玩家偏好 */
export function getPlayerPreference(key) {
  return MEMORY_LAYERS.player.preferences[key]?.value ?? null;
}

/** 记录重大选择 */
export function recordPlayerChoice({ context, choice, rejectedOptions = [], outcome = "" }) {
  MEMORY_LAYERS.player.choices.push({
    context,
    choice,
    rejectedOptions,
    outcome,
    round: MEMORY_LAYERS.stm.currentRound,
    at: new Date().toISOString()
  });
}

/** 更新玩家行为模式 */
export function updatePlayerPattern(patternKey, value) {
  const existing = MEMORY_LAYERS.player.patterns[patternKey];
  if (existing) {
    existing.count = (existing.count || 0) + 1;
    existing.lastObserved = new Date().toISOString();
  } else {
    MEMORY_LAYERS.player.patterns[patternKey] = {
      value,
      count: 1,
      firstObserved: new Date().toISOString(),
      lastObserved: new Date().toISOString()
    };
  }
}

/** 获取玩家风格摘要 */
export function playerStyleSummary() {
  const prefs = MEMORY_LAYERS.player.preferences;
  const patterns = MEMORY_LAYERS.player.patterns;
  const significantPatterns = Object.entries(patterns)
    .filter(([_, p]) => p.count >= 3)
    .map(([k, p]) => `${k}: ${p.value} (${p.count}次)`);

  return {
    preferences: Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, v.value])),
    significantPatterns,
    totalChoices: MEMORY_LAYERS.player.choices.length,
    recentChoices: MEMORY_LAYERS.player.choices.slice(-3).map(c => `${c.context}: ${c.choice}`)
  };
}

// ═══════════════════════════════════════════════════════════════
//  跨层检索
// ═══════════════════════════════════════════════════════════════

/**
 * 跨层检索：按关键词在所有层中查找相关内容
 * 检索优先级：L1 → L2 → L3 → L4 → L5
 */
export function crossLayerSearch(keyword, layers = "all") {
  const results = [];
  const kw = String(keyword).toLowerCase();

  if (layers === "all" || layers === "L1") {
    const stm = MEMORY_LAYERS.stm.entries.filter(e =>
      e.userInput.toLowerCase().includes(kw) ||
      e.narrativeSummary.toLowerCase().includes(kw) ||
      (e.keywords || []).some(k => k.toLowerCase().includes(kw))
    );
    results.push(...stm.map(e => ({ layer: "L1", source: "短期记忆", content: e.narrativeSummary || e.userInput, round: e.round })));
  }

  if (layers === "all" || layers === "L2") {
    const session = MEMORY_LAYERS.session.entries.filter(e =>
      e.summary.toLowerCase().includes(kw) ||
      (e.keywords || []).some(k => k.toLowerCase().includes(kw))
    );
    results.push(...session.map(e => ({ layer: "L2", source: "会话记忆", content: e.summary, importance: e.importance })));
  }

  if (layers === "all" || layers === "L3") {
    for (const [name, mem] of Object.entries(MEMORY_LAYERS.character.maps)) {
      const knownHits = (mem.known || []).filter(k => {
        const text = typeof k === 'object' ? k.fact : k;
        return text.toLowerCase().includes(kw);
      });
      results.push(...knownHits.map(k => ({
        layer: "L3", source: `角色记忆(${name})`,
        content: typeof k === 'object' ? k.fact : k
      })));
    }
  }

  if (layers === "all" || layers === "L4") {
    const world = MEMORY_LAYERS.world.entries.filter(e =>
      e.fact.toLowerCase().includes(kw)
    );
    results.push(...world.map(e => ({ layer: "L4", source: "世界记忆", content: e.fact, confidence: e.confidence })));
  }

  if (layers === "all" || layers === "L5") {
    const choices = MEMORY_LAYERS.player.choices.filter(c =>
      c.context.toLowerCase().includes(kw) || c.choice.toLowerCase().includes(kw)
    );
    results.push(...choices.map(c => ({ layer: "L5", source: "玩家选择", content: `${c.context}: ${c.choice}` })));
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
//  LLM 上下文构建
// ═══════════════════════════════════════════════════════════════

/**
 * 构建分层记忆上下文（用于 LLM prompt）
 * @param {Object} opts
 * @param {number} opts.stmRounds - 短期记忆轮数
 * @param {boolean} opts.includeSession - 是否包含会话记忆
 * @param {string[]} opts.characterNames - 需要包含认知的角色名
 * @param {boolean} opts.includeWorld - 是否包含世界事实
 * @returns {string} 格式化记忆上下文
 */
export function buildMemoryContext({
  stmRounds = 3,
  includeSession = true,
  characterNames = [],
  includeWorld = false
} = {}) {
  const sections = [];

  // L1: 短期记忆
  const stm = stmRecent(stmRounds);
  if (stm.length) {
    sections.push("【近期对话】");
    for (const e of stm) {
      sections.push(`[第${e.round}轮] ${e.userInput.slice(0, 150)}`);
    }
  }

  // L2: 会话记忆
  if (includeSession && MEMORY_LAYERS.session.keyEvents.length) {
    sections.push("【本次冒险关键事件】");
    for (const e of MEMORY_LAYERS.session.keyEvents.slice(-5)) {
      sections.push(`  • ${e.summary}`);
    }
  }

  // L3: 角色认知
  for (const name of characterNames) {
    const ctx = characterMemoryContext(name);
    if (ctx) sections.push(ctx);
  }

  // L4: 世界事实
  if (includeWorld) {
    const facts = worldFactsSummary(5);
    if (facts) {
      sections.push("【世界事实】");
      sections.push(facts);
    }
  }

  return sections.join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  存储管理
// ═══════════════════════════════════════════════════════════════

/** 重置所有记忆层（用于新模组/新会话） */
export function resetMemoryLayers() {
  MEMORY_LAYERS.stm.entries = [];
  MEMORY_LAYERS.stm.currentRound = 0;
  MEMORY_LAYERS.session.entries = [];
  MEMORY_LAYERS.session.keyEvents = [];
  MEMORY_LAYERS.session.decisions = [];
  MEMORY_LAYERS.session.discoveries = [];
  // 注意：L3 和 L5 不自动重置（角色认知和玩家偏好跨会话保留）
}

/** 完全重置（包括角色和玩家记忆） */
export function resetAllMemoryLayers() {
  resetMemoryLayers();
  MEMORY_LAYERS.character.maps = {};
  MEMORY_LAYERS.world.entries = [];
  MEMORY_LAYERS.world.confirmedCount = 0;
  MEMORY_LAYERS.player.choices = [];
}

/** 导出全部记忆快照 */
export function exportMemorySnapshot() {
  return {
    layers: {
      stm: { entries: MEMORY_LAYERS.stm.entries, currentRound: MEMORY_LAYERS.stm.currentRound },
      session: {
        entries: MEMORY_LAYERS.session.entries.slice(-30),
        keyEvents: MEMORY_LAYERS.session.keyEvents.slice(-10),
        decisions: MEMORY_LAYERS.session.decisions.slice(-10)
      },
      character: MEMORY_LAYERS.character.maps,
      world: {
        entries: MEMORY_LAYERS.world.entries.slice(-100),
        confirmedCount: MEMORY_LAYERS.world.confirmedCount
      },
      player: {
        preferences: MEMORY_LAYERS.player.preferences,
        patterns: MEMORY_LAYERS.player.patterns,
        choicesCount: MEMORY_LAYERS.player.choices.length
      }
    },
    stats: {
      totalStm: MEMORY_LAYERS.stm.entries.length,
      totalSession: MEMORY_LAYERS.session.entries.length,
      totalCharacterMaps: Object.keys(MEMORY_LAYERS.character.maps).length,
      totalWorldFacts: MEMORY_LAYERS.world.entries.length,
      confirmedWorldFacts: MEMORY_LAYERS.world.confirmedCount,
      totalPlayerChoices: MEMORY_LAYERS.player.choices.length
    },
    exportedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════
//  内部：STM → Session 升级
// ═══════════════════════════════════════════════════════════════

function promoteToSession(stmEntry, reason = "stm_overflow") {
  sessionRecord({
    type: "event",
    summary: stmEntry.narrativeSummary || stmEntry.userInput,
    importance: "medium",
    keywords: stmEntry.keywords || []
  });
}
