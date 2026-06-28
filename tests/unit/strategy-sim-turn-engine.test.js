import test from "node:test";
import assert from "node:assert/strict";
import { sealStrategySimSpec } from "../../src/core/strategy-sim/strategy-sim-spec.js";
import { createStrategyRunState } from "../../src/core/strategy-sim/strategy-sim-run-state.js";
import { runStrategySimTurn } from "../../src/core/strategy-sim/strategy-sim-turn-engine.js";
import { runSoloStrategySimTurn } from "../../src/core/strategy-sim/strategy-sim-mode-adapter.js";

function sealedSpec() {
  return sealStrategySimSpec({
    specId: "turn-spec",
    title: "Turn Spec",
    turnUnit: "turn",
    resources: [
      { id: "cash", label: "Cash", initial: 50, min: 0, max: 100, maxDeltaPerTurn: 10, visibility: "public", recoveryActions: ["recover"] }
    ],
    variables: [
      { id: "pressure", label: "Pressure", initial: 20, min: 0, max: 100, maxDeltaPerTurn: 15, visibility: "hidden", recoveryActions: ["recover"] }
    ],
    mechanisms: [
      { id: "invest", label: "Invest", triggerTags: ["invest"], effects: [{ targetId: "cash", targetType: "resource", delta: -50, reason: "investment cost" }] }
    ],
    probabilityRules: [
      { id: "deal", label: "Deal", triggerTags: ["deal"], baseChance: 0.5, visibility: "partial" }
    ],
    eventDecks: [
      { id: "risk_events", label: "Risk Events", triggerTags: ["risk"], events: [{ id: "minor", label: "Minor Risk", weight: 1, visibility: "partial", publicText: "出现轻微风险。" }] }
    ],
    balanceProfile: { rngSeed: "turn-seed" }
  }, { sealedAt: "2026-01-01T00:00:00.000Z" });
}

test("runStrategySimTurn advances strict mixed pipeline", () => {
  const spec = sealedSpec();
  const state = createStrategyRunState(spec, { rngSeed: "turn-seed" });
  const result = runStrategySimTurn({
    spec,
    state,
    playerAction: "invest and deal with risk",
    options: { createdAt: "2026-01-01T00:00:00.000Z" }
  });
  assert.equal(result.status, "ok");
  assert.equal(result.turn, 1);
  assert.equal(result.state.resources.cash.value, 40, "delta should be capped by maxDeltaPerTurn");
  assert.equal(result.turnLog.probabilityRolls.length, 1);
  assert.equal(result.turnLog.eventResults.length, 1);
  assert.equal(result.reportContext.publicView.resources[0].id, "cash");
});

test("runStrategySimTurn rejects unsealed spec", () => {
  assert.throws(() => runStrategySimTurn({ spec: { mode: "strategy-sim" }, playerAction: "x" }), /sealed/);
});

test("mode adapter uses v2 runtime when sealed spec exists", () => {
  const spec = sealedSpec();
  const result = runSoloStrategySimTurn(
    { strategySimSpec: spec },
    { text: "invest and deal" },
    { rngSeed: "adapter-seed", createdAt: "2026-01-01T00:00:00.000Z" }
  );
  assert.equal(result.status, "ready");
  assert.equal(result.packet.schemaVersion, 2);
  assert.equal(result.packet.modeMeaning, "solo_strategy_sim_v2");
  assert.equal(result.packet.runtime.canonWrites.length, 0);
});

test("mode adapter preserves legacy fallback without sealed spec", () => {
  const result = runSoloStrategySimTurn({}, { text: "expand_trade" });
  assert.equal(result.status, "ready");
  assert.equal(result.packet.schemaVersion, 1);
});

test("mode adapter does not auto-seal unsealed spec", () => {
  const unsealed = { mode: "strategy-sim", specId: "x", turnUnit: "turn" };
  const result = runSoloStrategySimTurn({ strategySimSpec: unsealed }, { text: "x" });
  assert.equal(result.packet.schemaVersion, 1);
});
