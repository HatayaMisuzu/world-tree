import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStrategySimSpec,
  validateStrategySimSpec,
  sealStrategySimSpec,
  isSealedStrategySimSpec,
  assertSealedStrategySimSpec
} from "../../src/core/strategy-sim/strategy-sim-spec.js";

function baseSpec() {
  return {
    specId: "spec-test",
    title: "Framework Spec",
    turnUnit: "turn",
    resources: [
      { id: "cash", label: "Cash", initial: 50, min: 0, max: 100, maxDeltaPerTurn: 15, visibility: "public", recoveryActions: ["recover_cash"] }
    ],
    variables: [
      { id: "pressure", label: "Pressure", initial: 30, min: 0, max: 100, visibility: "hidden", recoveryActions: ["reduce_pressure"] }
    ],
    mechanisms: [
      { id: "invest", label: "Invest", triggerTags: ["invest"], effects: [{ targetId: "cash", targetType: "resource", delta: -10 }] }
    ],
    probabilityRules: [
      { id: "deal", label: "Deal", triggerTags: ["deal"], baseChance: 0.5, visibility: "partial" }
    ],
    eventDecks: [
      { id: "pressure_events", triggerTags: ["risk"], events: [{ id: "minor_risk", weight: 1, visibility: "partial" }] }
    ]
  };
}

test("normalizeStrategySimSpec builds framework spec without archetype", () => {
  const spec = normalizeStrategySimSpec(baseSpec());
  assert.equal(spec.mode, "strategy-sim");
  assert.equal(spec.resources[0].id, "cash");
  assert.equal(spec.visibilityPolicy.strict, true);
});

test("validateStrategySimSpec rejects unknown effect targets", () => {
  const raw = baseSpec();
  raw.mechanisms[0].effects[0].targetId = "missing";
  const result = validateStrategySimSpec(raw);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown resource/);
});

test("sealStrategySimSpec creates immutable sealed spec", () => {
  const spec = sealStrategySimSpec(baseSpec(), { sealedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(isSealedStrategySimSpec(spec), true);
  assert.ok(spec.sealMetadata.specHash);
  assert.throws(() => { spec.title = "mutated"; }, TypeError);
});

test("assertSealedStrategySimSpec rejects unsealed spec", () => {
  assert.throws(() => assertSealedStrategySimSpec(normalizeStrategySimSpec(baseSpec())));
});
