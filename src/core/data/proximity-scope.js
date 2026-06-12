// ===== 主角邻近激活系统 (Proximity Scope) =====
// 三维模型: 地点 × 时间 × 关系 → 激活环
// 核心: 距离主角越近，表现力越强，调用模块越活跃，越立体
// 边缘: 距离越远越简化，逐步进入沉睡模式
// 随机激活: 根据主角状态+剧情需求，在适当时机唤醒沉睡实体

// ---- 邻近环级别 ----
export const PROXIMITY_RINGS = {
  CORE:    { level: 0, name: "核心",   range: [0, 0.25],  behavior: "full",     description: "当前场景中直接互动的角色/物品/事件。全部模块活跃，表现力最强。" },
  NEAR:    { level: 1, name: "邻近",   range: [0.25, 0.5], behavior: "detailed", description: "同区域/近期/熟人。大部分模块活跃，细节丰富但不占用核心篇幅。" },
  FAR:     { level: 2, name: "远端",   range: [0.5, 0.75], behavior: "summary",  description: "同世界/历史/间接关联。仅简略引用，不展开细节。" },
  SLEEP:   { level: 3, name: "沉睡",   range: [0.75, 1.0], behavior: "dormant",  description: "暂不活跃。保留档案，等待随机激活或剧情触发唤醒。" }
};

// ---- 实体类型 ----
export const ENTITY_TYPES = {
  CHARACTER:    "character",
  ITEM:         "item", 
  ORGANIZATION: "organization",
  EVENT:        "event",
  LOCATION:     "location"
};

// ---- 三维坐标轴 ----
export const PROXIMITY_AXES = {
  location: {
    name: "地点",
    levels: {
      sameScene:    { value: 0.0, label: "同一场景" },
      sameArea:     { value: 0.2, label: "同一区域" },
      sameRegion:   { value: 0.4, label: "同一地区" },
      sameWorld:    { value: 0.6, label: "同世界·远处" },
      unknown:      { value: 0.8, label: "未知位置" }
    }
  },
  time: {
    name: "时间",
    levels: {
      present:      { value: 0.0, label: "当前时刻" },
      recent:       { value: 0.15, label: "近期(本周内)" },
      nearPast:     { value: 0.3, label: "不远(本月内)" },
      past:         { value: 0.5, label: "过去(本年)" },
      distant:      { value: 0.7, label: "遥远(数年前)" },
      legend:       { value: 0.85, label: "传说/历史" }
    }
  },
  relationship: {
    name: "关系",
    levels: {
      intimate:     { value: 0.0, label: "亲密(挚友/家人/恋人)" },
      close:        { value: 0.15, label: "亲近(朋友/盟友/常伴)" },
      acquainted:   { value: 0.3, label: "认识(打过交道)" },
      indirect:     { value: 0.5, label: "间接(通过他人关联)" },
      known:        { value: 0.7, label: "知道(听说过)" },
      stranger:     { value: 0.9, label: "陌生(无交集)" }
    }
  }
};

// ---- 实体注册 ----
export function createEntity(id, type, props = {}) {
  return {
    id,
    type,
    name: props.name || id,
    // 三维坐标
    location: props.location || "unknown",
    time: props.time || "present",
    relationship: props.relationship || "stranger",
    // 元数据
    description: props.description || "",
    tags: props.tags || [],
    // 唤醒条件
    wakeTriggers: props.wakeTriggers || [],
    // 激活状态
    proximity: PROXIMITY_RINGS.SLEEP,
    lastActive: null,
    activeCount: 0
  };
}

// ---- 三维加权计算 ----
export function calculateProximityScore(entity = {}, protagonist = {}) {
  const locScore = resolveAxisScore(PROXIMITY_AXES.location, entity.location, protagonist);
  const timeScore = resolveAxisScore(PROXIMITY_AXES.time, entity.time, protagonist);
  const relScore = resolveAxisScore(PROXIMITY_AXES.relationship, entity.relationship, protagonist);

  // 权重: 地点 0.4 / 时间 0.25 / 关系 0.35
  const weighted = (locScore * 0.4) + (timeScore * 0.25) + (relScore * 0.35);
  return Math.min(1.0, Math.max(0.0, weighted));
}

