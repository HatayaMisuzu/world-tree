import coreWorldContainer from "./core-world-container.wrapper.js";
import loreWorldbookTrigger from "./lore-worldbook-trigger.wrapper.js";
import coreDynamicState from "./core-dynamic-state.wrapper.js";
import characterPreset from "./character-preset.wrapper.js";
import characterCognition from "./character-cognition.wrapper.js";
import sceneSession from "./scene-session.wrapper.js";
import auditNarrativeQuality from "./audit-narrative-quality.wrapper.js";
import characterCardRuntime from "./character-card-runtime.wrapper.js";
import creationAlchemy from "./creation-alchemy.wrapper.js";
import narrativeFiveLayerEngine from "./narrative-five-layer-engine.wrapper.js";
import narrativeStoryTemplate from "./narrative-story-template.wrapper.js";
import ruleWorldRule from "./rule-world-rule.wrapper.js";
import entityRelationshipNetwork from "./entity-relationship-network.wrapper.js";
import proximityScope from "./proximity-scope.wrapper.js";
import trackingWorldEvents from "./tracking.wrapper.js";
import sceneSummaryChain from "./scene-summary-chain.wrapper.js";
import contextEngine from "./context-engine.wrapper.js";
import directorLayer from "./director-layer.wrapper.js";
import contentImpactGate from "./content-impact-gate.wrapper.js";
import worldbookGrowthTree from "./worldbook-growth-tree.wrapper.js";
import emotionalInertia from "./emotional-inertia.wrapper.js";
import worldProfileOverlay from "./world-profile-overlay.wrapper.js";
import timelineBranchTree from "./timeline-branch-tree.wrapper.js";
import worldTelemetry from "./world-telemetry.wrapper.js";
import autoAdvance from "./auto-advance.wrapper.js";
import processingCompletionEngine from "./processing-completion-engine.wrapper.js";

const wrappers = [
  coreWorldContainer,
  loreWorldbookTrigger,
  coreDynamicState,
  characterPreset,
  characterCognition,
  sceneSession,
  auditNarrativeQuality,
  characterCardRuntime,
  creationAlchemy,
  narrativeFiveLayerEngine,
  narrativeStoryTemplate,
  ruleWorldRule,
  entityRelationshipNetwork,
  proximityScope,
  trackingWorldEvents,
  sceneSummaryChain,
  contextEngine,
  directorLayer,
  contentImpactGate,
  worldbookGrowthTree,
  emotionalInertia,
  worldProfileOverlay,
  timelineBranchTree,
  worldTelemetry,
  autoAdvance,
  processingCompletionEngine
];

export const MODULE_WRAPPERS = Object.freeze(Object.fromEntries(
  wrappers.map((wrapper) => [wrapper.id, wrapper])
));

export function getModuleWrapper(moduleId) {
  return MODULE_WRAPPERS[moduleId] || null;
}

export function listModuleWrappers() {
  return Object.values(MODULE_WRAPPERS);
}

export function listWrapperHooks(moduleId) {
  const wrapper = getModuleWrapper(moduleId);
  if (!wrapper) return [];
  return [
    "buildContext",
    "buildPromptBlock",
    "prepareTurn",
    "completeTurn",
    "validateOutput",
    "extractProposals",
    "applyConfirmedChange",
    "getDebugInfo"
  ].filter((hook) => typeof wrapper[hook] === "function");
}
