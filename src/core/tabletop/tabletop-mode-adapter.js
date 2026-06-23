export function createSoloTabletopNarrativeContext(project = {}, input = {}, options = {}) {
  return { modeId: "tabletop", modeMeaning: "solo_tabletop_narrative", timestamp: new Date().toISOString(), inputText: input.text || "" };
}
export function createSoloTabletopNarrativeTurnPacket(project = {}, input = {}, options = {}) {
  return { schemaVersion: 1, mode: "tabletop", modeMeaning: "solo_tabletop_narrative", proposals: [], runtime: { cacheKey: "tabletop.turn.${Date.now()}" } };
}
export function runSoloTabletopNarrativeTurn(project = {}, input = {}, options = {}) {
  return { status: "ready", packet: createSoloTabletopNarrativeTurnPacket(project, input, options), cacheKey: "tabletop.turn.${Date.now()}" };
}
export function createSoloTabletopNarrativeModeSummary(project = {}, options = {}) {
  return { mode: "tabletop", modeMeaning: "solo_tabletop_narrative", ready: true };
}