function resolveAxisScore(axis, entityValue, protagonist) {
  // 如果实体值直接是数字，直接使用
  if (typeof entityValue === "number") return entityValue;
  // 否则从轴定义中查找
  const level = axis.levels[entityValue];
  return level ? level.value : 0.5; // 默认中间值
}

// ---- 确定邻近环 ----
export function assignProximityRing(entity = {}, protagonist = {}) {
  const score = calculateProximityScore(entity, protagonist);
  for (const ring of Object.values(PROXIMITY_RINGS)) {
    if (score >= ring.range[0] && score < ring.range[1]) {
      return ring;
    }
  }
  return PROXIMITY_RINGS.SLEEP;
}

// ---- 批量更新所有实体 ----
export function updateAllProximities(entities = [], protagonist = {}) {
  const updated = [];
  for (const entity of entities) {
    const ring = assignProximityRing(entity, protagonist);
    updated.push({
      ...entity,
      proximity: ring,
      lastActive: ring.level <= 2 ? new Date().toISOString() : entity.lastActive
    });
  }
  return updated;
}

// ---- 获取当前激活的实体(按环) ----
export function getActiveEntities(entities = [], maxRing = PROXIMITY_RINGS.NEAR) {
  return entities
    .filter((e) => e.proximity?.level != null && e.proximity.level <= maxRing.level)
    .sort((a, b) => (a.proximity?.level ?? 99) - (b.proximity?.level ?? 99));
}

// ---- 按类型筛选 ----
export function entitiesByType(entities = [], type = ENTITY_TYPES.CHARACTER, maxRing = null) {
  let filtered = entities.filter((e) => e.type === type);
  if (maxRing !== null) {
    filtered = filtered.filter((e) => e.proximity?.level != null && e.proximity.level <= maxRing.level);
  }
  return filtered;
}

// ---- 叙事表现力调制 ----
export function getExpressionLevel(entity = {}) {
  const ring = entity.proximity || PROXIMITY_RINGS.SLEEP;
  switch (ring.level) {
    case 0: return { detail: "full",    words: "不限",     senses: "全部感官",  action: "直接互动" };
    case 1: return { detail: "detailed", words: "简短",    senses: "提及1-2感", action: "可互动" };
    case 2: return { detail: "summary",  words: "一句话",  senses: "不展开",     action: "仅提及" };
    case 3: return { detail: "dormant",  words: "不出现",  senses: "不描述",     action: "沉睡" };
    default: return { detail: "unknown", words: "", senses: "", action: "" };
  }
}

// ---- 场景变化时更新 ----
export function onSceneChange(entities = [], newScene = "", protagonist = {}) {
  // 场景变化时重新计算所有实体的邻近度
  const updatedProtagonist = { ...protagonist, location: newScene };
  return updateAllProximities(entities, updatedProtagonist);
}

// ---- 时间推进时更新 ----
export function onTimeAdvance(entities = [], timeDelta = "recent", protagonist = {}) {
  // 时间推进时，之前"当前"的实体向"近期"移动
  const updated = entities.map((e) => {
    if (e.time === "present") {
      return { ...e, time: timeDelta || "recent" };
    }
    return e;
  });
  return updateAllProximities(updated, protagonist);
}

// ---- 生成激活候选建议 (替代随机激活) ----
// 基于剧情缺口分析，从沉睡实体中推荐可唤醒的候选。
// 不做自动激活——由 LLM 或玩家根据叙事需要决定是否激活。
export function suggestActivationCandidates(entities = [], protagonist = {}, gaps = []) {
  if (!gaps || gaps.length === 0) return [];

  const sleepingEntities = entities.filter((e) => e.proximity?.level != null && e.proximity.level >= 3);
  if (sleepingEntities.length === 0) return [];

  const candidates = [];

  for (const gap of gaps) {
    // 按缺口类型 + 标签筛选候选
    const matching = sleepingEntities.filter((e) => {
      if (gap.type && e.type !== gap.type) return false;
      if (gap.tags && gap.tags.length > 0) {
        return gap.tags.some((t) => e.tags?.includes(t));
      }
      return true;
    });

    if (matching.length === 0) continue;

    // 排序：有历史活跃记录的优先
    const sorted = matching.sort((a, b) => {
      const aScore = (a.activeCount || 0) + (a.lastActive ? 1 : 0);
      const bScore = (b.activeCount || 0) + (b.lastActive ? 1 : 0);
      return bScore - aScore;
    });

    candidates.push({
      gap: gap.reason,
      type: gap.type,
      suggestions: sorted.slice(0, 3).map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        description: e.description || "",
        lastActive: e.lastActive,
        wakeCondition: `玩家接近${e.location || '未知位置'}或剧情需要${e.type}时自然激活`
      }))
    });
  }

  return candidates;
}

