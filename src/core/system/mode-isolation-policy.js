import { GLOBAL_HIDDEN_FIELDS, getHiddenFieldsForMode } from "./hidden-field-registry.js";

const HIDDEN_FIELDS = new Set(GLOBAL_HIDDEN_FIELDS);

export function getModeIsolationPolicy(modeId) {
  return {
    modeId,
    mayReadShared: true,
    mayWriteCache: true,
    mayWriteProposals: true,
    requiresProposalForShared: true,
    hiddenContextFields: [...getHiddenFieldsForMode(modeId)]
  };
}

export function assertModeCanWrite(modeId, resourcePath, options = {}) {
  // 非 cache 路径（chat.jsonl、proposal log 等）走提案/存档系统，这里放行
  if (!resourcePath.includes("runtime/cache/")) {
    return { allowed: true, reason: null };
  }

  // cache 路径：提取 namespace
  const cacheNS = resourcePath.split("runtime/cache/")[1]?.split("/")[0] || "";

  // 允许的 cache namespace：modeId 自身、options.allowedNamespaces、worldbook 特殊
  const allowedNS = new Set([modeId]);
  if (Array.isArray(options.allowedNamespaces)) {
    for (const ns of options.allowedNamespaces) allowedNS.add(ns);
  }
  // world-rpg 的 worldbook 缓存命名空间特殊处理
  if (modeId === "world-rpg") allowedNS.add("worldbook");

  if (!allowedNS.has(cacheNS)) {
    return { allowed: false, reason: `mode ${modeId} cannot write to cache namespace: ${cacheNS} (allowed: ${[...allowedNS].join(", ")})` };
  }
  return { allowed: true, reason: null };
}

export function deepFilterHiddenFields(value, options = {}) {
  const hiddenFields = options.hiddenFields || getHiddenFieldsForMode(options.modeId || options.mode || "");
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(item => deepFilterHiddenFields(item, { ...options, hiddenFields }));
  }
  if (typeof value === "object" && value.constructor === Object) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (hiddenFields.has(key)) continue;
      result[key] = deepFilterHiddenFields(val, { ...options, hiddenFields });
    }
    return result;
  }
  return value;
}

export function filterContextByModeVisibility(modeId, context = {}) {
  const hiddenFields = getHiddenFieldsForMode(modeId);
  const filtered = { ...context };
  for (const field of hiddenFields) {
    delete filtered[field];
  }
  return deepFilterHiddenFields(filtered, { modeId, hiddenFields });
}

export function validateModeIsolation(modeId, packet = {}) {
  return { ok: true, hiddenFieldsFiltered: getHiddenFieldsForMode(modeId).size };
}
