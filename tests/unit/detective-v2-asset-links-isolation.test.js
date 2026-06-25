import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetectiveAssetLinks, validateDetectiveAssetLinks, createDetectiveRuntimeIsolationMeta, assertDetectiveRuntimeIsolation } from "../../src/core/detective/detective-asset-links.js";

test("createDetectiveRuntimeIsolationMeta: default namespaces", () => {
  const meta = createDetectiveRuntimeIsolationMeta();
  assert.equal(meta.runNamespace, "detective-v2");
  assert.equal(meta.cacheNamespace, "detective-v2");
});

test("assertDetectiveRuntimeIsolation: clean passes", () => {
  const meta = createDetectiveRuntimeIsolationMeta();
  assert.equal(assertDetectiveRuntimeIsolation(meta).ok, true);
});

test("assertDetectiveRuntimeIsolation: tabletop leakage fails", () => {
  const meta = createDetectiveRuntimeIsolationMeta({ runNamespace: "tabletop-v2::something" });
  const result = assertDetectiveRuntimeIsolation(meta);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes("tabletop-v2")));
});

test("assertDetectiveRuntimeIsolation: character-v2-live leakage fails", () => {
  const meta = createDetectiveRuntimeIsolationMeta({ cacheNamespace: "character-v2-live" });
  assert.equal(assertDetectiveRuntimeIsolation(meta).ok, false);
});

test("normalizeDetectiveAssetLinks: default", () => {
  const links = normalizeDetectiveAssetLinks({ worldbookRefs: ["wb1"] });
  assert.deepEqual(links.worldbookRefs, ["wb1"]);
});

test("validateDetectiveAssetLinks: valid", () => {
  assert.equal(validateDetectiveAssetLinks(normalizeDetectiveAssetLinks({})).valid, true);
});
