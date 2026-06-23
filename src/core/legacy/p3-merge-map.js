// p3-merge-map.js — Maps old legacy modules to their P3 equivalents
export const P3_MERGE_MAP = Object.freeze({
  "character.cognition": "M5 Character Cognition Matrix",
  "rule.world_rule": "M7 World Rules Engine",
  "audit.narrative_quality": "M8 Narrative Consistency Radar",
  "event.random_event": "M9 Random Event Pool",
  "prediction.scene_direction": "P1 Director + M9 Scene Direction Candidate",
  "creation.alchemy": "M2 Alchemy Digest + M3 Material Warehouse",
  "character.preset": "M4 Character Kernel v2"
});
export function getP3Equivalent(legacyId) { return P3_MERGE_MAP[legacyId] || null; }
