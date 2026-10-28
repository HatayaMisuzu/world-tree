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

// ── dc-3: clock ids independent of wall clock ──

function withMockedDate(clockStart, fn) {
  const RealDate = Date;
  let t = clockStart;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [t += 7])); }
    static now() { return (t += 7); }
  };
  try { return fn(); }
  finally { globalThis.Date = RealDate; }
}

test("dc-3: createClock id stable under mocked Date for same inputs", () => {
  const capture = (clockStart) => withMockedDate(clockStart, () => {
    const c = createClock({ label: "Faction Move", segments: 6, visibility: "public", source: "module" });
    return { id: c.id, label: c.label, segments: c.segments };
  });
  const a = capture(1_000_000_000_000);
  const b = capture(2_000_000_000_000);
  assert.deepEqual(a, b);
  assert.match(a.id, /^clock-[0-9a-f]{16}$/);
});

test("dc-3: explicit id wins; different labels diverge", () => {
  const c1 = createClock({ id: "fixed", label: "A" });
  const c2 = createClock({ label: "A", segments: 4 });
  const c3 = createClock({ label: "B", segments: 4 });
  assert.equal(c1.id, "fixed");
  assert.notEqual(c2.id, c3.id);
  assert.equal(c2.id, createClock({ label: "A", segments: 4 }).id);
});


// ── Sequence index in stableId (same-params collision fix) ──

test("createClock: different indices yield different ids for identical params", () => {
  const params = { label: "Faction Move", segments: 6, visibility: "public", source: "module" };
  const a = createClock({ ...params, index: 0 });
  const b = createClock({ ...params, index: 1 });
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^clock-[0-9a-f]{16}$/);
  assert.match(b.id, /^clock-[0-9a-f]{16}$/);
});

test("createClock: same inputs including index yield same id (Date-independent)", () => {
  const capture = (clockStart, index) => withMockedDate(clockStart, () => {
    return createClock({
      label: "Faction Move",
      segments: 6,
      visibility: "public",
      source: "module",
      index,
    }).id;
  });
  const a = capture(1_000_000_000_000, 2);
  const b = capture(2_000_000_000_000, 2);
  assert.equal(a, b);
  assert.notEqual(a, capture(1_000_000_000_000, 3));
});

test("createClock: seq alias matches index in stableId", () => {
  const params = { label: "Timer", segments: 4, visibility: "hidden", source: "module" };
  assert.equal(createClock({ ...params, index: 5 }).id, createClock({ ...params, seq: 5 }).id);
  assert.notEqual(createClock({ ...params, index: 5 }).id, createClock({ ...params, seq: 6 }).id);
});
