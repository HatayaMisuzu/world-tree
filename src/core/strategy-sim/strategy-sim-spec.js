// src/core/strategy-sim/strategy-sim-spec.js
// Strategy Sim V2 — sealed spec protocol.
// Rules live in StrategySimSpec. Runtime state lives elsewhere.
// No archetype, no quick-start template, no runtime completion.

const SPEC_SCHEMA_VERSION = 2;
const STRATEGY_MODE_ID = "strategy-sim";

export const STRATEGY_SIM_VISIBILITY = Object.freeze(["public", "partial", "hidden", "secret"]);

export class StrategySimSpecValidationError extends Error {
  constructor(errors = []) {
    super(`StrategySimSpec validation failed: ${errors.join("; ")}`);
    this.name = "StrategySimSpecValidationError";
    this.errors = errors;
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function createStableHash(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function normalizeVisibility(input, fallback = "hidden") {
  const raw = String(input || fallback || "hidden");
  const aliases = {
    player_visible: "public",
    visible: "public",
    exact: "public",
    range: "partial",
    hint: "partial",
    private: "hidden",
    internal: "hidden"
  };
  const normalized = aliases[raw] || raw;
  return STRATEGY_SIM_VISIBILITY.includes(normalized) ? normalized : fallback;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, toNumber(value, min)));
}

function normalizeRange(input, fallbackMin, fallbackMax) {
  if (!Array.isArray(input) || input.length < 2) return [fallbackMin, fallbackMax];
  const a = clampNumber(input[0], fallbackMin, fallbackMax);
  const b = clampNumber(input[1], fallbackMin, fallbackMax);
  return [Math.min(a, b), Math.max(a, b)];
}

export function normalizeResourceDefinition(input = {}) {
  const min = toNumber(input.min, 0);
  const max = Math.max(min + 1, toNumber(input.max, 100));
  const initial = clampNumber(input.initial ?? input.value ?? input.currentValue ?? min, min, max);
  const maxDelta = Math.max(0, toNumber(input.maxDeltaPerTurn ?? input.maxDelta, 20));

  return Object.freeze({
    id: String(input.id || "").trim(),
    label: String(input.label || input.id || "resource"),
    kind: String(input.kind || "stock"),
    min,
    max,
    initial,
    safeRange: normalizeRange(input.safeRange, min, max),
    warningRange: normalizeRange(input.warningRange, min, max),
    collapseRange: normalizeRange(input.collapseRange, min, max),
    maxDeltaPerTurn: maxDelta,
    naturalDrift: toNumber(input.naturalDrift ?? input.decay, 0),
    recoveryActions: toArray(input.recoveryActions).map(String),
    visibility: normalizeVisibility(input.visibility, "public"),
    source: ["explicit", "inferred", "fallback", "system"].includes(input.source) ? input.source : "system",
    thresholds: toArray(input.thresholds).map((item) => ({ ...item }))
  });
}

export function normalizeVariableDefinition(input = {}) {
  const base = normalizeResourceDefinition({ ...input, kind: input.kind || "variable", visibility: input.visibility || "hidden" });
  return Object.freeze({
    ...base,
    role: String(input.role || "strategic_variable"),
    scope: String(input.scope || "system"),
    direction: ["higher_is_better", "lower_is_better", "target_range", "contextual"].includes(input.direction) ? input.direction : "contextual"
  });
}

export function normalizeMechanismDefinition(input = {}) {
  return Object.freeze({
    id: String(input.id || "").trim(),
    label: String(input.label || input.id || "mechanism"),
    type: String(input.type || "generic"),
    description: String(input.description || ""),
    triggerTags: toArray(input.triggerTags).map(String),
    inputs: toArray(input.inputs).map((item) => ({ ...item })),
    effects: toArray(input.effects).map((item) => ({
      targetId: String(item.targetId || item.resourceId || item.variableId || "").trim(),
      targetType: ["resource", "variable"].includes(item.targetType) ? item.targetType : "resource",
      delta: toNumber(item.delta, 0),
      reason: String(item.reason || "")
    })),
    constraints: toArray(input.constraints).map((item) => ({ ...item })),
    sideEffects: toArray(input.sideEffects).map((item) => ({ ...item })),
    failureConditions: toArray(input.failureConditions).map((item) => ({ ...item })),
    recoveryPath: toArray(input.recoveryPath).map(String),
    visibility: normalizeVisibility(input.visibility, "partial")
  });
}

export function normalizeProbabilityRule(input = {}) {
  const base = clampNumber(input.baseChance ?? 0.5, 0, 1);
  const minChance = clampNumber(input.minChance ?? 0, 0, 1);
  const maxChance = Math.max(minChance, clampNumber(input.maxChance ?? 1, 0, 1));

  return Object.freeze({
    id: String(input.id || "").trim(),
    label: String(input.label || input.id || "probability"),
    triggerTags: toArray(input.triggerTags).map(String),
    baseChance: clampNumber(base, minChance, maxChance),
    minChance,
    maxChance,
    modifiers: toArray(input.modifiers).map((item) => ({ ...item })),
    hiddenModifiers: toArray(input.hiddenModifiers).map((item) => ({ ...item })),
    visibility: normalizeVisibility(input.visibility, "partial"),
    publicDisclosure: input.publicDisclosure ? { ...input.publicDisclosure } : {},
    outcomeTable: toArray(input.outcomeTable).map((item) => ({ ...item })),
    riskLevel: ["low", "medium", "high", "critical"].includes(input.riskLevel) ? input.riskLevel : "medium"
  });
}

export function normalizeEventDeck(input = {}) {
  return Object.freeze({
    id: String(input.id || "").trim(),
    label: String(input.label || input.id || "event_deck"),
    triggerTags: toArray(input.triggerTags).map(String),
    pressureCost: Math.max(0, toNumber(input.pressureCost, 1)),
    cooldownTurns: Math.max(0, toNumber(input.cooldownTurns, 0)),
    visibility: normalizeVisibility(input.visibility, "partial"),
    events: toArray(input.events).map((event) => ({
      id: String(event.id || "").trim(),
      label: String(event.label || event.id || "event"),
      weight: Math.max(0, toNumber(event.weight, 1)),
      triggerTags: toArray(event.triggerTags).map(String),
      visibility: normalizeVisibility(event.visibility || input.visibility, "partial"),
      effects: toArray(event.effects).map((effect) => ({ ...effect })),
      publicText: String(event.publicText || "")
    }))
  });
}

export function normalizeBalanceProfile(input = {}) {
  return Object.freeze({
    difficulty: String(input.difficulty || "normal"),
    expectedRunLength: String(input.expectedRunLength || "framework"),
    resourceVolatility: String(input.resourceVolatility || "bounded"),
    snowballRisk: String(input.snowballRisk || "controlled"),
    deathSpiralRisk: String(input.deathSpiralRisk || "controlled"),
    eventPressure: String(input.eventPressure || "bounded"),
    rngSeed: String(input.rngSeed || "strategy-sim-v2"),
    recoveryPolicy: Object.freeze({
      allowComeback: input.recoveryPolicy?.allowComeback !== false,
      minimumRecoveryActions: Math.max(0, toNumber(input.recoveryPolicy?.minimumRecoveryActions, 1)),
      forbidInstantCollapse: input.recoveryPolicy?.forbidInstantCollapse !== false
    }),
    eventPressureBudget: Object.freeze({
      disasterCooldown: Math.max(0, toNumber(input.eventPressureBudget?.disasterCooldown, 2)),
      recoveryWindow: Math.max(0, toNumber(input.eventPressureBudget?.recoveryWindow, 1)),
      challengeEscalation: Math.max(0, toNumber(input.eventPressureBudget?.challengeEscalation, 0.1)),
      maxConcurrentNegativeEvents: Math.max(0, toNumber(input.eventPressureBudget?.maxConcurrentNegativeEvents, 2))
    })
  });
}

export function normalizePanelSchema(input = {}) {
  return Object.freeze({
    layout: String(input.layout || "fixed-tabs"),
    panels: toArray(input.panels).map((panel) => Object.freeze({
      id: String(panel.id || "").trim(),
      label: String(panel.label || panel.id || "panel"),
      kind: String(panel.kind || "generic"),
      visibility: normalizeVisibility(panel.visibility, "public"),
      sourceIds: toArray(panel.sourceIds).map(String)
    }))
  });
}

export function normalizeReportPolicy(input = {}) {
  return Object.freeze({
    style: String(input.style || "strategy_report"),
    includeExactPublicNumbers: input.includeExactPublicNumbers !== false,
    includePartialHints: input.includePartialHints !== false,
    forbidHiddenRawValues: input.forbidHiddenRawValues !== false,
    forbidSecretMentions: input.forbidSecretMentions !== false
  });
}

export function normalizeStrategySimSpec(input = {}) {
  return Object.freeze({
    schemaVersion: SPEC_SCHEMA_VERSION,
    mode: STRATEGY_MODE_ID,
    specId: String(input.specId || input.id || `strategy_spec_${Date.now()}`),
    title: String(input.title || "Strategy Sim Spec"),
    description: String(input.description || ""),
    sourceMode: String(input.sourceMode || "creation-forge"),
    createdBy: String(input.createdBy || "system"),
    turnUnit: String(input.turnUnit || "turn"),
    resources: toArray(input.resources).map(normalizeResourceDefinition),
    variables: toArray(input.variables ?? input.strategicVariables).map(normalizeVariableDefinition),
    mechanisms: toArray(input.mechanisms).map(normalizeMechanismDefinition),
    probabilityRules: toArray(input.probabilityRules ?? input.probabilityEvents).map(normalizeProbabilityRule),
    eventDecks: toArray(input.eventDecks).map(normalizeEventDeck),
    visibilityPolicy: Object.freeze({
      defaultVisibility: normalizeVisibility(input.visibilityPolicy?.defaultVisibility, "hidden"),
      strict: input.visibilityPolicy?.strict !== false
    }),
    balanceProfile: normalizeBalanceProfile(input.balanceProfile),
    panelSchema: normalizePanelSchema(input.panelSchema),
    reportPolicy: normalizeReportPolicy(input.reportPolicy),
    sealMetadata: input.sealMetadata ? Object.freeze({ ...input.sealMetadata }) : null
  });
}

function duplicateIds(items) {
  const seen = new Set();
  const dupes = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) dupes.add(item.id);
    seen.add(item.id);
  }
  return [...dupes];
}

