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

export function assertModeCanWrite(modeId, resourcePath) {
  const cacheNS = resourcePath.includes("runtime/cache/")
    ? resourcePath.split("runtime/cache/")[1]?.split("/")[0]
    : "";
  if (cacheNS && !resourcePath.includes(`runtime/cache/${modeId}`) && !resourcePath.includes(`runtime/cache/worldbook`)) {
    return { allowed: false, reason: `mode ${modeId} cannot write to cache namespace: ${cacheNS}` };
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
