const HIDDEN_FIELDS = new Set([
  "truthLock", "answerLock", "hiddenFacts",
  "systemOnly", "gmOnly", "culpritId",
  "solution", "secret", "privatePlan",
  "aiFactionPrivatePlan", "_systemOnly",
  "aiPlans"
]);

export function getModeIsolationPolicy(modeId) {
  return {
    modeId,
    mayReadShared: true,
    mayWriteCache: true,
    mayWriteProposals: true,
    requiresProposalForShared: true,
    hiddenContextFields: [...HIDDEN_FIELDS]
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

/**
 * 深层过滤隐藏字段。递归遍历对象/数组，删除所有匹配 HIDDEN_FIELDS 的 key。
 * 不破坏原对象（返回新对象）。
 * 不误删用户可见 summary 字段。
 */
export function deepFilterHiddenFields(value, options = {}) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(item => deepFilterHiddenFields(item, options));
  }
  if (typeof value === "object" && value.constructor === Object) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      result[key] = deepFilterHiddenFields(val, options);
    }
    return result;
  }
  return value;
}

/**
 * 顶层过滤（向后兼容）：删除顶层隐藏字段。
 * mode-runner 使用此函数过滤 inputPacket.sharedContext。
 */
export function filterContextByModeVisibility(modeId, context = {}) {
  const filtered = { ...context };
  for (const field of HIDDEN_FIELDS) {
    delete filtered[field];
  }

  // 模式专属深层过滤
  if (modeId === "murder-mystery") {
    // truthLock / culpritId / hiddenFacts 不进入玩家可见 prompt
    return deepFilterHiddenFields(filtered, { mode: "murder-mystery" });
  }
  if (modeId === "mystery-puzzle") {
    // answerLock / solution 不进入玩家可见 prompt
    return deepFilterHiddenFields(filtered, { mode: "mystery-puzzle" });
  }
  if (modeId === "strategy-sim") {
    // AI 阵营私有计划不直接进入玩家可见 prompt
    return deepFilterHiddenFields(filtered, { mode: "strategy-sim" });
  }
  if (modeId === "creation-forge") {
    // AI 推断字段必须标记，不伪装成用户设定
    return deepFilterHiddenFields(filtered, { mode: "creation-forge" });
  }

  return filtered;
}

export function validateModeIsolation(modeId, packet = {}) {
  return { ok: true, hiddenFieldsFiltered: HIDDEN_FIELDS.size };
}
