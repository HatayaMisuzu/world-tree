import { MODULE_MANIFEST } from "../modules/module-manifest.js";
import { MODULE_STATUS } from "../modules/module-contract.js";
import { MODE_MANIFEST } from "./mode-manifest.js";

export const MODE_MODULE_MAP = Object.freeze({
  "quick-setting": Object.freeze(["core.world_container", "lore.worldbook_trigger", "core.dynamic_state", "scene.session", "narrative.story_template", "narrative.five_layer_engine", "audit.narrative_quality"]),
  character: Object.freeze(["core.world_container", "character.preset", "character.cognition", "character.card_runtime", "scene.session", "scene.summary_chain", "scope.proximity", "tracking.world_events", "lore.worldbook_trigger", "audit.narrative_quality", "core.dynamic_state"]),
  "murder-mystery": Object.freeze(["mystery.case", "mystery.phase", "mystery.clue", "mystery.testimony", "mystery.truth_lock", "mystery.scoring", "character.preset", "scene.session", "scene.summary_chain", "scope.proximity", "tracking.world_events", "core.dynamic_state", "lore.worldbook_trigger"]),
  tabletop: Object.freeze(["core.world_container", "lore.worldbook_trigger", "core.dynamic_state", "scene.session", "scene.summary_chain", "scope.proximity", "tracking.world_events", "rule.world_rule", "audit.narrative_quality", "time.timeline", "event.random_event", "prediction.scene_direction", "trpg.dice", "trpg.check", "trpg.character_sheet", "trpg.clock"]),
  "mystery-puzzle": Object.freeze(["core.world_container", "scene.session", "scene.summary_chain", "scope.proximity", "tracking.world_events", "lore.worldbook_trigger", "puzzle.scene", "mystery.clue", "rule.world_rule", "audit.narrative_quality", "core.dynamic_state"]),
  "world-rpg": Object.freeze(["core.world_container", "lore.worldbook_trigger", "core.dynamic_state", "scope.proximity", "tracking.world_events", "scene.summary_chain", "entity.relationship_network", "entity.key_character", "character.preset", "character.cognition", "scene.session", "narrative.story_template", "narrative.five_layer_engine", "rule.world_rule", "audit.narrative_quality", "time.timeline", "event.random_event", "prediction.scene_direction", "rpg.quest", "rpg.bond", "rpg.chapter", "rpg.growth"]),
  "strategy-sim": Object.freeze(["core.world_container", "core.dynamic_state", "scope.proximity", "tracking.world_events", "scene.session", "scene.summary_chain", "lore.worldbook_trigger", "entity.organization", "entity.organization_hierarchy", "entity.relationship_network", "time.timeline", "event.random_event", "strategy.resource", "strategy.calendar", "strategy.decision", "strategy.faction", "strategy.diplomacy", "strategy.turn", "strategy.loyalty", "audit.narrative_quality"]),
  "creation-forge": Object.freeze(["core.world_container", "creation.alchemy", "creation.questioning", "creation.outline", "lore.worldbook_trigger", "character.preset", "character.cognition", "core.dynamic_state", "audit.narrative_quality"])
});

export function getModulesForMode(modeId) {
  return MODE_MODULE_MAP[modeId] ? [...MODE_MODULE_MAP[modeId]] : [];
}

export function getModeModuleSummary(modeId) {
  const mode = MODE_MANIFEST[modeId] || null;
  const uses = getModulesForMode(modeId);
  const byStatus = {};
  for (const id of uses) {
    const status = MODULE_MANIFEST[id]?.status || MODULE_STATUS.MISSING;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  return { modeId, mode, uses, total: uses.length, byStatus };
}

export function validateModeModuleMap() {
  const errors = [];
  const warnings = [];
  for (const modeId of Object.keys(MODE_MANIFEST)) {
    const uses = MODE_MODULE_MAP[modeId];
    if (!Array.isArray(uses) || uses.length === 0) {
      errors.push(`${modeId} has no module mapping`);
      continue;
    }
    if (new Set(uses).size !== uses.length) errors.push(`${modeId} has duplicate module ids`);
    for (const moduleId of uses) {
      const definition = MODULE_MANIFEST[moduleId];
      if (!definition) warnings.push(`${modeId} references missing module: ${moduleId}`);
      else if ([MODULE_STATUS.DECLARED_ONLY, MODULE_STATUS.PROTOTYPE_HIDDEN].includes(definition.status)) {
        warnings.push(`${modeId} uses ${definition.status} module: ${moduleId}`);
      }
    }
  }
  for (const modeId of Object.keys(MODE_MODULE_MAP)) {
    if (!MODE_MANIFEST[modeId]) errors.push(`module mapping references unknown mode: ${modeId}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
