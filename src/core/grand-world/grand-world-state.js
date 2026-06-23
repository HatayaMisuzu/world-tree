export function createGrandWorldStateSnapshot(project = {}, options = {}) {
  const state = project.worldState || options.worldState || {};
  const scenes = project.scenes || options.scenes || {};
  const timeline = project.timeline || options.timeline || {};
  const relations = project.relations || options.relations || {};
  return { worldState: state, currentScene: (scenes.items || []).find(s => s.id === scenes.currentSceneId) || null, recentEvents: (timeline.events || []).slice(-5), activeRelations: (relations.relations || []).slice(0, 10), timestamp: new Date().toISOString() };
}

export function createGrandWorldChangeProposals(input = {}, context = {}, options = {}) {
  return [{ id: `gw_prop_${Date.now()}`, type: "world_state_update", summary: "", patch: {}, status: "pending", createdAt: new Date().toISOString() }];
}

export function createSceneTransitionProposal(input = {}, context = {}, options = {}) {
  return { id: `scene_prop_${Date.now()}`, type: "scene_transition", fromSceneId: context.currentScene?.id || "", toSceneId: "", summary: "", status: "pending", createdAt: new Date().toISOString() };
}

export function createRelationChangeProposal(input = {}, context = {}, options = {}) {
  return { id: `rel_prop_${Date.now()}`, type: "relation_change", sourceId: "", targetId: "", summary: "", status: "pending", createdAt: new Date().toISOString() };
}

export function createTimelineAppendProposal(input = {}, context = {}, options = {}) {
  return { id: `timeline_prop_${Date.now()}`, type: "timeline_append", summary: "", event: {}, status: "pending", createdAt: new Date().toISOString() };
}