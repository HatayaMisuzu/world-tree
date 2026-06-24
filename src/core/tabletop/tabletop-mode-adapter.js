import { formatDicePromptContext, parseDiceNotation, rollDice } from "./dice.js";

export function createSoloTabletopNarrativeContext(project = {}, input = {}, options = {}) {
  const parsed = parseDiceNotation(input.text || "");
  const diceResult = parsed.ok ? rollDice(parsed, options.rng) : null;
  return { modeId: "tabletop", modeMeaning: "solo_tabletop_narrative", timestamp: new Date().toISOString(), inputText: input.text || "", diceResult, promptContext: diceResult ? formatDicePromptContext(diceResult) : "" };
}
export function createSoloTabletopNarrativeTurnPacket(project = {}, input = {}, options = {}) {
  const context = createSoloTabletopNarrativeContext(project, input, options);
  return { schemaVersion: 1, mode: "tabletop", modeMeaning: "solo_tabletop_narrative", proposals: [], runtime: { cacheKey: `tabletop.turn.${Date.now()}`, diceResult: context.diceResult, canonWrites: [] }, promptContext: context.promptContext };
}
export function runSoloTabletopNarrativeTurn(project = {}, input = {}, options = {}) {
  const packet = createSoloTabletopNarrativeTurnPacket(project, input, options);
  return { status: "ready", packet, cacheKey: packet.runtime.cacheKey };
}
export function createSoloTabletopNarrativeModeSummary(project = {}, options = {}) {
  return { mode: "tabletop", modeMeaning: "solo_tabletop_narrative", ready: true };
}
