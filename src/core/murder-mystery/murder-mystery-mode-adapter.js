export function createSoloMurderMysteryContext(project = {}, input = {}, options = {}) {
  return { modeId: "murder-mystery", modeMeaning: "solo_murder_mystery", timestamp: new Date().toISOString(), inputText: input.text || "" };
}
export function createSoloMurderMysteryTurnPacket(project = {}, input = {}, options = {}) {
  return { schemaVersion: 1, mode: "murder-mystery", modeMeaning: "solo_murder_mystery", proposals: [], runtime: { cacheKey: "murder-mystery.turn.${Date.now()}" } };
}
export function runSoloMurderMysteryTurn(project = {}, input = {}, options = {}) {
  return { status: "ready", packet: createSoloMurderMysteryTurnPacket(project, input, options), cacheKey: "murder-mystery.turn.${Date.now()}" };
}
export function createSoloMurderMysteryModeSummary(project = {}, options = {}) {
  return { mode: "murder-mystery", modeMeaning: "solo_murder_mystery", ready: true };
}
