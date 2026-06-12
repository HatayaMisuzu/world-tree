// ===== 存档运行时快照 v2 =====
// v2 增强：按 worldSubType 模式隔离 + tabletop 角色卡持久化

/**
 * 收集当前运行时状态
 * @param {Object} engineState - 引擎状态
 * @param {Object} [extra] - 外部缓存数据
 * @param {Object} [extra.predictionCache]
 * @param {Array} [extra.eventHistory]
 * @param {Object} [extra.characterSheets] - tabletop 模式角色卡
 * @param {Array} [extra.encounterLog] - tabletop 遭遇历史
 * @returns {Object}
 */
export function collectRuntimeSnapshot(engineState = {}, extra = {}) {
  const subType = engineState.worldSubType || "classic";
  const snap = {
    version: 2,
    collectedAt: new Date().toISOString(),
    subType,                     // 🆕 classic | tabletop | rpg | sim
    emotion: engineState.emotionState
      ? { ...engineState.emotionState }
      : { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
    lastEventRound: engineState.lastEventRound || 0,
    predictionCache: extra.predictionCache || null,
    eventHistory: extra.eventHistory || null,
    turnCount: engineState.turnCount || 0,
    sceneSummary: engineState.sceneSummary || ""
  };

  // 🆕 tabletop 专属数据
  if (subType === "tabletop") {
    snap.characterSheets = Array.isArray(extra.characterSheets) ? extra.characterSheets : [];
    snap.encounterLog = Array.isArray(extra.encounterLog) ? extra.encounterLog : [];
    snap.combatState = extra.combatState || null;
  }

  // 🆕 rpg 专属数据
  if (subType === "rpg") {
    snap.quests = Array.isArray(extra.quests) ? extra.quests : [];
    snap.bonds = Array.isArray(extra.bonds) ? extra.bonds : [];
    snap.chapters = Array.isArray(extra.chapters) ? extra.chapters : [];
    snap.party = Array.isArray(extra.party) ? extra.party : [];
  }

  // 🆕 sim 专属数据
  if (subType === "sim") {
    snap.resources = extra.resources || null;
    snap.calendar = extra.calendar || null;
    snap.activeDecisions = Array.isArray(extra.activeDecisions) ? extra.activeDecisions : [];
    snap.npcLoyalties = Array.isArray(extra.npcLoyalties) ? extra.npcLoyalties : [];
  }

  // 🆕 murder-mystery 专属数据
  if (subType === "murder-mystery") {
    snap.caseId = extra.caseId || "";
    snap.revealedClues = Array.isArray(extra.revealedClues) ? extra.revealedClues : [];
    snap.interrogatedSuspects = extra.interrogatedSuspects || {};
    snap.accusation = extra.accusation || null;
    snap.score = extra.score || null;
    snap.phase = extra.phase || "briefing";
  }

  return snap;
}

/**
 * 恢复运行时快照到引擎状态
 */
export function restoreRuntimeSnapshot(snapshot = {}, engineState = {}) {
  if (!snapshot || !snapshot.version) return engineState;

  const state = { ...engineState };

  if (snapshot.emotion) {
    state.emotionState = { ...snapshot.emotion };
  }
  if (snapshot.lastEventRound != null) {
    state.lastEventRound = snapshot.lastEventRound;
  }
  if (snapshot.worldSubType) {
    state.worldSubType = snapshot.worldSubType;
  }
  if (snapshot.turnCount != null) {
    state.turnCount = snapshot.turnCount;
  }
  if (snapshot.sceneSummary) {
    state.sceneSummary = snapshot.sceneSummary;
  }

  // 🆕 tabletop 专属恢复
  if (snapshot.subType === "tabletop") {
    state.characterSheets = Array.isArray(snapshot.characterSheets) ? snapshot.characterSheets : [];
    state.encounterLog = Array.isArray(snapshot.encounterLog) ? snapshot.encounterLog : [];
    state.combatState = snapshot.combatState || null;
  }

  // 🆕 rpg 专属恢复
  if (snapshot.subType === "rpg") {
    state.quests = Array.isArray(snapshot.quests) ? snapshot.quests : [];
    state.bonds = Array.isArray(snapshot.bonds) ? snapshot.bonds : [];
    state.chapters = Array.isArray(snapshot.chapters) ? snapshot.chapters : [];
    state.party = Array.isArray(snapshot.party) ? snapshot.party : [];
  }

  // 🆕 sim 专属恢复
  if (snapshot.subType === "sim") {
    state.resources = snapshot.resources || null;
    state.calendar = snapshot.calendar || null;
    state.activeDecisions = Array.isArray(snapshot.activeDecisions) ? snapshot.activeDecisions : [];
    state.npcLoyalties = Array.isArray(snapshot.npcLoyalties) ? snapshot.npcLoyalties : [];
  }

  // 🆕 murder-mystery 专属恢复
  if (snapshot.subType === "murder-mystery") {
    state.caseId = snapshot.caseId || "";
    state.revealedClues = Array.isArray(snapshot.revealedClues) ? snapshot.revealedClues : [];
    state.interrogatedSuspects = snapshot.interrogatedSuspects || {};
    state.accusation = snapshot.accusation || null;
    state.score = snapshot.score || null;
    state.gamePhase = snapshot.phase || "briefing";
  }

  // predictionCache / eventHistory 由调用方恢复
  return state;
}

/**
 * 嵌入存档对象中
 */
export function embedRuntimeInArchive(archiveData = {}, runtimeSnapshot = {}) {
  return {
    ...archiveData,
    _runtime: runtimeSnapshot,
    _isolated: true,
    _isolatedVersion: 2,
    _subType: runtimeSnapshot.subType || "classic"   // 🆕 存档级 subType 标记
  };
}

/**
 * 从存档提取运行时快照
 */
export function extractRuntimeFromArchive(archiveData = {}) {
  return archiveData._runtime || null;
}

/**
 * 检查存档隔离完整性
 */
export function hasIsolatedRuntime(archiveData = {}) {
  return Boolean(archiveData._isolated && archiveData._runtime);
}

/**
 * 🆕 验证存档 subType 与当前模式匹配
 * @returns {{ match: boolean, expected: string, actual: string }}
 */
export function validateSubType(archiveData = {}, currentSubType = "classic") {
  const savedSubType = archiveData._subType || archiveData._runtime?.subType || "classic";
  return {
    match: savedSubType === currentSubType,
    expected: currentSubType,
    actual: savedSubType
  };
}

/**
 * 🆕 模式切换时重置所有模式专属状态
 * @param {Object} engineState - 会被就地修改
 * @param {string} toSubType
 * @returns {Object} 更新后的 engineState
 */
export function resetForSubType(engineState = {}, toSubType = "classic") {
  const state = { ...engineState, worldSubType: toSubType };

  // 清空所有旧模式的专属数据
  delete state.characterSheets; delete state.encounterLog; delete state.combatState;
  delete state.quests; delete state.bonds; delete state.chapters; delete state.party;
  delete state.resources; delete state.calendar; delete state.activeDecisions; delete state.npcLoyalties;
  delete state.caseId; delete state.revealedClues; delete state.interrogatedSuspects; delete state.accusation; delete state.score; delete state.gamePhase;

  // 重置情绪到中性
  state.emotionState = { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 };
  state.lastEventRound = 0;
  state.turnCount = 0;

  return state;
}
