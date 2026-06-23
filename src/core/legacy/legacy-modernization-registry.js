// legacy-modernization-registry.js — V0/V1 legacy module modernization classification
import { MATURATION_STATUS } from "../assets/asset-status-registry.js";
export const LM_STATUS = Object.freeze({ WRAPPED_SAFE: "wrapped-safe", INLINE_NEEDS_WRAPPER: "inline-needs-wrapper", PROTOTYPE_FROZEN: "prototype-frozen", DECLARED_HOLD: "declared-hold", MERGED_WITH_P3: "merged-with-p3" });
export function classifyLegacyModule(moduleDef) {
  const s = moduleDef?.status || "";
  if (s === "legacy-wrapped") return LM_STATUS.WRAPPED_SAFE;
  if (s === "legacy-inline") return LM_STATUS.INLINE_NEEDS_WRAPPER;
  if (s === "prototype-hidden") return LM_STATUS.PROTOTYPE_FROZEN;
  if (s === "declared-only") return LM_STATUS.DECLARED_HOLD;
  return LM_STATUS.INLINE_NEEDS_WRAPPER;
}
export function canExposeLegacyModule(moduleDef, target = "workflow") {
  const c = classifyLegacyModule(moduleDef);
  if (c === LM_STATUS.PROTOTYPE_FROZEN || c === LM_STATUS.DECLARED_HOLD) return false;
  if (target === "workflow" && c === LM_STATUS.INLINE_NEEDS_WRAPPER) return false;
  return true;
}
export function getModernizationAction(moduleId) {
  const map = { "entity.organization": "add wrapper", "entity.organization_hierarchy": "add wrapper", "entity.key_character": "add wrapper + P3 adapter", "time.timeline": "add timeline digest wrapper", "event.random_event": "merge with M9 Random Event Pool", "prediction.scene_direction": "merge with P1 Director/M9", "lore.race_dimension": "freeze as optional lore dimension" };
  return map[moduleId] || "review";
}
export function buildLegacyModernizationReport(moduleManifest) {
  const byStatus = {}; for (const [id, def] of Object.entries(moduleManifest)) { const c = classifyLegacyModule(def); byStatus[c] = (byStatus[c] || 0) + 1; }
  return { total: Object.keys(moduleManifest).length, byStatus };
}