// ---- 手动激活实体 ----
export function activateEntity(entities = [], entityId = "") {
  const idx = entities.findIndex((e) => e.id === entityId);
  if (idx === -1) return entities;
  const updated = [...entities];
  const entity = { ...updated[idx] };
  // 拉近到核心环
  entity.location = "sameScene";
  entity.time = "present";
  entity.relationship = entity.relationship === "stranger" ? "acquainted" : entity.relationship;
  entity.lastActive = new Date().toISOString();
  entity.activeCount = (entity.activeCount || 0) + 1;
  updated[idx] = entity;
  return updated;
}

// ---- 剧情缺口分析 ----
export function analyzeNarrativeGap(activeEntities = [], recentEvents = [], options = {}) {
  const gaps = [];

  // 检查角色多样性
  const activeChars = activeEntities.filter((e) => e.type === ENTITY_TYPES.CHARACTER);
  if (activeChars.length < 2) {
    gaps.push({ type: ENTITY_TYPES.CHARACTER, reason: "核心角色过少，需要引入新的互动对象" });
  }

  // 检查是否有近期事件需要特定类型
  const lastEvent = recentEvents[recentEvents.length - 1];
  if (lastEvent?.needsCharacter) {
    gaps.push({ type: ENTITY_TYPES.CHARACTER, reason: `剧情需要: ${lastEvent.needsCharacter}`, tags: lastEvent.tags || [] });
  }

  // 检查是否需要组织介入
  if (activeEntities.filter((e) => e.type === ENTITY_TYPES.ORGANIZATION).length === 0 && options.worldType === "epic") {
    gaps.push({ type: ENTITY_TYPES.ORGANIZATION, reason: "史诗世界中缺少活跃组织" });
  }

  // 主线告一段落 → 可以插入支线事件
  if (options.mainPlotResolved) {
    gaps.push({ type: ENTITY_TYPES.EVENT, reason: "主线暂时完成，可触发支线事件" });
  }

  return gaps;
}

// ---- 邻近可视化(调试用) ----
export function proximityMap(entities = [], protagonist = {}) {
  const byRing = { core: [], near: [], far: [], sleep: [] };
  for (const entity of entities) {
    const ring = entity.proximity || PROXIMITY_RINGS.SLEEP;
    const key = ring.level === 0 ? "core" : ring.level === 1 ? "near" : ring.level === 2 ? "far" : "sleep";
    byRing[key].push(`${entity.type}:${entity.name}(${entity.location}/${entity.time}/${entity.relationship})`);
  }
  return {
    protagonist: protagonist.name || "主角",
    currentLocation: protagonist.location || "未知",
    rings: byRing,
    summary: `核心${byRing.core.length} 邻近${byRing.near.length} 远端${byRing.far.length} 沉睡${byRing.sleep.length}`
  };
}

// ---- 邻近摘要(注入prompt) ----
export function proximitySummary(entities = [], protagonist = {}) {
  const active = getActiveEntities(entities, PROXIMITY_RINGS.NEAR);
  const sleeping = entities.filter((e) => e.proximity?.level != null && e.proximity.level >= 3);

  const activeList = active.map((e) => {
    const expr = getExpressionLevel(e);
    return `[${e.type}] ${e.name} | ${expr.detail} | ${expr.words}`;
  });

  const sleepingSample = sleeping.slice(0, 5).map((e) => `[${e.type}] ${e.name} (沉睡)`);

  return [
    `主角: ${protagonist.name || "未知"} | 位置: ${protagonist.location || "未知"}`,
    `激活实体 (${active.length}):`,
    ...activeList.map((l) => `  ${l}`),
    sleeping.length > 0 ? `沉睡实体 (${sleeping.length}，随机可唤醒):` : "",
    ...sleepingSample.map((l) => `  ${l}`)
  ].filter(Boolean).join("\n");
}
