const HIDDEN_FIELDS = ["truthLock", "answerLock", "hiddenFacts", "_systemOnly", "aiPlans"];

export function getModeIsolationPolicy(modeId) {
  return { modeId, mayReadShared: true, mayWriteCache: true, mayWriteProposals: true, requiresProposalForShared: true, hiddenContextFields: [...HIDDEN_FIELDS] };
}

export function assertModeCanWrite(modeId, resourcePath) {
  const cacheNS = resourcePath.includes("runtime/cache/") ? resourcePath.split("runtime/cache/")[1]?.split("/")[0] : "";
  if (cacheNS && !resourcePath.includes(`runtime/cache/${modeId}`) && !resourcePath.includes(`runtime/cache/worldbook`)) {
    return { allowed: false, reason: `mode ${modeId} cannot write to cache namespace: ${cacheNS}` };
  }
  return { allowed: true, reason: null };
}

export function filterContextByModeVisibility(modeId, context = {}) {
  const filtered = { ...context };
  for (const field of HIDDEN_FIELDS) { delete filtered[field]; }
  return filtered;
}

export function validateModeIsolation(modeId, packet = {}) { return { ok: true, hiddenFieldsFiltered: HIDDEN_FIELDS.length }; }
