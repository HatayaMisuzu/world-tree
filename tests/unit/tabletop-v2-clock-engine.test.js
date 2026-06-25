import test from "node:test";
import assert from "node:assert/strict";
import {
  createClock,
  advanceClock,
  resolveClockConsequences,
  validateClock,
  cloneClock,
  summarizePublicClocks,
} from "../../src/core/tabletop/tabletop-v2-clock-engine.js";

// ── Factory ──

test("createClock: default values", () => {
  const c = createClock({ id: "c1", label: "Test Clock" });
  assert.equal(c.id, "c1");
  assert.equal(c.label, "Test Clock");
  assert.equal(c.segments, 4);
  assert.equal(c.value, 0);
  assert.equal(c.visibility, "public");
  assert.ok(c.createdAt);
  assert.ok(Array.isArray(c.history));
});

test("createClock: custom segments and value", () => {
  const c = createClock({ label: "6-seg", segments: 6, value: 2 });
  assert.equal(c.segments, 6);
  assert.equal(c.value, 2);
});

test("createClock: hidden clock", () => {
  const c = createClock({ label: "Secret", visibility: "hidden" });
  assert.equal(c.visibility, "hidden");
});

// ── Advance ──

test("advanceClock: increments value", () => {
  const c = createClock({ label: "Progress", segments: 4 });
  const advanced = advanceClock(c, 1, "turn passed");
  assert.equal(advanced.value, 1);
  assert.equal(advanced.history.length, 1);
  assert.equal(advanced.history[0].reason, "turn passed");
});

test("advanceClock: does not exceed max segments", () => {
  const c = createClock({ label: "Full", segments: 4, value: 3 });
  const advanced = advanceClock(c, 5, "overflow");
  assert.equal(advanced.value, 4);
  assert.equal(advanced.filled, true);
});

test("advanceClock: marks filled when full", () => {
  const c = createClock({ label: "Almost", segments: 4, value: 3 });
  const advanced = advanceClock(c, 1);
  assert.equal(advanced.filled, true);
});

test("advanceClock: history accumulates", () => {
  let c = createClock({ label: "History", segments: 6 });
  c = advanceClock(c, 1, "first");
  c = advanceClock(c, 2, "second");
  assert.equal(c.history.length, 2);
  assert.equal(c.history[0].from, 0);
  assert.equal(c.history[0].to, 1);
  assert.equal(c.history[1].from, 1);
  assert.equal(c.history[1].to, 3);
});

test("advanceClock: negative amount treated as absolute", () => {
  const c = createClock({ label: "Negative", segments: 4 });
  const advanced = advanceClock(c, -2, "should advance by 2");
  assert.equal(advanced.value, 2);
});

// ── Consequences ──

test("resolveClockConsequences: detects filled clocks", () => {
  const c1 = advanceClock(createClock({ label: "A", segments: 2 }), 2);
  const c2 = advanceClock(createClock({ label: "B", segments: 4 }), 1);
  const result = resolveClockConsequences([c1, c2]);
  assert.equal(result.anyFilled, true);
  assert.equal(result.allFilled, false);
  assert.equal(result.triggers.length, 1);
  assert.equal(result.triggers[0].label, "A");
});

test("resolveClockConsequences: all filled", () => {
  const c1 = advanceClock(createClock({ label: "A", segments: 2 }), 2);
  const c2 = advanceClock(createClock({ label: "B", segments: 2 }), 2);
  const result = resolveClockConsequences([c1, c2]);
  assert.equal(result.allFilled, true);
});

// ── Validator ──

test("validateClock: valid clock passes", () => {
  const c = createClock({ label: "Valid" });
  const result = validateClock(c);
  assert.equal(result.valid, true);
});

test("validateClock: value out of range fails", () => {
  // Bypass createClock's clamping to test raw validation
  const c = { id: "bad", label: "Bad", segments: 4, value: 10, visibility: "public", history: [] };
  const result = validateClock(c);
  assert.equal(result.valid, false);
});

test("validateClock: invalid visibility fails", () => {
  const c = { ...createClock({ label: "Bad" }), visibility: "everyone" };
  const result = validateClock(c);
  assert.equal(result.valid, false);
});

// ── Clone ──

test("cloneClock: produces independent copy", () => {
  const c = createClock({ label: "Original", segments: 4 });
  const cloned = cloneClock(c);
  assert.equal(cloned.label, "Original");
  // mutate original
  c.label = "Changed";
  assert.equal(cloned.label, "Original", "clone should be independent");
});

// ── Summarize ──

test("summarizePublicClocks: filters hidden clocks", () => {
  const clocks = [
    createClock({ label: "Public", visibility: "public", segments: 4, value: 2 }),
    createClock({ label: "Hidden", visibility: "hidden", segments: 6, value: 5 }),
  ];
  const summary = summarizePublicClocks(clocks);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].label, "Public");
  assert.equal(summary[0].percentage, 50);
});
