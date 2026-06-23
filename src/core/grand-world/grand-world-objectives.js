export function createWorldThread(input = {}, context = {}, options = {}) {
  return { id: `thread_${Date.now()}`, title: input.title || "", type: input.type || "lead", status: input.status || "active", summary: input.summary || "", relatedSceneIds: Array.isArray(input.relatedSceneIds) ? input.relatedSceneIds : [], relatedCharacterIds: [], relatedLoreIds: [], visibility: input.visibility || "player_known", createdAt: new Date().toISOString() };
}

export function normalizeWorldThreads(threads = [], options = {}) {
  return Array.isArray(threads) ? threads.map(t => createWorldThread(t)) : [];
}

export function selectActiveWorldThreads(threads = [], context = {}, options = {}) {
  return normalizeWorldThreads(threads).filter(t => t.status === "active").slice(0, options.maxThreads || 5);
}

export function createWorldThreadSummary(threads = [], options = {}) {
  return { total: threads.length, active: threads.filter(t => t.status === "active").length, completed: threads.filter(t => t.status === "completed").length };
}