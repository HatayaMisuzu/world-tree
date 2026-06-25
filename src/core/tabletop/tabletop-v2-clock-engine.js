// Tabletop V2 Clock Engine
// Progress clocks for tracking faction moves, impending threats, and timed events.
// Clocks are project assets with public/hidden visibility.

// ── Factory ──

export function createClock({ id, label, segments = 4, value = 0, visibility = "public", source = "module", maxSegments } = {}) {
  const max = maxSegments || segments;
  return {
    id: id || `clock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: label || "时钟",
    segments: max,
    value: Math.max(0, Math.min(max, Number(value) || 0)),
    visibility,
    source,
    createdAt: new Date().toISOString(),
    history: [],
  };
}

// ── Advance ──

export function advanceClock(clock, amount = 1, reason = "") {
  if (!clock || typeof clock.segments !== "number") throw new Error("invalid clock");
  const previous = clock.value;
  const newValue = Math.min(clock.segments, previous + Math.abs(amount));
  const filled = newValue === clock.segments;

  const updated = {
    ...clock,
    value: newValue,
    filled,
    history: [
      ...(clock.history || []),
      {
        timestamp: new Date().toISOString(),
        from: previous,
        to: newValue,
        amount,
        reason,
      },
    ],
  };

  return updated;
}

// ── Consequences ──

export function resolveClockConsequences(clocks = [], runState = {}) {
  const filled = clocks.filter((c) => c.filled);
  const active = clocks.filter((c) => !c.filled);

  return {
    triggers: filled.map((c) => ({
      clockId: c.id,
      label: c.label,
      trigger: `${c.label} 已满！`,
      source: c.source,
      visibility: c.visibility,
    })),
    active,
    allFilled: filled.length > 0 && active.length === 0,
    anyFilled: filled.length > 0,
  };
}

// ── Validator ──

export function validateClock(clock = {}) {
  const errors = [];
  if (!clock.id) errors.push("clock id is required");
  if (!clock.label) errors.push("clock label is required");
  if (!Number.isInteger(clock.segments) || clock.segments < 1) errors.push("segments must be a positive integer");
  if (!Number.isInteger(clock.value) || clock.value < 0 || clock.value > clock.segments) {
    errors.push(`value must be between 0 and ${clock.segments}, got ${clock.value}`);
  }
  if (!["public", "hidden"].includes(clock.visibility)) errors.push("visibility must be 'public' or 'hidden'");
  if (!Array.isArray(clock.history)) errors.push("history must be an array");
  return { valid: errors.length === 0, errors };
}

// ── Clone (immutable update helper) ──

export function cloneClock(clock) {
  return {
    ...clock,
    history: [...(clock.history || [])],
  };
}

// ── Summarize for player UI ──

export function summarizePublicClocks(clocks = []) {
  return clocks
    .filter((c) => c.visibility === "public")
    .map((c) => ({
      id: c.id,
      label: c.label,
      segments: c.segments,
      value: c.value,
      filled: c.filled || c.value >= c.segments,
      percentage: Math.round((c.value / c.segments) * 100),
    }));
}
