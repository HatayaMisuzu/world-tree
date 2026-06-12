// ===== 世界状态系统 v2 =====
// v1: 简单 merge/diff（保留向下兼容）
// v2: 八维状态面板 + 每轮快照 + 状态变化追踪 + 未解决事件
//
// 八个维度：
//   1. 当前地点 (currentLocation)
//   2. 当前时间 (currentTime)
//   3. 出场角色 (activeCharacters)
//   4. 当前冲突 (currentConflict)
//   5. 已知线索 (knownClues)
//   6. 角色情绪 (characterEmotions)
//   7. 世界状态变化 (worldChanges)
//   8. 未解决事件 (unresolvedEvents)

// ═══════════════════════════════════════════════════════════════
//  v1 兼容层（保留原有 API）
// ═══════════════════════════════════════════════════════════════

export function mergeWorldState(base = {}, overlay = {}) {
  return {
    ...base,
    ...overlay,
    variables: { ...(base.variables || {}), ...(overlay.variables || {}) },
    events: [...(base.events || []), ...(overlay.events || [])]
  };
}

export function diffWorldState(before = {}, after = {}) {
  const changed = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      changed[key] = { before: before[key], after: after[key] };
  }
  return changed;
}

// ═══════════════════════════════════════════════════════════════
//  v2: 八维状态面板
// ═══════════════════════════════════════════════════════════════

/** 创建空白状态面板 */
export function createWorldPanel() {
  return {
    version: 2,
    currentLocation: {
      name: "",
      description: "",
      type: "",               // 室内/室外/城镇/野外/地牢等
      region: "",
      features: [],           // 显著特征
      atmosphere: "",         // 氛围
      exits: []               // 可前往的地点
    },
    currentTime: {
      display: "",            // 人读时间 "第3天 黄昏"
      absolute: "",           // 绝对时间 ISO
      dayPhase: "",           // 黎明/早晨/上午/中午/下午/傍晚/夜晚/深夜/凌晨
      dayNumber: 0,
      season: "",
      weather: ""
    },
    activeCharacters: [],     // [{ name, location, status, mood, lastAction }]
    currentConflict: {
      type: "",               // 战斗/辩论/追捕/潜伏/谈判/无
      parties: [],            // 参与方
      intensity: "无",        // 潜伏/暗流/公开/爆发/收束
      stakes: "",             // 冲突赌注
      startedAt: null
    },
    knownClues: [],           // [{ id, description, source, verified, leadsTo[], discoveredAt }]
    characterEmotions: {},    // { 角色名: { emotion, intensity, reason, changedAt } }
    worldChanges: [],         // 本轮世界变化 [{ type, description, affectedEntities[], round }]
    unresolvedEvents: [],     // [{ id, description, urgency, since, relatedClues[] }]
    roundNumber: 0,
    lastUpdated: null,
    snapshotHistory: []       // 最近 N 轮的状态快照（用于回溯）
  };
}

// ═══════════════════════════════════════════════════════════════
//  地点
// ═══════════════════════════════════════════════════════════════