export function validateStrategySimSpec(input = {}) {
  const spec = input?.schemaVersion === SPEC_SCHEMA_VERSION && input?.mode === STRATEGY_MODE_ID ? input : normalizeStrategySimSpec(input);
  const errors = [];
  const warnings = [];
  const idBuckets = { resource: new Set(), variable: new Set() };

  if (spec.mode !== STRATEGY_MODE_ID) errors.push("mode must be strategy-sim");
  if (!spec.specId) errors.push("specId is required");
  if (!spec.turnUnit) errors.push("turnUnit is required");

  for (const resource of spec.resources) {
    if (!resource.id) errors.push("resource.id is required");
    if (!resource.visibility) errors.push(`resource ${resource.id || "?"} missing visibility`);
    if (resource.min >= resource.max) errors.push(`resource ${resource.id || "?"} min must be < max`);
    if (resource.maxDeltaPerTurn < 0) errors.push(`resource ${resource.id || "?"} maxDeltaPerTurn must be >= 0`);
    if (resource.id) idBuckets.resource.add(resource.id);
  }

  for (const variable of spec.variables) {
    if (!variable.id) errors.push("variable.id is required");
    if (!variable.visibility) errors.push(`variable ${variable.id || "?"} missing visibility`);
    if (variable.id) idBuckets.variable.add(variable.id);
  }

  for (const dupe of duplicateIds(spec.resources)) errors.push(`duplicate resource id: ${dupe}`);
  for (const dupe of duplicateIds(spec.variables)) errors.push(`duplicate variable id: ${dupe}`);
  for (const dupe of duplicateIds(spec.mechanisms)) errors.push(`duplicate mechanism id: ${dupe}`);
  for (const dupe of duplicateIds(spec.probabilityRules)) errors.push(`duplicate probability rule id: ${dupe}`);

  for (const mechanism of spec.mechanisms) {
    if (!mechanism.id) errors.push("mechanism.id is required");
    if (!mechanism.visibility) errors.push(`mechanism ${mechanism.id || "?"} missing visibility`);
    for (const effect of mechanism.effects) {
      if (!effect.targetId) errors.push(`mechanism ${mechanism.id || "?"} has effect without targetId`);
      const bucket = effect.targetType === "variable" ? idBuckets.variable : idBuckets.resource;
      if (effect.targetId && !bucket.has(effect.targetId)) {
        errors.push(`mechanism ${mechanism.id || "?"} references unknown ${effect.targetType}: ${effect.targetId}`);
      }
    }
  }

  for (const rule of spec.probabilityRules) {
    if (!rule.id) errors.push("probabilityRule.id is required");
    if (!rule.visibility) errors.push(`probabilityRule ${rule.id || "?"} missing visibility`);
    if (rule.baseChance < rule.minChance || rule.baseChance > rule.maxChance) {
      errors.push(`probabilityRule ${rule.id || "?"} baseChance outside min/max`);
    }
  }

  for (const deck of spec.eventDecks) {
    if (!deck.id) errors.push("eventDeck.id is required");
    if (!deck.visibility) errors.push(`eventDeck ${deck.id || "?"} missing visibility`);
  }

  return Object.freeze({ ok: errors.length === 0, errors, warnings, normalized: spec });
}

