function clean(value, max = 240) { return String(value || "").trim().slice(0, max); }

export function createQuestTracker(input = {}) {
  const activeQuests = (Array.isArray(input.activeQuests) ? input.activeQuests : []).map(item => ({ id: clean(item.id || `quest_${Date.now()}`, 80), name: clean(item.name, 120), description: clean(item.description, 240), progress: Math.max(0, Math.min(100, Number(item.progress || 0))), discoveredAt: clean(item.discoveredAt, 80), milestones: Array.isArray(item.milestones) ? item.milestones.map(v => clean(v, 120)).filter(Boolean) : [], visibility: item.visibility === "private" ? "private" : "public" })).filter(item => item.name);
  const hiddenStorylines = (Array.isArray(input.hiddenStorylines) ? input.hiddenStorylines : []).map(item => ({ id: clean(item.id, 80), name: clean(item.name, 120), visibilityCondition: clean(item.visibilityCondition, 160), entries: Array.isArray(item.entries) ? item.entries.map(v => clean(v, 160)).filter(Boolean) : [], revealed: item.revealed === true }));
  return { activeQuests, hiddenStorylines };
}
export function getPlayerVisibleGoals(tracker = {}) {
  const safe = createQuestTracker(tracker);
  return { activeQuests: safe.activeQuests.filter(item => item.visibility === "public"), revealedStorylines: safe.hiddenStorylines.filter(item => item.revealed).map(item => ({ id: item.id, name: item.name, entries: item.entries })) };
}

export function updateQuestProgress(tracker = {}, questId, progress) {
  const next = createQuestTracker(tracker);
  const quest = next.activeQuests.find(item => item.id === questId);
  if (!quest) return { ok: false, tracker: next, error: "quest not found" };
  quest.progress = Math.max(0, Math.min(100, Number(progress) || 0));
  return { ok: true, tracker: next, runtimeUpdate: { type: "quest_progress", questId, progress: quest.progress, authority: "runtime", canonWrites: [] } };
}
