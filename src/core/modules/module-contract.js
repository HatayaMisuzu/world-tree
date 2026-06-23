export const MODULE_STATUS = Object.freeze({
  IMPLEMENTED: "implemented",
  LEGACY_WRAPPED: "legacy-wrapped",
  LEGACY_INLINE: "legacy-inline",
  PROTOTYPE_HIDDEN: "prototype-hidden",
  DECLARED_ONLY: "declared-only",
  DEPRECATED: "deprecated",
  MISSING: "missing"
});

export const MODULE_CATEGORIES = Object.freeze({
  CORE: "core",
  LORE: "lore",
  ENTITY: "entity",
  CHARACTER: "character",
  SCENE: "scene",
  NARRATIVE: "narrative",
  RULE: "rule",
  AUDIT: "audit",
  TIME: "time",
  EVENT: "event",
  PREDICTION: "prediction",
  TRPG: "trpg",
  RPG: "rpg",
  MYSTERY: "mystery",
  PUZZLE: "puzzle",
  STRATEGY: "strategy",
  CREATION: "creation"
});

const ARRAY_FIELDS = ["sourceFiles", "capabilities", "usedByModes", "dependsOn"];
const CALLABLE_HOOKS = [
  "buildContext",
  "buildPromptBlock",
  "prepareTurn",
  "completeTurn",
  "validateOutput",
  "extractProposals",
  "applyConfirmedChange",
  "getDebugInfo"
];

export function validateModuleDefinition(def) {
  const errors = [];
  if (!def || typeof def !== "object" || Array.isArray(def)) {
    return { ok: false, errors: ["module definition must be object"] };
  }
  if (typeof def.id !== "string" || !def.id.trim()) errors.push("id is required");
  if (typeof def.name !== "string" || !def.name.trim()) errors.push("name is required");
  if (typeof def.category !== "string" || !def.category.trim()) errors.push("category is required");
  if (!Object.values(MODULE_STATUS).includes(def.status)) errors.push(`invalid status: ${def.status}`);
  if (def.legacyId != null && typeof def.legacyId !== "string") errors.push("legacyId must be string or null");
  for (const key of ARRAY_FIELDS) {
    if (!Array.isArray(def[key])) errors.push(`${key} must be array`);
  }
  for (const hook of CALLABLE_HOOKS) {
    if (def[hook] != null && typeof def[hook] !== "function") errors.push(`${hook} must be function`);
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeModuleDefinition(def) {
  if (!def || typeof def !== "object" || Array.isArray(def)) return null;
  const normalized = {
    ...def,
    id: typeof def.id === "string" ? def.id.trim() : "",
    legacyId: typeof def.legacyId === "string" && def.legacyId.trim() ? def.legacyId.trim() : null,
    name: typeof def.name === "string" ? def.name.trim() : "",
    category: typeof def.category === "string" ? def.category.trim() : "",
    sourceFiles: Array.isArray(def.sourceFiles) ? [...new Set(def.sourceFiles)] : [],
    capabilities: Array.isArray(def.capabilities) ? [...new Set(def.capabilities)] : [],
    usedByModes: Array.isArray(def.usedByModes) ? [...new Set(def.usedByModes)] : [],
    dependsOn: Array.isArray(def.dependsOn) ? [...new Set(def.dependsOn)] : [],
    notes: typeof def.notes === "string" ? def.notes : ""
  };
  return Object.freeze(normalized);
}

export function isCallableModule(def) {
  const validation = validateModuleDefinition(def);
  if (!validation.ok) return false;
  if (![MODULE_STATUS.IMPLEMENTED, MODULE_STATUS.LEGACY_WRAPPED].includes(def.status)) return false;
  return def.capabilities.length > 0 || CALLABLE_HOOKS.some((hook) => typeof def[hook] === "function");
}
