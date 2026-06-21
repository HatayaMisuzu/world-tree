// ===== Narrative Direction Packet v1 =====
// Director DM 输出的结构化叙事方向包。
// 纯数据结构层，无 LLM 依赖、无引擎依赖。
// 职责：创建、校验、规范化、摘要。

export const PACKET_VERSION = "1.0";

export const PACING_OPTIONS = [
  "hook",           // 开局/低投入→抛锚点钩住玩家
  "hold",           // 保持当前张力，不升不降
  "escalate",       // 升高冲突/压力
  "reveal_partial", // 揭示部分信息，留悬念
  "resolve",        // 解决当前冲突
  "relief",         // 降压/喘息
  "simplify"        // 局势太乱→简化信息量
];

export const PRESSURE_OPTIONS = ["none", "low", "medium", "high"];

export const EVENT_INTENSITY_OPTIONS = ["none", "light", "moderate", "major"];

// ═══════════════════════════════════════════════════════════════
//  创建
// ═══════════════════════════════════════════════════════════════

/**
 * 创建一份空的 Direction Packet
 * @param {string} turnId - 轮次标识
 * @param {string} mode - worldbook | character_card | preset
 * @returns {Object} 标准方向包
 */
export function createDirectionPacket(turnId = "", mode = "worldbook", subType = "classic") {
  const packet = {
    turnId,
    mode,
    gameMode: subType,  // 🆕 classic | tabletop | rpg | sim
    playerAnalysis: {
      intent: "",
      engagement: 5,
      tension: 5,
      fatigue: 5,
      curiosity: 5,
      dominant: "neutral",
      notes: ""
    },
    storyState: {
      currentScene: "",
      currentConflict: "",
      openThreads: [],
      resolvedThreads: [],
      activeCharacters: [],
      relevantMemories: []
    },
    directorDecision: {
      pacing: "hold",
      pressure: "medium",
      eventIntensity: "none",
      sceneGoal: "",
      emotionalTarget: {
        increase: [],
        decrease: [],
        hold: []
      }
    },
    contentPlan: {
      mustInclude: [],
      mayInclude: [],
      mustNotInclude: []
    },
    writingConstraints: {
      style: "",
      length: "medium",
      perspective: "third_person",
      endWith: "",
      choices: "none"
    },
    stateUpdatesExpected: {
      newClues: [],
      relationshipChanges: [],
      sceneStateChanges: [],
      memoryCandidates: []
    },
    debug: {
      source: "director",
      version: PACKET_VERSION,
      confidence: 0.5,
      warnings: [],
      storyteller: "classic"  // 🆕 叙事者ID
    }
  };

  // 🆕 tabletop 专属字段
  if (subType === "tabletop") {
    packet.tabletop = {
      checkHints: [],
      characterState: [],
      encounterActive: false,
      combatRound: 0,
      environment: "wilderness"
    };
  }

  // 🆕 rpg 专属字段
  if (subType === "rpg") {
    packet.rpg = {
      chapter: 1,
      questUpdates: [],
      xpGained: 0,
      bondEvents: [],
      combatActive: false
    };
  }

  // 🆕 sim 专属字段
  if (subType === "sim") {
    packet.sim = {
      timeAdvance: { unit: "day", amount: 1 },
      resourceDelta: {},
      activeDecisions: [],
      reportType: "daily"
    };
  }

  // 🆕 murder-mystery 专属字段
  if (subType === "murder-mystery") {
    packet.murderMystery = {
      caseId: "",
      phase: "briefing",
      revealedClueCount: 0,
      interrogationCount: 0,
      npcSimulated: false
    };
  }

  return packet;
}

// ═══════════════════════════════════════════════════════════════
//  校验
// ═══════════════════════════════════════════════════════════════

const VALID_MODES = ["worldbook", "character_card", "preset"];

