import { getModulesForMode } from "../modes/mode-module-map.js";
import { createModuleRuntimePacket } from "../modules/module-runtime-orchestrator.js";

const REQUIRED_MODULES = ["core.world_container","character.preset","character.cognition","character.card_runtime","scene.session","audit.narrative_quality","core.dynamic_state"];

export function createCharacterModuleRuntimeContext(project = {}, input = {}, options = {}) {
  return { model: project.model || options.model || {}, input: input.text || input.content || "", engineState: project.engineState || options.engineState || {}, moduleData: project.moduleData || {}, options };
}

export function createCharacterModuleRuntimePacket(project = {}, input = {}, options = {}) {
  const ctx = createCharacterModuleRuntimeContext(project, input, options);
  const packet = createModuleRuntimePacket("character", ctx);
  const requested = getModulesForMode("character");
  return { ...packet, requested, requiredModuleCheck: REQUIRED_MODULES.every(m => requested.includes(m)) };
}

export function createCharacterModuleSourceMap(packet = {}, options = {}) {
  return { modeId: "character", requestedModules: packet.requested || [], loadedModuleCount: packet.wrapperCount || 0, contextBlockCount: packet.contextBlocks?.length || 0, promptBlockCount: packet.promptBlocks?.length || 0, debugInfoCount: packet.debugInfo?.length || 0, missingWrappers: packet.missingWrappers || [], warnings: packet.warnings || [], errors: packet.errors || [] };
}

export function selectCharacterModulePromptBlocks(packet = {}, options = {}) {
  const blocks = Array.isArray(packet.promptBlocks) ? packet.promptBlocks : [];
  return blocks.filter(b => b.ok && b.text?.length > 0).slice(0, options.maxPromptBlocks || 3);
}

export function createCharacterModuleDebugSummary(packet = {}, options = {}) {
  const sm = createCharacterModuleSourceMap(packet, options);
  const sp = selectCharacterModulePromptBlocks(packet, options);
  return { sourceMap: sm, selectedPromptBlocks: sp.map(b => ({ moduleId: b.moduleId, text: b.text?.slice(0, 120) })), hasRequiredModules: packet.requiredModuleCheck !== false };
}

export function validateCharacterModuleRuntimePacket(packet = {}, options = {}) {
  const errors = [], warnings = [];
  if (packet.requiredModuleCheck === false) errors.push({ code: "missing_required", message: "not all required modules loaded" });
  return { ok: errors.length === 0, errors, warnings };
}