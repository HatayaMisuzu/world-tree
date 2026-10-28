// Director 子模块：事件预测缓存（按世界隔离，边缘事件在后续轮次自然冒泡）。
// 由 director.js 拆出，行为不变；director.js 会重新导出。

import { PREDICTION_CACHE } from "./constants.js";
import { scopedObject } from "./world-scope.js";

// ═══════════════════════════════════════════════════════════════
//  事件预测缓存 — 延迟触发的"边缘事件"在后续轮次自然冒泡
// ═══════════════════════════════════════════════════════════════

// 多世界隔离：每个世界独立缓存
const PREDICTION_STORES = scopedObject("director.predictions", () => new Map());

/** 导出预测缓存（用于持久化） */
export function exportPredictionStores() {
  const result = {};
  for (const [key, store] of PREDICTION_STORES) {
    result[key] = { events: store.events, maxSize: store.maxSize, counter: store.counter };
  }
  return result;
}

/** 导入预测缓存（从持久化恢复） */
export function importPredictionStores(data = {}) {
  PREDICTION_STORES.clear();
  for (const [key, store] of Object.entries(data)) {
    PREDICTION_STORES.set(key, { events: store.events || [], maxSize: store.maxSize || PREDICTION_CACHE.MAX_SIZE, counter: store.counter || 0 });
  }
}

export function clearPredictionStore(worldName = null) {
  if (worldName) PREDICTION_STORES.delete(String(worldName));
  else PREDICTION_STORES.clear();
}

function getPredictionStore(worldName = "_default") {
  if (!PREDICTION_STORES.has(worldName)) {
    PREDICTION_STORES.set(worldName, { events: [], maxSize: PREDICTION_CACHE.MAX_SIZE, counter: 0 });
  }
  return PREDICTION_STORES.get(worldName);
}
/**
 * 将未触发但有潜力的事件存入缓存
 * @param {Object} assessment - calculateEventScore 的返回
 * @param {Object} eventTemplate - 事件对象（含 level/title/proposal）
 * @param {Object} context - { worldType, round, score, reason }
 */
export function cacheEventPrediction(assessment, eventTemplate = null, context = {}) {
  if (!assessment || assessment.method === "none") return;
  const score = assessment.score || 0;
  if (score < PREDICTION_CACHE.SCORE_MIN || score > PREDICTION_CACHE.SCORE_MAX) return;
  const store = getPredictionStore(context.worldName || "_default");

  const sameType = store.events.find(
    (e) => e.type === assessment.type && e.status === "pending" && e.worldType === context.worldType
  );
  if (sameType) return;

  if (store.events.filter((e) => e.status === "pending").length >= store.maxSize) {
    const oldest = store.events
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.round - b.round)[0];
    if (oldest) oldest.status = "evicted";
  }

  const entry = {
    id: `cache-${++store.counter}`,
    // round-scoped; no wall-clock createdAt (dc-3) — hash can include this entry without stubs
    createdAtRound: context.round || 0,
    round: context.round || 0,
    score,
    type: assessment.type,
    event: eventTemplate || { level: assessment.type === "ambient" ? "light" : "moderate", title: "待定", proposal: "" },
    worldType: context.worldType || "daily",
    status: "pending",
    reason: assessment.reason || ""
  };
  store.events.push(entry);
}

/**
 * 检查缓存中有没有可以升级触发的事件
 * @param {Object} context - { emotion, proximity, round, sceneChanged }
 * @returns {{ promoted: boolean, event: Object|null, source: Object|null }}
 */
export function checkEventCache(context = {}) {
  const { emotion, proximity = [], round = 0, sceneChanged = false, worldName } = context;
  const store = getPredictionStore(worldName || "_default");
  const pending = store.events.filter((e) => e.status === "pending");

  if (!pending.length) return { promoted: false, event: null, source: null };

  // 排序：按 score 从高到低 + 等待轮次加成
  for (const entry of pending) {
    const waitBonus = Math.min(PREDICTION_CACHE.WAIT_BONUS_MAX, (round - entry.round) * PREDICTION_CACHE.WAIT_BONUS_MULTIPLIER);
    entry.effectiveScore = entry.score + waitBonus;
  }
  pending.sort((a, b) => (b.effectiveScore || 0) - (a.effectiveScore || 0));

  const best = pending[0];
  const effectiveScore = best.effectiveScore || best.score;

  // 方案 A：缓存事件对应的钩子已不在世界状态中（线索已解/动机已变）→ 作废
  if (Array.isArray(context.storyHooks) && best.event?.hookId && !context.storyHooks.some(h => h.id === best.event.hookId)) {
    best.status = "stale";
    return { promoted: false, event: null, source: null };
  }

  // 检查当前条件是否还匹配
  const coreChars = (proximity || []).filter((e) => e.proximity?.level === 0 && e.type === "character").length;

  // 条件恶化：无人可互动的事件，但场景中没有人
  if (best.type === "core" && coreChars === 0) {
    best.status = "stale";
    return { promoted: false, event: null, source: null };
  }

  // 升级判断
  if (effectiveScore >= 50 || (effectiveScore >= 35 && sceneChanged)) {
    best.status = "activated";
    const event = best.event;

    // 如果是 light 事件但等待了太久，升级到 moderate
    if (event.level === "light" && (round - best.round) >= 5) {
      event.level = "moderate";
      event.title = "中等事件（缓存升级）";
    }

    return {
      promoted: true,
      event: {
        ...event,
        marker: event.level === "major" ? "★" : event.level === "moderate" ? "◆" : "·",
        canIncorporate: event.level === "major",
        canBackground: event.level !== "light",
        cached: true,
        cacheId: best.id,
        promotedAtRound: round
      },
      source: best
    };
  }

  // 超时淘汰
  if (round - best.round > 10) {
    best.status = "expired";
  }

  // 这个 entry 保留缓存，下次再评估
  return { promoted: false, event: null, source: null };
}

/**
 * 清理过期缓存
 * @param {number} currentRound
 * @param {number} ttl - 缓存存活轮数上限
 */
export function pruneEventCache(currentRound = 0, ttl = 8, worldName = "_default") {
  const store = getPredictionStore(worldName);
  const before = store.events.length;
  store.events = store.events.filter((e) => {
    if (e.status === "activated" || e.status === "evicted") return false;
    if (currentRound - e.round > ttl) {
      e.status = "expired";
      return false;
    }
    return true;
  });
  return { removed: before - store.events.length, remaining: store.events.length };
}

/** 获取完整缓存状态（调试用） */
export function getEventCache(worldName = "_default") {
  const store = getPredictionStore(worldName);
  return {
    size: store.events.length,
    maxSize: store.maxSize,
    pending: store.events.filter((e) => e.status === "pending").length,
    events: store.events.map((e) => ({
      id: e.id, score: e.score, type: e.type, status: e.status,
      level: e.event?.level, round: e.round,
      waitRounds: e.waitRounds
    }))
  };
}

/** 重置预测缓存（切换模组/存档时调用） */
export function resetPredictionCache(worldName = "_default") {
  const store = getPredictionStore(worldName);
  store.events = [];
  store.counter = 0;
}
