import { applyStrategyChoice, buildStrategyResourceContext, createResourcePanel } from "./resource-panel.js";
import { isSealedStrategySimSpec, sealStrategySimSpec } from "./strategy-sim-spec.js";
import { createStrategyRunState } from "./strategy-sim-run-state.js";
import { runStrategySimTurn } from "./strategy-sim-turn-engine.js";

function findStrategySimSpec(project = {}, options = {}) {
  const candidate =
    options.strategySimSpec ||
    project.strategySimSpec ||
    project.moduleData?.shared?.strategy?.strategySimSpec ||
    project.moduleData?.shared?.strategy?.sealedSpec ||
    project.shared?.strategy?.strategySimSpec ||
    project.shared?.strategy?.sealedSpec ||
    null;

  if (!candidate) return null;
  if (isSealedStrategySimSpec(candidate)) return candidate;

  // Runtime must not auto-complete or invent rules, but it may seal an already complete explicit spec
  // passed by tests/tools. If validation fails, caller gets legacy fallback unless strictV2 is set.
  try {
    return sealStrategySimSpec(candidate, { sealedBy: "strategy-sim-mode-adapter" });
  } catch {
    if (options.strictV2) throw new Error("StrategySimSpec exists but is not valid/sealed");
    return null;
  }
}

function findStrategyRunState(project = {}, options = {}, spec = null) {
  const candidate =
    options.strategyRunState ||
    project.strategyRunState ||
    project.moduleData?.runtime?.strategyRunState ||
    project.runtime?.strategyRunState ||
    null;

  if (candidate) return candidate;
  return spec ? createStrategyRunState(spec, {
    runId: options.runId,
    rngSeed: options.rngSeed,
    createdAt: options.createdAt
  }) : null;
}

export function createSoloStrategySimContext(project = {}, input = {}, options = {}) {
  const spec = findStrategySimSpec(project, options);
  if (spec) {
    const state = findStrategyRunState(project, options, spec);
    const result = runStrategySimTurn({
      spec,
      state,
      playerAction: input.text || input.input || "",
      options
    });
    return {
      modeId: "strategy-sim",
      modeMeaning: "solo_strategy_sim_v2",
      v2: true,
      timestamp: options.createdAt || new Date().toISOString(),
      inputText: input.text || input.input || "",
      specId: spec.specId,
      runId: result.runId,
      turn: result.turn,
      publicView: result.publicView,
      reportContext: result.reportContext,
      runtimeUpdate: {
        type: "strategy_sim_v2_turn",
        authority: "runtime",
        canonWrites: [],
        strategyRunState: result.state,
        turnLog: result.turnLog
      },
      promptContext: JSON.stringify(result.reportContext)
    };
  }

  const resources = createResourcePanel(options.resources || project.runtime?.resources || project.resources);
  const choice = options.choice || String(input.text || "").trim().replace(/^\//, "");
  const result = applyStrategyChoice(resources, choice);
  const nextResources = result.ok ? result.resources : resources;
  return {
    modeId: "strategy-sim",
    modeMeaning: "solo_strategy_sim",
    v2: false,
    timestamp: new Date().toISOString(),
    inputText: input.text || "",
    resources: nextResources,
    choiceResult: result.ok ? result.runtimeUpdate : null,
    promptContext: buildStrategyResourceContext(nextResources)
  };
}

export function createSoloStrategySimTurnPacket(project = {}, input = {}, options = {}) {
  const context = createSoloStrategySimContext(project, input, options);
  if (context.v2) {
    return {
      schemaVersion: 2,
      mode: "strategy-sim",
      modeMeaning: "solo_strategy_sim_v2",
      proposals: [],
      runtime: {
        cacheKey: `strategy-sim.v2.turn.${context.turn}.${Date.now()}`,
        strategyRunState: context.runtimeUpdate.strategyRunState,
        update: context.runtimeUpdate,
        canonWrites: []
      },
      publicView: context.publicView,
      reportContext: context.reportContext,
      promptContext: context.promptContext
    };
  }

  return {
    schemaVersion: 1,
    mode: "strategy-sim",
    modeMeaning: "solo_strategy_sim",
    proposals: [],
    runtime: {
      cacheKey: `strategy-sim.turn.${Date.now()}`,
      resources: context.resources,
      update: context.choiceResult,
      canonWrites: []
    },
    promptContext: context.promptContext
  };
}

export function runSoloStrategySimTurn(project = {}, input = {}, options = {}) {
  const packet = createSoloStrategySimTurnPacket(project, input, options);
  return { status: "ready", packet, cacheKey: packet.runtime.cacheKey };
}

export function createSoloStrategySimModeSummary(project = {}, options = {}) {
  const spec = findStrategySimSpec(project, options);
  return {
    mode: "strategy-sim",
    modeMeaning: spec ? "solo_strategy_sim_v2" : "solo_strategy_sim",
    ready: true,
    v2Runtime: Boolean(spec),
    sealedSpecRequired: !Boolean(spec)
  };
}
