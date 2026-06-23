import { createModuleRuntimePacket } from "../modules/module-runtime-orchestrator.js";

const FORGE_MODULES = ["core.world_container", "narrative.story_template", "narrative.five_layer_engine", "audit.narrative_quality", "rule.world_rule"];

export function createForgeModuleRuntimeContext(project = {}, input = {}, options = {}) {
  return { model: project.model || {}, input: input.text || "", engineState: project.engineState || {}, options };
}

export function createForgeModuleRuntimePacket(project = {}, input = {}, options = {}) {
  const ctx = createForgeModuleRuntimeContext(project, input, options);
  const packet = createModuleRuntimePacket("creation-forge", ctx);
  return { ...packet, forgeModulesAvailable: FORGE_MODULES.filter(m => (packet.requested||[]).includes(m)) };
}

export function createForgeModuleSourceMap(packet = {}, options = {}) {
  return { modulesAvailable: packet.forgeModulesAvailable || [], contextBlockCount: packet.contextBlocks?.length || 0 };
}

export function createForgeModuleDebugSummary(packet = {}, options = {}) {
  return { modulesChecked: (packet.forgeModulesAvailable || []).length, contextBlocks: packet.contextBlocks?.length || 0 };
}
