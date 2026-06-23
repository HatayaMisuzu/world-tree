// tests/unit/legacy-modernization.test.js
import test from "node:test"; import assert from "node:assert/strict";
import { classifyLegacyModule, canExposeLegacyModule, getModernizationAction, buildLegacyModernizationReport, LM_STATUS } from "../../src/core/legacy/legacy-modernization-registry.js";
import { P3_MERGE_MAP, getP3Equivalent } from "../../src/core/legacy/p3-merge-map.js";

test("legacy wrapped modules remain callable", () => {
  assert.equal(classifyLegacyModule({ status: "legacy-wrapped" }), LM_STATUS.WRAPPED_SAFE);
});
test("legacy inline modules have modernization action", () => {
  assert.equal(classifyLegacyModule({ status: "legacy-inline" }), LM_STATUS.INLINE_NEEDS_WRAPPER);
  assert.ok(getModernizationAction("entity.organization").length > 0);
});
test("prototype hidden modules are not exposable", () => {
  const c = classifyLegacyModule({ status: "prototype-hidden" });
  assert.equal(c, LM_STATUS.PROTOTYPE_FROZEN);
  assert.equal(canExposeLegacyModule({ status: "prototype-hidden" }), false);
});
test("declared only modules are hold", () => {
  assert.equal(classifyLegacyModule({ status: "declared-only" }), LM_STATUS.DECLARED_HOLD);
  assert.equal(canExposeLegacyModule({ status: "declared-only" }), false);
});
test("P3 merge map covers overlapping modules", () => {
  assert.equal(getP3Equivalent("character.cognition"), "M5 Character Cognition Matrix");
  assert.equal(getP3Equivalent("rule.world_rule"), "M7 World Rules Engine");
  assert.equal(getP3Equivalent("event.random_event"), "M9 Random Event Pool");
  assert.equal(getP3Equivalent("creation.alchemy"), "M2 Alchemy Digest + M3 Material Warehouse");
});
test("buildLegacyModernizationReport has status counts", () => {
  const r = buildLegacyModernizationReport({ a: { status: "legacy-wrapped" }, b: { status: "legacy-inline" }, c: { status: "prototype-hidden" } });
  assert.ok(r.total >= 3);
});
