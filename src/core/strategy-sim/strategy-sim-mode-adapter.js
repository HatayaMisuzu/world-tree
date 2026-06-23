export function createSoloStrategySimContext(project = {}, input = {}, options = {}) {
  return { modeId: "strategy-sim", modeMeaning: "solo_strategy_sim", timestamp: new Date().toISOString(), inputText: input.text || "" };
}
export function createSoloStrategySimTurnPacket(project = {}, input = {}, options = {}) {
  return { schemaVersion: 1, mode: "strategy-sim", modeMeaning: "solo_strategy_sim", proposals: [], runtime: { cacheKey: "strategy-sim.turn.${Date.now()}" } };
}
export function runSoloStrategySimTurn(project = {}, input = {}, options = {}) {
  return { status: "ready", packet: createSoloStrategySimTurnPacket(project, input, options), cacheKey: "strategy-sim.turn.${Date.now()}" };
}
export function createSoloStrategySimModeSummary(project = {}, options = {}) {
  return { mode: "strategy-sim", modeMeaning: "solo_strategy_sim", ready: true };
}