export function sealStrategySimSpec(input = {}, options = {}) {
  const normalized = normalizeStrategySimSpec(input);
  const validation = validateStrategySimSpec(normalized);
  if (!validation.ok) throw new StrategySimSpecValidationError(validation.errors);

  const withoutSeal = { ...validation.normalized, sealMetadata: null };
  const specHash = createStableHash(withoutSeal);
  const sealed = {
    ...withoutSeal,
    sealMetadata: Object.freeze({
      sealed: true,
      sealedAt: options.sealedAt || new Date().toISOString(),
      sealedBy: String(options.sealedBy || "strategy-sim-spec-sealer"),
      specHash,
      schemaVersion: SPEC_SCHEMA_VERSION
    })
  };
  return deepFreeze(sealed);
}

export function isSealedStrategySimSpec(input) {
  if (!input || input.mode !== STRATEGY_MODE_ID) return false;
  return input.sealMetadata?.sealed === true && Boolean(input.sealMetadata?.specHash);
}

export function assertSealedStrategySimSpec(input) {
  if (!isSealedStrategySimSpec(input)) {
    throw new StrategySimSpecValidationError(["StrategySimSpec must be sealed before runtime"]);
  }
  return input;
}

export function cloneStrategySimSpec(input) {
  return JSON.parse(JSON.stringify(input));
}

export { SPEC_SCHEMA_VERSION, STRATEGY_MODE_ID };
