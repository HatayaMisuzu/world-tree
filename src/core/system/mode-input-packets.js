export function createBaseModeInputPacket(input = {}, options = {}) {
  return { schemaVersion: 1, modeId: input.modeId || "", modeMeaning: input.modeMeaning || "", projectId: input.projectId || "", turnId: `turn_${Date.now()}`, userInput: { text: input.text || "", intentHint: "" }, projectSnapshot: {}, sharedContext: {}, modeState: input.modeState || {}, runtime: { cacheKey: `input.${Date.now()}`, createdAt: new Date().toISOString(), warnings: [] } };
}

export function createModeInputPacket(modeId, project = {}, userInput = {}, options = {}) {
  const base = createBaseModeInputPacket({ modeId, text: userInput.text || "" });
  base.sharedContext = { worldbook: project.worldbook || null, scene: project.scenes || null, worldState: project.worldState || null, timeline: project.timeline || null, relations: project.relations || null, character: project.profile || null };
  return base;
}

export function validateModeInputPacket(packet = {}, options = {}) {
  const errors = [];
  if (!packet.modeId) errors.push("missing modeId");
  if (!packet.userInput?.text) errors.push("missing userInput.text");
  return { ok: errors.length === 0, errors };
}

export function createModeInputPacketSummary(packet = {}) { return { modeId: packet.modeId, textLength: packet.userInput?.text?.length || 0, hasContext: Boolean(packet.sharedContext?.worldbook) }; }