export function setLocation(panel, location) {
  const prev = panel.currentLocation.name;
  panel.currentLocation = {
    ...panel.currentLocation,
    ...location,
    updatedAt: new Date().toISOString()
  };
  if (prev && prev !== location.name) {
    addWorldChange(panel, {
      type: "location_change",
      description: `地点从「${prev}」变更为「${location.name}」`,
      affectedEntities: panel.activeCharacters.map(c => c.name)
    });
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  时间
// ═══════════════════════════════════════════════════════════════

export function advanceTime(panel, timeUpdate = {}) {
  const prevDay = panel.currentTime.dayNumber;
  const prevPhase = panel.currentTime.dayPhase;
  panel.currentTime = {
    ...panel.currentTime,
    ...timeUpdate,
    updatedAt: new Date().toISOString()
  };
  if (prevDay !== timeUpdate.dayNumber) {
    addWorldChange(panel, {
      type: "time_advance",
      description: `时间推进到第 ${timeUpdate.dayNumber || prevDay + 1} 天`,
      affectedEntities: []
    });
  }
  if (prevPhase !== timeUpdate.dayPhase && timeUpdate.dayPhase) {
    addWorldChange(panel, {
      type: "day_phase",
      description: `时段变为「${timeUpdate.dayPhase}」`,
      affectedEntities: []
    });
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  角色
// ═══════════════════════════════════════════════════════════════

export function updateCharacters(panel, characters = []) {
  for (const ch of characters) {
    const existing = panel.activeCharacters.find(c => c.name === ch.name);
    if (existing) {
      Object.assign(existing, ch, { updatedAt: new Date().toISOString() });
    } else {
      panel.activeCharacters.push({
        ...ch,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      addWorldChange(panel, {
        type: "character_join",
        description: `「${ch.name}」进入场景`,
        affectedEntities: [ch.name]
      });
    }
  }
  return panel;
}

export function removeCharacter(panel, name) {
  const idx = panel.activeCharacters.findIndex(c => c.name === name);
  if (idx >= 0) {
    panel.activeCharacters.splice(idx, 1);
    addWorldChange(panel, {
      type: "character_leave",
      description: `「${name}」离开场景`,
      affectedEntities: [name]
    });
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  冲突
// ═══════════════════════════════════════════════════════════════

export function updateConflict(panel, conflict = {}) {
  const prevIntensity = panel.currentConflict.intensity;
  panel.currentConflict = {
    ...panel.currentConflict,
    ...conflict,
    updatedAt: new Date().toISOString()
  };
  if (conflict.type && !panel.currentConflict.startedAt) {
    panel.currentConflict.startedAt = new Date().toISOString();
  }
  if (prevIntensity !== conflict.intensity && conflict.intensity) {
    addWorldChange(panel, {
      type: "conflict_escalation",
      description: `冲突强度：${prevIntensity || '无'} → ${conflict.intensity}`,
      affectedEntities: conflict.parties || []
    });
  }
  if (conflict.intensity === "收束") {
    panel.currentConflict.startedAt = null;
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  线索
// ═══════════════════════════════════════════════════════════════

export function addClue(panel, clue) {
  const existing = panel.knownClues.find(c => c.description === clue.description);
  if (existing) {
    existing.verified = clue.verified ?? existing.verified;
    if (clue.leadsTo) existing.leadsTo = [...new Set([...(existing.leadsTo || []), ...clue.leadsTo])];
  } else {
    panel.knownClues.push({
      id: clue.id || `clue-${Date.now()}`,
      description: clue.description,
      source: clue.source || "叙事",
      verified: clue.verified ?? false,
      leadsTo: clue.leadsTo || [],
      discoveredAt: new Date().toISOString()
    });
    addWorldChange(panel, {
      type: "clue_discovered",
      description: `发现线索: ${clue.description.slice(0, 60)}`,
      affectedEntities: []
    });
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  情绪
// ═══════════════════════════════════════════════════════════════

export function setCharacterEmotion(panel, name, emotion, intensity = "中", reason = "") {
  const prev = panel.characterEmotions[name];
  panel.characterEmotions[name] = {
    emotion,
    intensity,         // 低/中/高/极高
    reason,
    changedAt: new Date().toISOString(),
    previousEmotion: prev ? prev.emotion : null
  };
  return panel;
}

export function batchSetEmotions(panel, emotionMap = {}) {
  for (const [name, data] of Object.entries(emotionMap)) {
    setCharacterEmotion(panel, name, data.emotion, data.intensity, data.reason);
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  世界变化
// ═══════════════════════════════════════════════════════════════

function addWorldChange(panel, change) {
  panel.worldChanges.push({
    ...change,
    round: panel.roundNumber,
    timestamp: new Date().toISOString()
  });
  // 保留最近 30 条
  if (panel.worldChanges.length > 30) {
    panel.worldChanges = panel.worldChanges.slice(-30);
  }
}

// ═══════════════════════════════════════════════════════════════
//  未解决事件
// ═══════════════════════════════════════════════════════════════

export function addUnresolvedEvent(panel, event) {
  panel.unresolvedEvents.push({
    id: event.id || `uevent-${Date.now()}`,
    description: event.description,
    urgency: event.urgency || "中",       // 低/中/高/紧急
    since: new Date().toISOString(),
    relatedClues: event.relatedClues || [],
    resolved: false
  });
  return panel;
}

export function resolveEvent(panel, eventId) {
  const ev = panel.unresolvedEvents.find(e => e.id === eventId);
  if (ev) {
    ev.resolved = true;
    ev.resolvedAt = new Date().toISOString();
  }
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  快照与回溯
// ═══════════════════════════════════════════════════════════════

/** 创建当前轮次的状态快照 */
export function takeSnapshot(panel) {
  const snapshot = {
    round: panel.roundNumber,
    location: panel.currentLocation.name,
    time: panel.currentTime.display,
    characters: panel.activeCharacters.map(c => ({ name: c.name, status: c.status, mood: c.mood })),
    conflict: panel.currentConflict.type ? { ...panel.currentConflict } : null,
    cluesCount: panel.knownClues.length,
    unresolvedCount: panel.unresolvedEvents.filter(e => !e.resolved).length,
    emotions: { ...panel.characterEmotions },
    timestamp: new Date().toISOString()
  };
  panel.snapshotHistory.push(snapshot);
  // 保留最近 20 条快照
  if (panel.snapshotHistory.length > 20) {
    panel.snapshotHistory = panel.snapshotHistory.slice(-20);
  }
  return snapshot;
}

/** 获取两轮之间的变化摘要 */
export function diffSnapshots(panel, fromRound, toRound) {
  const from = panel.snapshotHistory.find(s => s.round === fromRound);
  const to = panel.snapshotHistory.find(s => s.round === toRound);
  if (!from || !to) return null;

  const changes = [];
  if (from.location !== to.location) changes.push(`地点: ${from.location} → ${to.location}`);
  if (from.time !== to.time) changes.push(`时间: ${from.time} → ${to.time}`);
  const fromNames = from.characters.map(c => c.name);
  const toNames = to.characters.map(c => c.name);
  const joined = toNames.filter(n => !fromNames.includes(n));
  const left = fromNames.filter(n => !toNames.includes(n));
  if (joined.length) changes.push(`新出场: ${joined.join(', ')}`);
  if (left.length) changes.push(`离场: ${left.join(', ')}`);

  return { fromRound, toRound, changes, summary: changes.join('; ') || '无显著变化' };
}

// ═══════════════════════════════════════════════════════════════
//  每轮 tick：更新轮次 + 创建快照
// ═══════════════════════════════════════════════════════════════

export function tickWorldPanel(panel, roundNumber) {
  panel.roundNumber = roundNumber;
  panel.lastUpdated = new Date().toISOString();
  takeSnapshot(panel);
  return panel;
}

// ═══════════════════════════════════════════════════════════════
//  摘要生成（供 LLM 上下文注入）
// ═══════════════════════════════════════════════════════════════

export function worldStateSummary(panel, detail = "standard") {
  if (!panel || !panel.currentLocation) return "世界状态未初始化。";

  const lines = ["【世界状态面板】"];

  // 地点 + 时间
  lines.push(`📍 ${panel.currentLocation.name || "未知地点"}  |  🕐 ${panel.currentTime.display || "时间未设定"}`);
  if (panel.currentTime.weather) lines.push(`   天气: ${panel.currentTime.weather}  |  季节: ${panel.currentTime.season || "未设定"}`);

  // 出场角色
  if (panel.activeCharacters.length) {
    const chars = panel.activeCharacters.map(c =>
      `${c.name}${c.status ? `[${c.status}]` : ''}${c.mood ? `(${c.mood})` : ''}`
    ).join(', ');
    lines.push(`👥 出场: ${chars}`);
  }

  // 冲突
  if (panel.currentConflict.type && panel.currentConflict.type !== "无") {
    lines.push(`⚔️ 冲突: ${panel.currentConflict.type} (${panel.currentConflict.intensity})${panel.currentConflict.stakes ? ` - 赌注: ${panel.currentConflict.stakes}` : ''}`);
  }

  // 情绪（仅 detail=full 时展开）
  if (detail === "full" && Object.keys(panel.characterEmotions).length) {
    const emotions = Object.entries(panel.characterEmotions)
      .map(([name, e]) => `${name}: ${e.emotion}(${e.intensity})`)
      .join(' | ');
    lines.push(`💭 情绪: ${emotions}`);
  }

  // 线索
  if (panel.knownClues.length) {
    const unverified = panel.knownClues.filter(c => !c.verified);
    lines.push(`🔍 线索: ${panel.knownClues.length} 条 (${unverified.length} 条待验证)`);
    if (detail === "full" && panel.knownClues.length <= 5) {
      for (const clue of panel.knownClues) {
        lines.push(`   ${clue.verified ? '✓' : '?'} ${clue.description.slice(0, 80)}`);
      }
    }
  }

  // 未解决事件
  const unresolved = panel.unresolvedEvents.filter(e => !e.resolved);
  if (unresolved.length) {
    const urgent = unresolved.filter(e => e.urgency === "紧急" || e.urgency === "高");
    lines.push(`📌 未解决事件: ${unresolved.length} 个${urgent.length ? ` (${urgent.length} 个紧急)` : ''}`);
  }

  // 最近变化
  const recentChanges = panel.worldChanges.slice(-3);
  if (recentChanges.length && detail === "full") {
    lines.push(`🔄 最近变化:`);
    for (const c of recentChanges) {
      lines.push(`   [第${c.round}轮] ${c.description}`);
    }
  }

  return lines.join('\n');
}

/** 紧凑摘要（低 token 模式） */
export function worldStateCompact(panel) {
  if (!panel || !panel.currentLocation) return "";
  const parts = [
    panel.currentLocation.name || "?",
    panel.currentTime.display || "",
    `${panel.activeCharacters.length}人`,
  ];
  if (panel.currentConflict.type && panel.currentConflict.type !== "无") parts.push(`冲突:${panel.currentConflict.type}`);
  const unresolved = panel.unresolvedEvents.filter(e => !e.resolved).length;
  if (unresolved) parts.push(`${unresolved}待解决`);
  return parts.join(' | ');
}
