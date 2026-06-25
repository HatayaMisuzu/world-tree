// Tabletop V2 Asset Resolver
// Resolves assetBindings to read-only snapshots.
// Runtime changes never write back to source assets.

import { assertRuntimeNamespaceIsolation } from "../mode/mode-asset-linkage-contract.js";

// ── Resolve bindings to snapshot ──

export function resolveTabletopAssetBindings({ module, assetStore = {} } = {}) {
  if (!module) return { snapshots: {}, resolved: [], errors: [] };

  const snapshots = {};
  const resolved = [];
  const errors = [];

  const bindings = module.assetBindings || [];

  for (const binding of bindings) {
    try {
      const snapshot = resolveSingleBinding(binding, assetStore);
      if (snapshot) {
        snapshots[binding.ref || binding.assetId] = snapshot;
        resolved.push({ ref: binding.ref || binding.assetId, type: binding.type, resolved: true });
      }
    } catch (err) {
      errors.push({ ref: binding.ref || binding.assetId, error: err.message });
    }
  }

  return { snapshots, resolved, errors };
}

function resolveSingleBinding(binding, assetStore) {
  const { type, ref, assetId } = binding;
  const id = ref || assetId;
  if (!id) return null;

  switch (type) {
    case "worldbook": {
      const entry = assetStore.worldbook?.[id];
      return entry ? { ...entry, _snapshot: true, _sourceType: "worldbook", _sourceId: id } : null;
    }
    case "character": {
      const char = assetStore.characters?.[id];
      // Snapshot must NOT include live runtime memory/relationship
      if (char) {
        const { liveMemory, liveRelationships, liveRuntime, ...safe } = char;
        return { ...safe, _snapshot: true, _sourceType: "character", _sourceId: id };
      }
      return null;
    }
    case "ruleset": {
      const ruleset = assetStore.rulesets?.[id];
      return ruleset ? { ...ruleset, _snapshot: true, _sourceType: "ruleset", _sourceId: id } : null;
    }
    case "randomTable": {
      const table = assetStore.randomTables?.[id];
      return table ? { ...table, _snapshot: true, _sourceType: "randomTable", _sourceId: id } : null;
    }
    default:
      return null;
  }
}

// ── Build snapshot package ──

export function buildTabletopAssetSnapshot({ worldbookRefs = [], characterRefs = [], rulesetRefs = [], randomTableRefs = [] } = {}) {
  return {
    worldbook: [...worldbookRefs],
    characters: [...characterRefs],
    rulesets: [...rulesetRefs],
    randomTables: [...randomTableRefs],
    frozen: true,
    frozenAt: new Date().toISOString(),
  };
}

// ── Assert read-only ──

export function assertTabletopAssetSnapshotReadonly(snapshot) {
  if (!snapshot) return { readonly: false, reason: "no snapshot" };
  if (!snapshot.frozen) return { readonly: false, reason: "snapshot not frozen" };

  // Verify no character snapshot contains live runtime data
  const chars = snapshot.characters || [];
  for (const char of chars) {
    if (char.liveMemory || char.liveRelationships || char.liveRuntime) {
      return { readonly: false, reason: `character ${char._sourceId || "unknown"} contains live runtime data` };
    }
  }

  return { readonly: true };
}

// ── Assert no write-back ──

export function assertTabletopRuntimeDoesNotWriteToSourceAssets(tabletopRunState = {}, sourceAssets = {}) {
  const violations = [];

  // Check: tabletop run state never references character live paths
  const stateStr = JSON.stringify(tabletopRunState);
  if (stateStr.includes("liveMemory") || stateStr.includes("liveRelationships")) {
    violations.push("tabletop run state contains character live runtime references");
  }

  // Check: tabletop paths are all under engine/tabletop-v2
  const isolation = tabletopRunState.runtimeIsolation;
  if (isolation) {
    try {
      assertRuntimeNamespaceIsolation(isolation, "tabletop");
    } catch (e) {
      violations.push(e.message);
    }
  }

  return { clean: violations.length === 0, violations };
}
