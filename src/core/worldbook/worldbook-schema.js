export function createWorldbook(input = {}, options = {}) {
  return { schemaVersion: 1, worldId: "primary", title: input.title || "未命名世界", genre: Array.isArray(input.genre) ? input.genre : [], tone: input.tone || "", premise: input.premise || "", coreRules: Array.isArray(input.coreRules) ? input.coreRules : [], canonPolicy: { aiMayCreateMinorDetails: true, aiMayModifyCoreCanon: false, requiresProposalForMajorChanges: true }, visibilityPolicy: { playerKnown: [], hiddenFromPlayer: [], gmOnly: [] }, entries: Array.isArray(input.entries) ? input.entries : [], createdAt: input.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function createWorldbookEntry(input = {}, options = {}) {
  return { id: input.id || `lore_${Date.now()}`, title: input.title || "", type: input.type || "lore", content: input.content || "", keys: Array.isArray(input.keys) ? input.keys : [], secondaryKeys: Array.isArray(input.secondaryKeys) ? input.secondaryKeys : [], tags: Array.isArray(input.tags) ? input.tags : [], enabled: input.enabled !== false, priority: input.priority ?? 100, visibility: input.visibility || "player_known", source: { kind: input.sourceKind || "user_setting", confidence: input.sourceConfidence || "high" } };
}

export function createDefaultScene(input = {}, options = {}) {
  return { schemaVersion: 1, currentSceneId: "opening", items: [{ id: "opening", title: input.title || "开场场景", type: "location", description: input.description || "", parentSceneId: null, connectedSceneIds: [], visibleLoreIds: [], presentCharacterIds: [], state: { timeOfDay: "", weather: "", dangerLevel: 0 } }] };
}

export function createDefaultWorldState(input = {}, options = {}) {
  return { schemaVersion: 1, worldId: "primary", currentTime: { label: "开始", turn: 0 }, flags: {}, variables: {}, activeThreats: [], activeOpportunities: [], lastUpdatedBy: "system" };
}

export function createDefaultTimeline(input = {}, options = {}) {
  return { schemaVersion: 1, events: [] };
}

export function createTimelineEvent(input = {}, options = {}) {
  return { id: input.id || `event_${Date.now()}`, time: input.time || "开始", summary: input.summary || "", sceneId: input.sceneId || null, participants: Array.isArray(input.participants) ? input.participants : [], visibility: input.visibility || "player_known", source: input.source || "runtime" };
}

export function createDefaultRelations(input = {}, options = {}) {
  return { schemaVersion: 1, relations: [] };
}

export function createWorldbookSummary(worldbook = {}, options = {}) {
  return { title: worldbook.title || "", entryCount: (worldbook.entries || []).length, activeEntryCount: (worldbook.entries || []).filter(e => e.enabled !== false).length, genre: worldbook.genre || [], tone: worldbook.tone || "" };
}