/**
 * 校验方向包的字段合法性
 * @param {Object} packet
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDirectionPacket(packet) {
  const errors = [];

  if (!packet || typeof packet !== "object") {
    return { valid: false, errors: ["packet 不是对象"] };
  }

  if (!VALID_MODES.includes(packet.mode)) {
    errors.push(`mode 必须是 ${VALID_MODES.join("/")}，收到: ${packet.mode}`);
  }

  if (!PACING_OPTIONS.includes(packet.directorDecision?.pacing)) {
    errors.push(`pacing 必须是 ${PACING_OPTIONS.join("/")}，收到: ${packet.directorDecision?.pacing}`);
  }

  if (!PRESSURE_OPTIONS.includes(packet.directorDecision?.pressure)) {
    errors.push(`pressure 必须是 ${PRESSURE_OPTIONS.join("/")}，收到: ${packet.directorDecision?.pressure}`);
  }

  if (!EVENT_INTENSITY_OPTIONS.includes(packet.directorDecision?.eventIntensity)) {
    errors.push(`eventIntensity 必须是 ${EVENT_INTENSITY_OPTIONS.join("/")}，收到: ${packet.directorDecision?.eventIntensity}`);
  }

  if (!packet.turnId) errors.push("缺少 turnId");

  const pa = packet.playerAnalysis;
  if (pa) {
    for (const dim of ["engagement", "tension", "fatigue", "curiosity"]) {
      if (pa[dim] != null && (pa[dim] < 0 || pa[dim] > 10)) {
        errors.push(`${dim} 超出 0-10 范围: ${pa[dim]}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
//  规范化
// ═══════════════════════════════════════════════════════════════

/**
 * 补全方向包中缺失的字段，确保所有字段都有合法值
 * @param {Object} packet - 可能不完整的方向包
 * @returns {Object} 补全后的方向包
 */
export function normalizeDirectionPacket(packet) {
  const safe = packet || {};
  const subType = safe.gameMode || "classic";
  const defaults = createDirectionPacket(safe.turnId || "", safe.mode || "worldbook", subType);

  // 深层合并
  const normalized = {
    turnId: safe.turnId || defaults.turnId,
    mode: VALID_MODES.includes(safe.mode) ? safe.mode : defaults.mode,
    gameMode: subType,
    playerAnalysis: {
      ...defaults.playerAnalysis,
      ...(packet?.playerAnalysis || {}),
      emotionalTarget: {
        ...defaults.playerAnalysis.emotionalTarget,
        ...(packet?.playerAnalysis?.emotionalTarget || {})
      }
    },
    storyState: {
      ...defaults.storyState,
      ...(packet?.storyState || {}),
      openThreads: packet?.storyState?.openThreads || defaults.storyState.openThreads,
      resolvedThreads: packet?.storyState?.resolvedThreads || defaults.storyState.resolvedThreads,
      activeCharacters: packet?.storyState?.activeCharacters || defaults.storyState.activeCharacters,
      relevantMemories: packet?.storyState?.relevantMemories || defaults.storyState.relevantMemories
    },
    directorDecision: {
      ...defaults.directorDecision,
      ...(packet?.directorDecision || {}),
      emotionalTarget: {
        ...defaults.directorDecision.emotionalTarget,
        ...(packet?.directorDecision?.emotionalTarget || {})
      }
    },
    contentPlan: {
      ...defaults.contentPlan,
      ...(packet?.contentPlan || {}),
      mustInclude: packet?.contentPlan?.mustInclude || defaults.contentPlan.mustInclude,
      mayInclude: packet?.contentPlan?.mayInclude || defaults.contentPlan.mayInclude,
      mustNotInclude: packet?.contentPlan?.mustNotInclude || defaults.contentPlan.mustNotInclude
    },
    writingConstraints: {
      ...defaults.writingConstraints,
      ...(packet?.writingConstraints || {})
    },
    stateUpdatesExpected: {
      ...defaults.stateUpdatesExpected,
      ...(packet?.stateUpdatesExpected || {}),
      newClues: packet?.stateUpdatesExpected?.newClues || defaults.stateUpdatesExpected.newClues,
      relationshipChanges: packet?.stateUpdatesExpected?.relationshipChanges || defaults.stateUpdatesExpected.relationshipChanges,
      sceneStateChanges: packet?.stateUpdatesExpected?.sceneStateChanges || defaults.stateUpdatesExpected.sceneStateChanges,
      memoryCandidates: packet?.stateUpdatesExpected?.memoryCandidates || defaults.stateUpdatesExpected.memoryCandidates
    },
    debug: {
      ...defaults.debug,
      ...(packet?.debug || {}),
      warnings: packet?.debug?.warnings || defaults.debug.warnings
    }
  };

  // 🆕 tabletop 专属
  if (subType === "tabletop") {
    normalized.tabletop = {
      ...defaults.tabletop,
      ...(packet?.tabletop || {}),
      checkHints: packet?.tabletop?.checkHints || defaults.tabletop.checkHints,
      characterState: packet?.tabletop?.characterState || defaults.tabletop.characterState
    };
  }

  // 🆕 rpg 专属
  if (subType === "rpg") {
    normalized.rpg = {
      ...defaults.rpg,
      ...(packet?.rpg || {}),
      questUpdates: packet?.rpg?.questUpdates || defaults.rpg.questUpdates,
      bondEvents: packet?.rpg?.bondEvents || defaults.rpg.bondEvents
    };
  }

  // 🆕 sim 专属
  if (subType === "sim") {
    normalized.sim = {
      ...defaults.sim,
      ...(packet?.sim || {}),
      activeDecisions: packet?.sim?.activeDecisions || defaults.sim.activeDecisions
    };
  }

  return normalized;
}

