export function createModeOutputPacket(input = {}, options = {}) {
  return { schemaVersion: 1, modeId: input.modeId || "", modeMeaning: input.modeMeaning || "", projectId: input.projectId || "", turnId: input.turnId || "", assistantMessage: { text: input.text || "", displayBlocks: [] }, structuredResult: {}, proposals: Array.isArray(input.proposals) ? input.proposals : [], statePatchPreview: [], timelineEvents: [], cacheWrites: [], warnings: [], errors: [], debug: { promptProfileId: options.profileId || "", inputPacketType: options.inputType || "", outputPacketType: options.outputType || "" } };
}

export function validateModeOutputPacket(packet = {}, options = {}) {
  const errors = [];
  if (!packet.modeId) errors.push("missing modeId");
  if (!packet.turnId) errors.push("missing turnId");
  return { ok: errors.length === 0, errors };
}

export function normalizeModeOutputPacket(packet = {}, options = {}) {
  return { ...packet, proposals: Array.isArray(packet.proposals) ? packet.proposals : [], cacheWrites: Array.isArray(packet.cacheWrites) ? packet.cacheWrites : [], warnings: Array.isArray(packet.warnings) ? packet.warnings : [] };
}

export function createModeOutputSummary(packet = {}) { return { modeId: packet.modeId, proposalsCount: packet.proposals?.length || 0, hasText: Boolean(packet.assistantMessage?.text) }; }
