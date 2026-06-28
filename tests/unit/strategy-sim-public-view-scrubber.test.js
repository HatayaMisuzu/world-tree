import test from "node:test";
import assert from "node:assert/strict";
import { sealStrategySimSpec } from "../../src/core/strategy-sim/strategy-sim-spec.js";
import { createStrategyRunState } from "../../src/core/strategy-sim/strategy-sim-run-state.js";
import { scrubStrategyPublicView, assertNoHiddenStrategyLeak } from "../../src/core/strategy-sim/strategy-sim-public-view-scrubber.js";
import { buildStrategyReportContext } from "../../src/core/strategy-sim/strategy-sim-report-context.js";

function sealedSpec() {
  return sealStrategySimSpec({
    specId: "visibility-spec",
    title: "Visibility Spec",
    turnUnit: "turn",
    resources: [
      { id: "cash", label: "Cash", initial: 50, min: 0, max: 100, visibility: "public", recoveryActions: ["recover"] },
      { id: "morale", label: "Morale", initial: 70, min: 0, max: 100, visibility: "partial", recoveryActions: ["recover"] }
    ],
    variables: [
      { id: "secret_pressure", label: "Secret Pressure", initial: 80, min: 0, max: 100, visibility: "secret", recoveryActions: ["recover"] },
      { id: "hidden_risk", label: "Hidden Risk", initial: 40, min: 0, max: 100, visibility: "hidden", recoveryActions: ["recover"], playerFacingHint: "风险正在累积" }
    ],
    probabilityRules: [
      { id: "hidden_roll", baseChance: 0.8, visibility: "hidden" }
    ]
  }, { sealedAt: "2026-01-01T00:00:00.000Z" });
}

test("scrubStrategyPublicView hides hidden exact values and omits secret", () => {
  const spec = sealedSpec();
  const state = createStrategyRunState(spec);
  const view = scrubStrategyPublicView(spec, state);
  assert.equal(view.resources.find((item) => item.id === "cash").value, 50);
  assert.equal(view.resources.find((item) => item.id === "morale").value, undefined);
  assert.ok(view.variables.find((item) => item.id === "hidden_risk").hint);
  assert.equal(view.variables.find((item) => item.id === "secret_pressure"), undefined);
});

test("report context contains no hidden raw fields", () => {
  const spec = sealedSpec();
  const state = createStrategyRunState(spec);
  const context = buildStrategyReportContext(spec, state);
  assertNoHiddenStrategyLeak(context);
  const text = JSON.stringify(context);
  assert.doesNotMatch(text, /secretState/);
  assert.doesNotMatch(text, /hiddenState/);
  assert.doesNotMatch(text, /secret_pressure.*80/);
});
