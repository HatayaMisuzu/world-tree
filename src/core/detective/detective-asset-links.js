// Detective V2 Asset Links + Runtime Isolation
// Allowed asset linkage for Detective V2. Isolation guards.

export const DETECTIVE_ALLOWED_ASSET_LINK_TYPES = [
  "worldbook_ref",
  "character_capsule_ref",
  "location_asset_ref",
  "document_asset_ref",
  "ui_component_ref",
  "export_profile_ref",
];

export function normalizeDetectiveAssetLinks(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    schemaVersion: input.schemaVersion || "world-tree.detective.v2.asset-links.1",
    worldbookRefs: input.worldbookRefs || [],
    characterRefs: input.characterRefs || [],
    locationRefs: input.locationRefs || [],
    documentRefs: input.documentRefs || [],
    uiComponentRefs: input.uiComponentRefs || [],
    exportProfileRefs: input.exportProfileRefs || [],
    notes: input.notes || "",
    _extra: input._extra || {},
  };
}

export function validateDetectiveAssetLinks(assetLinks = {}) {
  const errors = [];
  if (!Array.isArray(assetLinks.worldbookRefs)) errors.push("worldbookRefs must be an array");
  if (!Array.isArray(assetLinks.characterRefs)) errors.push("characterRefs must be an array");
  return { valid: errors.length === 0, errors };
}

export function createDetectiveRuntimeIsolationMeta(input = {}) {
  return {
    mode: "detective",
    runNamespace: input.runNamespace || "detective-v2",
    cacheNamespace: input.cacheNamespace || "detective-v2",
    saveNamespace: input.saveNamespace || "detective-v2",
    branchNamespace: input.branchNamespace || "detective-v2",
    llmContextNamespace: input.llmContextNamespace || "detective-v2",
    hiddenStateNamespace: input.hiddenStateNamespace || "detective-v2",
  };
}

export function assertDetectiveRuntimeIsolation(meta = {}) {
  const errors = [];
  const forbidden = ["tabletop-v2", "character-v2-live", "worldbook-runtime"];
  for (const [key, value] of Object.entries(meta)) {
    if (key === "mode") continue;
    if (typeof value === "string" && forbidden.some((f) => value.includes(f))) {
      errors.push(`${key} must not share forbidden namespace: ${value}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
