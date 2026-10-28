import test from "node:test";
import assert from "node:assert/strict";

import {
  createCalendar,
  advanceCalendar,
  calendarDisplay,
  resolveTurnDelta,
  worldTick,
  DAY_PHASES,
  SEASON_NAMES
} from "../../src/core/engine/world-tick.js";
import { createWorldPanel } from "../../src/core/data/world-state.js";
import { restoreRuntimeSnapshot } from "../../src/core/engine/archive-state.js";

test("createCalendar defaults are structured and wall-clock-free", () => {
  const c = createCalendar();
  assert.deepEqual(c, { year: 1, season: 1, week: 1, day: 1, totalDays: 0 });
  assert.equal("updatedAt" in c, false);
  assert.equal("createdAt" in c, false);
});

test("advanceCalendar: period/day advances totalDays; normalizes week/season/year", () => {
  let c = createCalendar();
  c = advanceCalendar(c, "period", 1);
  assert.equal(c.totalDays, 1);
  assert.equal(c.day, 2);

  c = advanceCalendar(createCalendar(), "day", 30);
  assert.equal(c.totalDays, 30);
  assert.equal(c.day, 1);
  assert.equal(c.week, 2);

  c = advanceCalendar({ year: 1, season: 4, week: 4, day: 30, totalDays: 100 }, "day", 1);
  assert.equal(c.season, 1);
  assert.equal(c.year, 2);
  assert.equal(c.week, 1);
  assert.equal(c.day, 1);
  assert.equal(c.totalDays, 101);
});

test("calendarDisplay uses season names without ISO timestamps", () => {
  const label = calendarDisplay({ year: 3, season: 2, week: 2, day: 5, totalDays: 40 });
  assert.equal(label, `第3年·${SEASON_NAMES[2]}季·第2周·第5日`);
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(label), false);
});

test("resolveTurnDelta: 原地等待 / wait → one period; other inputs → null", () => {
  assert.deepEqual(resolveTurnDelta("我原地等待。"), { unit: "period", amount: 1, reason: "wait-idle" });
  assert.deepEqual(resolveTurnDelta("wait here a moment"), { unit: "period", amount: 1, reason: "wait-idle" });
  assert.equal(resolveTurnDelta("我检查旧锚链齿轮。"), null);
  assert.equal(resolveTurnDelta(""), null);
});

test("worldTick(period): advances calendar + worldPanel + timeline + proximity", () => {
  const panel = createWorldPanel();
  panel.currentTime.dayPhase = "早晨";
  panel.currentTime.dayNumber = 0;
  const timeline = { current: "start", events: [] };
  const entities = [
    { id: "e1", name: "A", time: "present", location: "sameScene", relationship: "friend" },
    { id: "e2", name: "B", time: "recent", location: "nearby", relationship: "acquainted" }
  ];

  const before = createCalendar();
  const result = worldTick(
    { calendar: before, worldPanel: panel, timeline, entities, protagonist: { name: "P", location: "广场" } },
    { unit: "period", amount: 1, reason: "wait-idle" }
  );

  assert.ok(result.applied);
  assert.equal(result.calendar.totalDays, 1);
  assert.equal(result.worldPanel.currentTime.dayNumber, 1);
  assert.ok(DAY_PHASES.includes(result.worldPanel.currentTime.dayPhase));
  assert.equal(result.worldPanel.currentTime.display, calendarDisplay(result.calendar));
  assert.equal(result.timeline.step, "period");
  assert.ok(Array.isArray(result.timeline.events) && result.timeline.events.length >= 1);
  const a = result.entities.find((e) => e.id === "e1");
  assert.equal(a.time, "recent");
  assert.ok(a.proximity);
});

test("worldTick is deterministic for calendar fields (same Δt → same calendar)", () => {
  const a = worldTick({ calendar: createCalendar() }, { unit: "period", amount: 3 });
  const b = worldTick({ calendar: createCalendar() }, { unit: "period", amount: 3 });
  assert.deepEqual(a.calendar, b.calendar);
  assert.equal(a.display, b.display);
});

test("worldTick with null delta does not advance", () => {
  const cal = createCalendar(2, 3);
  const result = worldTick({ calendar: cal }, null);
  assert.equal(result.applied, null);
  assert.deepEqual(result.calendar, cal);
});

test("old archives without calendar remain loadable", () => {
  const restored = restoreRuntimeSnapshot(
    { version: 2, subType: "classic", emotion: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }, turnCount: 4 },
    { dataMode: "worldbook" }
  );
  assert.equal(restored.turnCount, 4);
  assert.equal(restored.calendar, undefined);
  const simRestored = restoreRuntimeSnapshot(
    { version: 2, subType: "sim", calendar: null, resources: null },
    {}
  );
  assert.equal(simRestored.calendar, null);
});
