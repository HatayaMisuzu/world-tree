import { getModulesForMode } from "../modes/mode-module-map.js";
import { createModuleRuntimePacket } from "../modules/module-runtime-orchestrator.js";

const WORLDBOOK_MODULES = ["core.world_container","lore.worldbook_trigger","core.dynamic_state","entity.relationship_network","scene.session","narrative.story_template","narrative.five_layer_engine","rule.world_rule","audit.narrative_quality"];

export function createWorldbookModuleRuntimeContext(project = {}, input = {}, options = {}) {
  return { model: project.model || options.model || {}, input: input.text || "", engineState: project.engineState || {}, moduleData: project.moduleData || {}, options };
}

export function createWorldbookModuleRuntimePacket(project = {}, input = {}, options = {}) {
  const ctx = createWorldbookModuleRuntimeContext(project, input, options);
  const modeId = options.modeId || "world-rpg";
  const packet = createModuleRuntimePacket(modeId, ctx);
  const requested = getModulesForMode(modeId);
  const available = WORLDBOOK_MODULES.filter(m => requested.includes(m));
  return { ...packet, requested, worldbookModulesAvailable: available, requiredModuleCheck: available.length >= 5 };
}

export function createWorldbookModuleSourceMap(packet = {}, options = {}) {
  return { modeId: packet.modeId, worldbookModulesAvailable: packet.worldbookModulesAvailable || [], contextBlockCount: packet.contextBlocks?.length || 0, promptBlockCount: packet.promptBlocks?.length || 0, debugInfoCount: packet.debugInfo?.length || 0, missingWrappers: packet.missingWrappers || [], warnings: packet.warnings || [] };
}

export function createWorldbookModuleDebugSummary(packet = {}, options = {}) {
  return { modulesChecked: packet.worldbookModulesAvailable?.length || 0, totalContextBlocks: packet.contextBlocks?.length || 0, promptBlockAvail: (packet.promptBlocks || []).filter(b => b.ok).length, requiredModulesOk: packet.requiredModuleCheck !== false };
}

export function validateWorldbookModuleRuntimePacket(packet = {}, options = {}) {
  return { ok: packet.requiredModuleCheck !== false, errors: packet.requiredModuleCheck === false ? ["insufficient worldbook modules"] : [], warnings: packet.warnings || [] };
}
