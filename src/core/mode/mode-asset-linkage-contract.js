// Mode Asset Linkage Contract
// Pure functions for normalizing/validating inter-mode asset references.
// Does not create runtime state. Detective fields are future-safe slots only.

const SCHEMA_VERSION = "world-tree.mode.asset-bindings.1";

// ── Normalizer ──

export function normalizeModeAssetBindings(input = {}) {
  if (!input || typeof input !== "object") return null;

  return {
    schemaVersion: input.schemaVersion || SCHEMA_VERSION,
    modeId: input.modeId || "",
    moduleId: input.moduleId || "",
    worldbookRefs: input.worldbookRefs || [],
    characterRefs: input.characterRefs || [],
    rulesetRefs: input.rulesetRefs || [],
    clockRefs: input.clockRefs || [],
    randomTableRefs: input.randomTableRefs || [],
    // Detective V2 future slots
    evidenceRefs: input.evidenceRefs || [],
    testimonyRefs: input.testimonyRefs || [],
    // UI / source references
    uiComponentRefs: input.uiComponentRefs || [],
    sourceRefs: input.sourceRefs || [],
    notes: input.notes || "",
  };
}

// ── Validator ──

export function validateModeAssetBindings(bindings = {}) {
  const errors = [];
  if (!bindings.modeId) errors.push("modeId is required");
  if (!bindings.moduleId) errors.push("moduleId is required");
  if (!Array.isArray(bindings.worldbookRefs)) errors.push("worldbookRefs must be an array");
  if (!Array.isArray(bindings.characterRefs)) errors.push("characterRefs must be an array");
  return { valid: errors.length === 0, errors };
}

// ── Runtime namespace ──

export function createModeRuntimeNamespace({ modeId, moduleId, runId } = {}) {
  if (!modeId) throw new Error("modeId is required");
  const parts = [modeId];
  if (moduleId) parts.push(moduleId);
  if (runId) parts.push(runId);
  return parts.join("::");
}

// ── Isolation assertion ──

export function assertRuntimeNamespaceIsolation({ modeId, namespace } = {}) {
  if (!modeId || !namespace) return { ok: false, reason: "modeId and namespace are required" };
  const prefix = `${modeId}::`;
  if (!namespace.startsWith(prefix)) {
    return {
      ok: false,
      reason: `namespace "${namespace}" does not start with mode prefix "${prefix}"`,
    };
  }
  return { ok: true };
}

// ── Read-only asset snapshot ──

export function buildReadOnlyAssetSnapshot({ modeId, moduleId, assetBindings, assets } = {}) {
  if (!assetBindings) return null;
  return {
    schemaVersion: assetBindings.schemaVersion || SCHEMA_VERSION,
    modeId: modeId || assetBindings.modeId,
    moduleId: moduleId || assetBindings.moduleId,
    sourceModuleId: assetBindings.moduleId,
    createdAt: new Date().toISOString(),
    worldbookRefs: [...(assetBindings.worldbookRefs || [])],
    characterRefs: [...(assetBindings.characterRefs || [])],
    rulesetRefs: [...(assetBindings.rulesetRefs || [])],
    clockRefs: [...(assetBindings.clockRefs || [])],
    randomTableRefs: [...(assetBindings.randomTableRefs || [])],
    evidenceRefs: [...(assetBindings.evidenceRefs || [])],
    testimonyRefs: [...(assetBindings.testimonyRefs || [])],
    _readOnly: true,
    _mutableAssets: undefined, // never attach live mutable objects
  };
}