// ═══════════════════════════════════════════════════════════════
//  摘要
// ═══════════════════════════════════════════════════════════════

/**
 * 将方向包压缩为一行摘要（给调试用）
 * @param {Object} packet
 * @returns {string}
 */
export function summarizeDirectionPacket(packet) {
  if (!packet) return "无方向包";
  const dd = packet.directorDecision || {};
  const pa = packet.playerAnalysis || {};
  const cp = packet.contentPlan || {};
  const gm = packet.gameMode || "classic";
  return [
    `[${packet.mode}]${gm !== "classic" ? `/${gm}` : ""}`,
    `节奏=${dd.pacing}`,
    `压力=${dd.pressure}`,
    `事件=${dd.eventIntensity}`,
    `情绪(e=${pa.engagement} t=${pa.tension} f=${pa.fatigue} c=${pa.curiosity})`,
    `must=${(cp.mustInclude || []).length}`,
    `mustNot=${(cp.mustNotInclude || []).length}`,
    `目标=${(dd.sceneGoal || "").slice(0, 20)}`
  ].join(" ");
}

/**
 * 将方向包格式化为多行文本（给调试面板/模拟器用）
 * @param {Object} packet
 * @returns {string}
 */
export function formatDirectionPacket(packet) {
  if (!packet) return "无方向包";
  const dd = packet.directorDecision || {};
  const pa = packet.playerAnalysis || {};
  const cp = packet.contentPlan || {};
  const we = packet.writingConstraints || {};
  const se = packet.stateUpdatesExpected || {};

  return [
    `═══ Direction Packet ═══`,
    `模式: ${packet.mode}  |  轮次: ${packet.turnId}`,
    "",
    `─ 玩家分析 ─`,
    `  intent: ${pa.intent || "—"}`,
    `  dominant: ${pa.dominant || "neutral"}`,
    `  情绪: e=${pa.engagement} t=${pa.tension} f=${pa.fatigue} c=${pa.curiosity}`,
    pa.notes ? `  备注: ${pa.notes}` : "",
    "",
    `─ 剧情状态 ─`,
    `  场景: ${packet.storyState?.currentScene || "—"}`,
    `  冲突: ${packet.storyState?.currentConflict || "—"}`,
    `  线索: ${(packet.storyState?.openThreads || []).join(", ") || "无"}`,
    `  记忆: ${(packet.storyState?.relevantMemories || []).length} 条`,
    "",
    `─ 导演决策 ─`,
    `  pacing: ${dd.pacing}`,
    `  pressure: ${dd.pressure}`,
    `  eventIntensity: ${dd.eventIntensity}`,
    `  sceneGoal: ${dd.sceneGoal || "—"}`,
    dd.emotionalTarget?.increase?.length ? `  欲增情绪: ${dd.emotionalTarget.increase.join(", ")}` : "",
    dd.emotionalTarget?.decrease?.length ? `  欲减情绪: ${dd.emotionalTarget.decrease.join(", ")}` : "",
    "",
    `─ 内容计划 ─`,
    `  mustInclude: ${(cp.mustInclude || []).join(", ") || "无"}`,
    `  mayInclude: ${(cp.mayInclude || []).join(", ") || "无"}`,
    `  mustNotInclude: ${(cp.mustNotInclude || []).join(", ") || "无"}`,
    "",
    `─ 写作约束 ─`,
    `  风格: ${we.style || "默认"}  |  长度: ${we.length}  |  视角: ${we.perspective}`,
    `  结尾: ${we.endWith || "自然收束"}  |  选择: ${we.choices}`,
    "",
    `─ 预期状态变化 ─`,
    `  新线索: ${(se.newClues || []).join(", ") || "无"}`,
    `  关系变化: ${(se.relationshipChanges || []).join(", ") || "无"}`,
    `  场景变化: ${(se.sceneStateChanges || []).join(", ") || "无"}`,
    "",
    `debug: ${packet.debug?.warnings?.join("; ") || "无"}`,
    `═══ 结束 ═══`
  ].filter(Boolean).join("\n");
}
