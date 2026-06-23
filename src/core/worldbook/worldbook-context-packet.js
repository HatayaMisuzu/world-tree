export function createWorldContextPacket(input = {}, options = {}) {
  const wb = input.worldbook || {};
  const scenes = input.scenes || {};
  const state = input.worldState || {};
  const timeline = input.timeline || {};
  const relations = input.relations || {};
  const activeLore = input.activeLoreEntries || [];
  const activeScene = (scenes.items || []).find(s => s.id === scenes.currentSceneId) || null;
  const recentEvents = (timeline.events || []).slice(-5);
  const activeRelations = (relations.relations || []).slice(0, 10);

  return {
    schemaVersion: 1, mode: input.mode || "world-rpg", worldId: wb.worldId || "primary",
    worldIdentity: { title: wb.title || "", genre: wb.genre || [], tone: wb.tone || "", premise: wb.premise || "" },
    activeLoreEntries: activeLore,
    activeScenes: activeScene ? [activeScene] : [],
    activeWorldState: { currentTime: state.currentTime, flags: state.flags || {}, variables: state.variables || {} },
    activeTimelineEvents: recentEvents,
    activeRelations,
    modules: { sourceMap: input.moduleSourceMap || {}, selectedPromptBlocks: input.selectedPromptBlocks || [], contextBlocks: [], debugSummary: input.moduleDebugSummary || {} },
    runtime: { tokenEstimate: estimateWorldContextBudget(input, options), warnings: [] }
  };
}

export function estimateWorldContextBudget(input = {}, options = {}) {
  let total = 0;
  total += JSON.stringify(input.worldbook || {}).length;
  total += JSON.stringify(input.scenes || {}).length;
  total += JSON.stringify(input.activeLoreEntries || []).length;
  return Math.ceil(total / 2);
}

export function createWorldContextPromptBlocks(packet = {}, options = {}) {
  const blocks = [];
  if (packet.worldIdentity?.title) blocks.push(`世界：${packet.worldIdentity.title} - ${packet.worldIdentity.premise || ""}`);
  for (const entry of (packet.activeLoreEntries || []).slice(0, 5)) {
    blocks.push(`【${entry.title || entry.id}】${entry.content || ""}`.slice(0, 300));
  }
  return blocks;
}

export function createWorldContextSummary(packet = {}, options = {}) {
  return { title: packet.worldIdentity?.title || "", loreCount: packet.activeLoreEntries?.length || 0, sceneCount: packet.activeScenes?.length || 0, eventCount: packet.activeTimelineEvents?.length || 0, relationCount: packet.activeRelations?.length || 0, tokenEstimate: packet.runtime?.tokenEstimate || 0 };
}

export function validateWorldContextPacket(packet = {}, options = {}) {
  return { ok: Boolean(packet.schemaVersion && packet.worldId), errors: packet.schemaVersion ? [] : [{ code: "missing_schema" }], warnings: [] };
}
