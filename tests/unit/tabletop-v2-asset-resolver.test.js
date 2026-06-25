// Tabletop V2 Asset Resolver Tests
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTabletopAssetBindings,
  buildTabletopAssetSnapshot,
  assertTabletopAssetSnapshotReadonly,
  assertTabletopRuntimeDoesNotWriteToSourceAssets,
} from "../../src/core/tabletop/tabletop-v2-asset-resolver.js";

test("resolveTabletopAssetBindings: resolves worldbook ref", () => {
  const module = {
    assetBindings: [{ type: "worldbook", ref: "wb_village" }],
  };
  const assetStore = {
    worldbook: { wb_village: { name: "Village", description: "A small village" } },
  };
  const { snapshots, resolved, errors } = resolveTabletopAssetBindings({ module, assetStore });
  assert.equal(resolved.length, 1);
  assert.ok(snapshots["wb_village"]);
  assert.equal(snapshots["wb_village"].name, "Village");
  assert.equal(snapshots["wb_village"]._snapshot, true);
  assert.equal(errors.length, 0);
});

test("resolveTabletopAssetBindings: strips character live runtime", () => {
  const module = {
    assetBindings: [{ type: "character", ref: "char_hero" }],
  };
  const assetStore = {
    characters: {
      char_hero: { name: "Hero", liveMemory: ["secret"], liveRelationships: {}, liveRuntime: {} },
    },
  };
  const { snapshots } = resolveTabletopAssetBindings({ module, assetStore });
  const char = snapshots["char_hero"];
  assert.ok(char);
  assert.equal(char.name, "Hero");
  assert.equal(char.liveMemory, undefined);
  assert.equal(char.liveRelationships, undefined);
  assert.equal(char.liveRuntime, undefined);
});

test("resolveTabletopAssetBindings: handles missing refs gracefully", () => {
  const module = {
    assetBindings: [{ type: "worldbook", ref: "nonexistent" }],
  };
  const { resolved, errors } = resolveTabletopAssetBindings({ module, assetStore: {} });
  assert.equal(resolved.length, 0);
});

test("buildTabletopAssetSnapshot: produces frozen snapshot", () => {
  const snapshot = buildTabletopAssetSnapshot({
    worldbookRefs: [{ name: "wb1" }],
    characterRefs: [{ name: "char1" }],
  });
  assert.equal(snapshot.frozen, true);
  assert.ok(snapshot.frozenAt);
  assert.equal(snapshot.worldbook.length, 1);
  assert.equal(snapshot.characters.length, 1);
});

test("assertTabletopAssetSnapshotReadonly: rejects unfrozen snapshot", () => {
  const result = assertTabletopAssetSnapshotReadonly({ frozen: false });
  assert.equal(result.readonly, false);
});

test("assertTabletopAssetSnapshotReadonly: rejects snapshot with live runtime", () => {
  const result = assertTabletopAssetSnapshotReadonly({
    frozen: true,
    characters: [{ _sourceId: "c1", liveMemory: ["leaked"] }],
  });
  assert.equal(result.readonly, false);
});

test("assertTabletopAssetSnapshotReadonly: clean snapshot passes", () => {
  const result = assertTabletopAssetSnapshotReadonly({
    frozen: true,
    characters: [{ _sourceId: "c1", name: "Clean" }],
  });
  assert.equal(result.readonly, true);
});

test("assertTabletopRuntimeDoesNotWriteToSourceAssets: detects live runtime refs", () => {
  const state = { publicState: {}, liveMemory: ["leaked"], runtimeIsolation: { modeId: "tabletop" } };
  const { clean, violations } = assertTabletopRuntimeDoesNotWriteToSourceAssets(state, {});
  assert.equal(clean, false);
  assert.ok(violations.length > 0);
});

test("assertTabletopRuntimeDoesNotWriteToSourceAssets: clean state passes", () => {
  const state = {
    publicState: {},
    runtimeIsolation: {
      modeId: "tabletop",
      runtimeNamespace: "tabletop-v2:test",
      cacheNamespace: "tabletop-v2:test:cache",
      saveNamespace: "tabletop-v2:test:save",
      branchNamespace: "tabletop-v2:test:branch",
      llmNamespace: "tabletop-v2:test:llm",
    },
  };
  const { clean } = assertTabletopRuntimeDoesNotWriteToSourceAssets(state, {});
  assert.equal(clean, true);
});
