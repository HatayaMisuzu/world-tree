// asset-status-registry.js — Machine-readable asset maturity registry
// Stage 0: Asset Maturation — World Tree Maturation v1

export const MATURATION_STATUS = Object.freeze({
  MATURE_ACTIVE: "mature-active",
  KERNEL_COMPLETE: "kernel-complete",
  INTEGRATION_READY: "integration-ready",
  NEEDS_MATURATION: "needs-maturation",
  LEGACY_COMPAT: "legacy-compat",
  PROTOTYPE_HOLD: "prototype-hold",
  DECLARED_HOLD: "declared-hold",
  DEFERRED: "deferred",
  DO_NOT_EXPOSE: "do-not-expose"
});

export const READINESS_LEVEL = Object.freeze({
  IDEA: 0,
  DOCUMENTED: 1,
  KERNEL: 2,
  TESTED: 3,
  SERVICE_ADAPTER: 4,
  WORKFLOW: 5,
  UI: 6
});

const STATUS_TO_MATURATION = {
  implemented: MATURATION_STATUS.INTEGRATION_READY,
  "legacy-wrapped": MATURATION_STATUS.LEGACY_COMPAT,
  "legacy-inline": MATURATION_STATUS.NEEDS_MATURATION,
  "prototype-hidden": MATURATION_STATUS.PROTOTYPE_HOLD,
  "declared-only": MATURATION_STATUS.DECLARED_HOLD,
  deprecated: MATURATION_STATUS.NEEDS_MATURATION,
  missing: MATURATION_STATUS.NEEDS_MATURATION
};

const KNOWN_PROTOTYPES = new Set([
  "trpg.dice","trpg.check","trpg.character_sheet","trpg.clock",
  "rpg.quest","rpg.bond","rpg.chapter","rpg.growth",
  "mystery.case","mystery.phase","mystery.clue","mystery.testimony","mystery.truth_lock","mystery.scoring",
  "strategy.resource","strategy.calendar","strategy.decision","strategy.faction","strategy.diplomacy","strategy.turn","strategy.loyalty",
  "puzzle.scene"
]);

const KNOWN_DECLARED = new Set([
  "core.memory","core.review","core.canon","core.debug",
  "creation.questioning","creation.outline"
]);

export function classifyModuleAsset(definition) {
  const status = definition?.status || "missing";
  const id = definition?.id || "";
  if (KNOWN_DECLARED.has(id)) return MATURATION_STATUS.DECLARED_HOLD;
  if (KNOWN_PROTOTYPES.has(id)) return MATURATION_STATUS.PROTOTYPE_HOLD;
  return STATUS_TO_MATURATION[status] || MATURATION_STATUS.NEEDS_MATURATION;
}

export function validateAssetExposure(asset) {
  const errors = [];
  const status = asset.maturationStatus || "";
  if (asset.userExposureAllowed && (status === MATURATION_STATUS.PROTOTYPE_HOLD || status === MATURATION_STATUS.DECLARED_HOLD)) {
    errors.push(`${asset.id}: prototype/declared must not be user-exposed`);
  }
  if (asset.workflowExposureAllowed && status === MATURATION_STATUS.PROTOTYPE_HOLD) {
    errors.push(`${asset.id}: prototype must not be workflow-exposed`);
  }
  return { ok: errors.length === 0, errors };
}

function classifyReadiness(asset) {
  if (asset.tested) return READINESS_LEVEL.TESTED;
  if (asset.sourcePath) return READINESS_LEVEL.DOCUMENTED;
  return READINESS_LEVEL.IDEA;
}

export function buildAssetStatusRegistry({ moduleManifest = {}, modeModuleMap = {}, p3Assets = [], promptAssets = [], kernelAssets = [] } = {}) {
  const registry = { version: 1, assets: [], generatedAt: new Date().toISOString(), summary: {} };
  const seen = new Set();

  for (const [id, def] of Object.entries(moduleManifest)) {
    if (seen.has(id)) continue; seen.add(id);
    const maturationStatus = classifyModuleAsset(def);
    const usedBy = new Set();
    for (const [modeId, modules] of Object.entries(modeModuleMap)) {
      if (modules.includes(id)) usedBy.add(modeId);
    }
    registry.assets.push({
      id, name: def.name || id, category: def.category || "unknown",
      sourcePath: def.sourceFiles?.[0] || "", sourceFiles: def.sourceFiles || [],
      currentStatus: def.status || "missing", maturationStatus,
      readinessLevel: def.sourceFiles?.length > 0 ? READINESS_LEVEL.DOCUMENTED : READINESS_LEVEL.IDEA,
      userExposureAllowed: maturationStatus !== MATURATION_STATUS.PROTOTYPE_HOLD && maturationStatus !== MATURATION_STATUS.DECLARED_HOLD,
      workflowExposureAllowed: maturationStatus === MATURATION_STATUS.MATURE_ACTIVE || maturationStatus === MATURATION_STATUS.INTEGRATION_READY,
      canonWriteAllowed: false,
      usedByModes: [...usedBy], notes: def.notes || ""
    });
  }

  for (const a of kernelAssets) { if (!seen.has(a.id)) { seen.add(a.id); registry.assets.push({ ...a, maturationStatus: MATURATION_STATUS.KERNEL_COMPLETE, readinessLevel: READINESS_LEVEL.TESTED }); } }
  for (const a of promptAssets) { if (!seen.has(a.id)) { seen.add(a.id); registry.assets.push({ ...a, maturationStatus: MATURATION_STATUS.INTEGRATION_READY, readinessLevel: READINESS_LEVEL.TESTED }); } }
  for (const a of p3Assets) { if (!seen.has(a.id)) { seen.add(a.id); registry.assets.push({ ...a, maturationStatus: MATURATION_STATUS.KERNEL_COMPLETE, readinessLevel: READINESS_LEVEL.TESTED }); } }

  const counts = {};
  for (const a of registry.assets) { counts[a.maturationStatus] = (counts[a.maturationStatus] || 0) + 1; }
  registry.summary = { total: registry.assets.length, ...counts };
  return registry;
}

export function summarizeAssetStatus(registry) { return registry?.summary || {}; }

export function getAssetsByStatus(registry, status) { return (registry?.assets || []).filter(a => a.maturationStatus === status); }
