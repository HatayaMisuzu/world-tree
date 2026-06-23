import { createWorldbook, createWorldbookEntry } from "./worldbook-schema.js";

export function normalizeWorldbook(worldbook = {}, options = {}) {
  return { ...createWorldbook(), ...worldbook, entries: Array.isArray(worldbook.entries) ? worldbook.entries.map(e => normalizeWorldbookEntry(e)) : [], updatedAt: new Date().toISOString() };
}

export function normalizeWorldbookEntry(entry = {}, options = {}) {
  return createWorldbookEntry({ ...entry, keys: Array.isArray(entry.keys) ? entry.keys : (entry.key ? [entry.key] : []), secondaryKeys: Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : (entry.secondary_key ? [entry.secondary_key] : []) });
}

export function normalizeScenes(scenes = {}, options = {}) {
  return { schemaVersion: scenes.schemaVersion || 1, currentSceneId: scenes.currentSceneId || "opening", items: Array.isArray(scenes.items) ? scenes.items : [] };
}

export function normalizeWorldState(state = {}, options = {}) {
  return { schemaVersion: state.schemaVersion || 1, worldId: state.worldId || "primary", currentTime: state.currentTime || { label: "开始", turn: 0 }, flags: state.flags || {}, variables: state.variables || {}, activeThreats: Array.isArray(state.activeThreats) ? state.activeThreats : [], activeOpportunities: Array.isArray(state.activeOpportunities) ? state.activeOpportunities : [], lastUpdatedBy: state.lastUpdatedBy || "system" };
}

export function normalizeTimeline(timeline = {}, options = {}) {
  return { schemaVersion: timeline.schemaVersion || 1, events: Array.isArray(timeline.events) ? timeline.events : [] };
}

export function normalizeRelations(relations = {}, options = {}) {
  return { schemaVersion: relations.schemaVersion || 1, relations: Array.isArray(relations.relations) ? relations.relations : [] };
}
