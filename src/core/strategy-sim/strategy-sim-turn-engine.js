// src/core/strategy-sim/strategy-sim-turn-engine.js
// Strict Strategy Sim V2 turn runtime.
// Default route is mixed pipeline. Individual stages may no-op.

import { assertSealedStrategySimSpec } from "./strategy-sim-spec.js";
import { createStrategyRunState, assertRunStateMatchesSpec, appendStrategyTurnLog, advanceStrategyTurn } from "./strategy-sim-run-state.js";
import { applyStrategicDelta, classifyStrategicRange } from "./strategy-numeric-system.js";
import { rollProbabilityEvent, normalizeProbabilityEvent, createSeededRngState } from "./strategy-probability-system.js";
import { scrubStrategyPublicView } from "./strategy-sim-public-view-scrubber.js";
import { buildStrategyReportContext } from "./strategy-sim-report-context.js";

function includesAny(text, tags = []) {
  const source = String(text || "").toLowerCase();
  return tags.some((tag) => source.includes(String(tag).toLowerCase()));
}

export function parseStrategyPlayerAction(actionText = "", spec = {}) {
  const text = String(actionText || "").trim();
  const registeredTags = new Set();

  for (const mechanism of spec.mechanisms || []) {
    if (includesAny(text, mechanism.triggerTags)) for (const tag of mechanism.triggerTags) registeredTags.add(tag);
  }
  for (const rule of spec.probabilityRules || []) {
    if (includesAny(text, rule.triggerTags)) for (const tag of rule.triggerTags) registeredTags.add(tag);
  }
  for (const deck of spec.eventDecks || []) {
    if (includesAny(text, deck.triggerTags)) for (const tag of deck.triggerTags) registeredTags.add(tag);
  }

  return Object.freeze({
    rawText: text,
    tags: [...registeredTags],
    empty: text.length === 0,
    parser: "deterministic-tag-parser"
  });
}

function applyEffectToBucket(bucket, effect, definitionMap) {
  const item = bucket[effect.targetId];
  if (!item) return { ok: false, error: `unknown target: ${effect.targetId}`, effect };
  const def = definitionMap.get(effect.targetId) || item;
  const result = applyStrategicDelta(
    { ...item, ...def, currentValue: item.value },
    effect.delta,
    { maxDelta: def.maxDeltaPerTurn ?? item.maxDeltaPerTurn }
  );
  item.value = result.value;
  item.rangeState = classifyStrategicRange({ ...item, currentValue: result.value });
  item.updatedAt = new Date().toISOString();
  return {
    ok: true,
    targetId: effect.targetId,
    targetType: effect.targetType,
    originalDelta: effect.delta,
    effectiveDelta: result.effectiveDelta,
    value: result.value,
    warnings: result.warnings || [],
    reason: effect.reason || ""
  };
}

export function resolveStrategyMechanisms(spec, state, parsedAction) {
  const resourceDefs = new Map((spec.resources || []).map((item) => [item.id, item]));
  const variableDefs = new Map((spec.variables || []).map((item) => [item.id, item]));
  const results = [];

  for (const mechanism of spec.mechanisms || []) {
    if (!mechanism.triggerTags?.length || !includesAny(parsedAction.rawText, mechanism.triggerTags)) continue;
    const mechanismResult = { mechanismId: mechanism.id, label: mechanism.label, effects: [], warnings: [] };

    for (const effect of mechanism.effects || []) {
      const bucket = effect.targetType === "variable" ? state.variables : state.resources;
      const defs = effect.targetType === "variable" ? variableDefs : resourceDefs;
      const applied = applyEffectToBucket(bucket, effect, defs);
      mechanismResult.effects.push(applied);
      if (applied.warnings?.length) mechanismResult.warnings.push(...applied.warnings.map((warning) => `${effect.targetId}:${warning}`));
      if (!applied.ok) mechanismResult.warnings.push(applied.error);
    }
    results.push(mechanismResult);
  }

  return Object.freeze(results);
}

export function resolveStrategyProbabilities(spec, state, parsedAction, options = {}) {
  const results = [];
  let rngState = createSeededRngState(state.rngState?.seed, state.rngState?.counter);

  for (const rule of spec.probabilityRules || []) {
    if (!rule.triggerTags?.length || !includesAny(parsedAction.rawText, rule.triggerTags)) continue;
    const event = normalizeProbabilityEvent(rule);
    const rolled = rollProbabilityEvent(event, rngState, {
      turn: state.currentTurn + 1,
      checkId: rule.id,
      createdAt: options.createdAt
    });
    if (rolled.rngState) rngState = rolled.rngState;
    results.push({
      ruleId: rule.id,
      label: rule.label,
      success: rolled.success,
      visibility: rule.visibility,
      rollRecord: rolled.rollRecord
    });
  }

  state.rngState = { seed: rngState.seed, counter: rngState.counter };
  return Object.freeze(results);
}

export function resolveStrategyEvents(spec, state, parsedAction) {
  const events = [];
  for (const deck of spec.eventDecks || []) {
    if (!deck.triggerTags?.length || !includesAny(parsedAction.rawText, deck.triggerTags)) continue;
    const first = (deck.events || [])[0];
    if (!first) continue;
    const publicEvent = {
      deckId: deck.id,
      eventId: first.id,
      label: first.label,
      visibility: first.visibility || deck.visibility,
      publicText: first.publicText || first.label
    };
    state.activeEvents.push(publicEvent);
    events.push(publicEvent);
  }
  return Object.freeze(events);
}

export function runStrategySimTurn({ spec, state = null, playerAction = "", options = {} } = {}) {
  assertSealedStrategySimSpec(spec);
  const runState = state || createStrategyRunState(spec, options);
  assertRunStateMatchesSpec(runState, spec);

  runState.phase = "resolving";

  const parsedAction = parseStrategyPlayerAction(playerAction, spec);
  const mechanismResults = resolveStrategyMechanisms(spec, runState, parsedAction);
  const probabilityResults = resolveStrategyProbabilities(spec, runState, parsedAction, options);
  const eventResults = resolveStrategyEvents(spec, runState, parsedAction);

  advanceStrategyTurn(runState, { phase: "complete", updatedAt: options.createdAt });

  const publicView = scrubStrategyPublicView(spec, runState, { generatedAt: options.createdAt });
  const publicDelta = mechanismResults.flatMap((item) => item.effects || []).filter((effect) => effect.ok).map((effect) => ({
    targetId: effect.targetId,
    targetType: effect.targetType,
    effectiveDelta: effect.effectiveDelta,
    value: effect.value,
    reason: effect.reason
  }));

  const turnLog = appendStrategyTurnLog(runState, {
    turn: runState.currentTurn,
    phase: "complete",
    playerActions: [String(playerAction || "")],
    parsedActions: [parsedAction],
    routePlan: {
      type: "mixed_pipeline",
      stages: ["mechanism", "probability", "event", "public_view", "report_context"]
    },
    mechanismResults,
    probabilityRolls: probabilityResults.map((item) => item.rollRecord),
    eventResults,
    publicDelta,
    publicEvents: eventResults.filter((event) => event.visibility !== "secret"),
    warnings: [...mechanismResults.flatMap((item) => item.warnings || [])]
  }, { createdAt: options.createdAt });

  const reportContext = buildStrategyReportContext(spec, runState, turnLog, { publicView, generatedAt: options.createdAt });

  return Object.freeze({
    status: "ok",
    specId: spec.specId,
    runId: runState.runId,
    turn: runState.currentTurn,
    state: runState,
    turnLog,
    publicView,
    reportContext
  });
}
