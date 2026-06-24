import { applyStrategyChoice, buildStrategyResourceContext, createResourcePanel } from "./resource-panel.js";

export function createSoloStrategySimContext(project = {}, input = {}, options = {}) {
  const resources = createResourcePanel(options.resources || project.runtime?.resources || project.resources);
  const choice = options.choice || String(input.text || "").trim().replace(/^\//, "");
  const result = applyStrategyChoice(resources, choice);
  const nextResources = result.ok ? result.resources : resources;
  return { modeId: "strategy-sim", modeMeaning: "solo_strategy_sim", timestamp: new Date().toISOString(), inputText: input.text || "", resources: nextResources, choiceResult: result.ok ? result.runtimeUpdate : null, promptContext: buildStrategyResourceContext(nextResources) };
}
export function createSoloStrategySimTurnPacket(project = {}, input = {}, options = {}) {
  const context = createSoloStrategySimContext(project, input, options);
  return { schemaVersion: 1, mode: "strategy-sim", modeMeaning: "solo_strategy_sim", proposals: [], runtime: { cacheKey: `strategy-sim.turn.${Date.now()}`, resources: context.resources, update: context.choiceResult, canonWrites: [] }, promptContext: context.promptContext };
}
export function runSoloStrategySimTurn(project = {}, input = {}, options = {}) {
  const packet = createSoloStrategySimTurnPacket(project, input, options);
  return { status: "ready", packet, cacheKey: packet.runtime.cacheKey };
}
export function createSoloStrategySimModeSummary(project = {}, options = {}) {
  return { mode: "strategy-sim", modeMeaning: "solo_strategy_sim", ready: true };
}
