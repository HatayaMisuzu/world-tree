import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeededRngState,
  nextSeededRandom,
  normalizeProbabilityEvent,
  rollProbabilityEvent
} from "../../src/core/strategy-sim/strategy-probability-system.js";

test("seeded RNG is reproducible with seed and counter", () => {
  const a = nextSeededRandom(createSeededRngState("abc", 0));
  const b = nextSeededRandom(createSeededRngState("abc", 0));
  assert.equal(a.value, b.value);
  assert.equal(a.rngState.counter, 1);
});

test("probability roll creates auditable roll record", () => {
  const event = normalizeProbabilityEvent({
    id: "deal",
    baseChance: 0.5,
    modifiers: [{ source: "public_bonus", value: 0.1 }],
    hiddenModifiers: [{ source: "hidden_penalty", value: -0.05 }],
    visibility: "partial"
  });
  const result = rollProbabilityEvent(event, createSeededRngState("roll", 3), { turn: 2, createdAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(result.rolled, true);
  assert.equal(result.rollRecord.checkId, "deal");
  assert.equal(result.rollRecord.turn, 2);
  assert.equal(result.rollRecord.rngSeed, "roll");
  assert.equal(result.rollRecord.rngCounter, 3);
  assert.equal(typeof result.rollRecord.roll, "number");
  assert.ok(["success", "failure"].includes(result.rollRecord.result));
});

test("LLM cannot supply probability result through event object", () => {
  const event = normalizeProbabilityEvent({ id: "forced", baseChance: 0, llmResult: "success" });
  const result = rollProbabilityEvent(event, () => 0.99);
  assert.equal(result.success, false);
});
