import { createCharacterModuleRuntimePacket, createCharacterModuleDebugSummary, selectCharacterModulePromptBlocks, createCharacterModuleSourceMap } from "./character-module-runtime-integration.js";
import { createCharacterPromptPacket } from "./character-prompt-packet.js";
import { createCharacterLoreFromBook, selectActiveCharacterLoreEntries } from "./character-lore.js";
import { getActivePersona } from "./character-persona.js";
import { checkCharacterOoc } from "./character-ooc-checker.js";

export function createCharacterTurnContext(project, input = {}, options = {}) {
  const profile = project.profile || options.profile || {};
  const lore = project.lore || options.lore || {};
  const personaStore = project.persona || options.persona || {};
  const modulePacket = createCharacterModuleRuntimePacket(project, { text: input.text || "" });
  const moduleDebug = createCharacterModuleDebugSummary(modulePacket);
  const selectedPromptBlocks = selectCharacterModulePromptBlocks(modulePacket);
  const activeLore = selectActiveCharacterLoreEntries(lore, input.text || "");
  const activePersona = getActivePersona(personaStore);

  return { profile, lore, personaStore, modulePacket, selectedPromptBlocks, activeLore, activePersona, moduleSourceMap: createCharacterModuleSourceMap(modulePacket), moduleDebugSummary: moduleDebug, turnInput: input.text || "" };
}

export function createCharacterTurnPrompt(project, input = {}, options = {}) {
  const ctx = createCharacterTurnContext(project, input, options);
  return createCharacterPromptPacket(ctx.profile, { activeLoreEntries: ctx.activeLore, activePersona: ctx.activePersona, moduleSourceMap: ctx.moduleSourceMap, selectedPromptBlocks: ctx.selectedPromptBlocks, moduleDebugSummary: ctx.moduleDebugSummary }, options);
}

export function runCharacterTurn(project, input = {}, options = {}) {
  const ctx = createCharacterTurnContext(project, input, options);
  const prompt = createCharacterPromptPacket(ctx.profile, { activeLoreEntries: ctx.activeLore, activePersona: ctx.activePersona, moduleSourceMap: ctx.moduleSourceMap, selectedPromptBlocks: ctx.selectedPromptBlocks, moduleDebugSummary: ctx.moduleDebugSummary }, options);
  return { ctx, prompt, status: "ready", warnings: [], cacheKey: prompt.runtime?.cacheKey };
}

export function persistCharacterTurn(project, turn = {}, options = {}) {
  return { persisted: true, turnId: Date.now().toString(36), characterId: project.profile?.id || "primary" };
}

export function createCharacterEngineAdapterSummary(project, options = {}) {
  const ctx = createCharacterTurnContext(project, { text: "" }, options);
  return { profileLoaded: Boolean(project.profile), moduleRuntimeReady: true, requiredModulesCheck: ctx.modulePacket?.requiredModuleCheck, loreEntries: ctx.modulePacket?.contextBlocks?.length || 0 };
}