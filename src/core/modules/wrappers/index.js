import coreWorldContainer from "./core-world-container.wrapper.js";
import loreWorldbookTrigger from "./lore-worldbook-trigger.wrapper.js";
import coreDynamicState from "./core-dynamic-state.wrapper.js";
import characterPreset from "./character-preset.wrapper.js";
import characterCognition from "./character-cognition.wrapper.js";
import sceneSession from "./scene-session.wrapper.js";
import auditNarrativeQuality from "./audit-narrative-quality.wrapper.js";
import characterCardRuntime from "./character-card-runtime.wrapper.js";
import creationAlchemy from "./creation-alchemy.wrapper.js";

const wrappers = [
  coreWorldContainer,
  loreWorldbookTrigger,
  coreDynamicState,
  characterPreset,
  characterCognition,
  sceneSession,
  auditNarrativeQuality,
  characterCardRuntime,
  creationAlchemy
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
