import test from "node:test";
import assert from "node:assert/strict";
import { sealStrategySimSpec } from "../../src/core/strategy-sim/strategy-sim-spec.js";
import { createStrategyRunState, assertRunStateMatchesSpec, appendStrategyTurnLog } from "../../src/core/strategy-sim/strategy-sim-run-state.js";

function sealedSpec() {
  return sealStrategySimSpec({
    specId: "run-spec",
    title: "Run Spec",
    turnUnit: "turn",
    resources: [{ id: "cash", label: "Cash", initial: 60, min: 0, max: 100, visibility: "public", recoveryActions: ["recover"] }],
    variables: [{ id: "risk", label: "Risk", initial: 20, min: 0, max: 100, visibility: "hidden", recoveryActions: ["recover"] }]
  }, { sealedAt: "2026-01-01T00:00:00.000Z" });
}

test("createStrategyRunState initializes from sealed spec", () => {
  const spec = sealedSpec();
  const state = createStrategyRunState(spec, { runId: "run-1", rngSeed: "seed" });
  assert.equal(state.specId, spec.specId);
  assert.equal(state.specHash, spec.sealMetadata.specHash);
  assert.equal(state.resources.cash.value, 60);
  assert.equal(state.variables.risk.value, 20);
});

test("run state must match sealed spec hash", () => {
  const spec = sealedSpec();
  const state = createStrategyRunState(spec);
  assert.equal(assertRunStateMatchesSpec(state, spec), state);
  state.specHash = "wrong";
  assert.throws(() => assertRunStateMatchesSpec(state, spec), /specHash/);
});

test("appendStrategyTurnLog is append only", () => {
  const state = createStrategyRunState(sealedSpec());
  appendStrategyTurnLog(state, { turn: 1, playerActions: ["a"] }, { createdAt: "2026-01-01T00:00:00.000Z" });
  appendStrategyTurnLog(state, { turn: 2, playerActions: ["b"] }, { createdAt: "2026-01-01T00:01:00.000Z" });
  assert.equal(state.turnLog.length, 2);
  assert.deepEqual(state.turnLog.map((item) => item.turn), [1, 2]);
});
