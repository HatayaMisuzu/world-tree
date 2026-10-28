/**
 * s3-1: worldTick(Δt) — unified structured-time advance entry.
 *
 * Absorbs calendar helpers from archived engine/sim.js (createCalendar /
 * advanceTime / display). Orchestrates existing keepable helpers:
 *   - data/world-state.js advanceTime
 *   - data/timeline.js advanceTime
 *   - data/proximity-scope.js onTimeAdvance
 *
 * Deterministic: calendar fields have no wall-clock; Δt selection is pure
 * over the turn input (default: wait/idle → one period = one calendar day).
 */
import { advanceTime as advanceWorldPanelTime, createWorldPanel } from "../data/world-state.js";
import { advanceTime as advanceTimelineTime } from "../data/timeline.js";
import { onTimeAdvance } from "../data/proximity-scope.js";

/** @typedef {{ year: number, season: number, week: number, day: number, totalDays: number }} Calendar */

export const TIME_UNITS = Object.freeze({
  day: { name: "日", hours: 24 },
  week: { name: "周", days: 7 },
  month: { name: "月", days: 30 },
  season: { name: "季", months: 3 },
  year: { name: "年", days: 365 },
  /** s3-1 period = one structured calendar day */
  period: { name: "时段", days: 1 }
});

export const SEASON_NAMES = Object.freeze(["", "春", "夏", "秋", "冬"]);

/** Day-phase labels used by world-state currentTime (display aid only). */
export const DAY_PHASES = Object.freeze([
  "黎明", "早晨", "上午", "中午", "下午", "傍晚", "夜晚", "深夜"
]);

/**
 * Create a structured calendar (absorbed from archive/src/core/engine/sim.js).
 * @param {number} [startYear=1]
 * @param {number} [startSeason=1]
 * @returns {Calendar}
 */
export function createCalendar(startYear = 1, startSeason = 1) {
  return {
    year: startYear,
    season: startSeason,
    week: 1,
    day: 1,
    totalDays: 0
  };
}

/**
 * Advance a structured calendar by a named unit (absorbed from sim.js).
 * `period` maps to one day (s3-1 minimal period rule).
 * @param {Calendar} calendar
 * @param {string} unit
 * @param {number} [amount=1]
 * @returns {Calendar}
 */
export function advanceCalendar(calendar, unit, amount = 1) {
  const base = calendar && typeof calendar === "object" ? calendar : createCalendar();
  const n = Math.max(0, Number(amount) || 0);
  const c = {
    year: Number(base.year) || 1,
    season: Number(base.season) || 1,
    week: Number(base.week) || 1,
    day: Number(base.day) || 1,
    totalDays: Number(base.totalDays) || 0
  };
  if (n === 0) return c;

  const resolved = unit === "period" ? "day" : unit;
  switch (resolved) {
    case "day":
      c.day += n;
      c.totalDays += n;
      break;
    case "week":
      c.day += n * 7;
      c.totalDays += n * 7;
      break;
    case "month":
      c.day += n * 30;
      c.totalDays += n * 30;
      break;
    case "season":
      c.day += n * 90;
      c.totalDays += n * 90;
      break;
    case "year":
      c.day += n * 360;
      c.totalDays += n * 360;
      break;
    default:
      // unknown unit: treat as period/day
      c.day += n;
      c.totalDays += n;
      break;
  }

  while (c.day > 30) {
    c.day -= 30;
    c.week += 1;
  }
  while (c.week > 4) {
    c.week -= 4;
    c.season += 1;
  }
  while (c.season > 4) {
    c.season -= 4;
    c.year += 1;
  }

  return c;
}

/** Human-readable calendar label (no wall-clock). */
export function calendarDisplay(cal = {}) {
  const c = cal && typeof cal === "object" ? cal : {};
  return `第${c.year || 1}年·${SEASON_NAMES[c.season] || ""}季·第${c.week || 1}周·第${c.day || 1}日`;
}

/**
 * Minimal Δt rule for a chat turn.
 * wait/idle (e.g. 原地等待) → one period; otherwise no advance.
 * @param {string} input
 * @returns {{ unit: string, amount: number, reason: string } | null}
 */
export function resolveTurnDelta(input = "") {
  const text = String(input || "").trim();
  if (!text) return null;
  // Primary s3-1 acceptance: 原地等待 / wait / idle / rest
  if (
    /原地等待|就地等待|在此等待|等待一会|等待一下|干等|闲等|休息一会|休息一下|先休息|发呆|闲逛|\bwait\b|\bidle\b|\brest\b|pass time|等候片刻/i.test(
      text
    )
  ) {
    return { unit: "period", amount: 1, reason: "wait-idle" };
  }
  return null;
}

/**
 * Unified worldTick(Δt).
 * @param {object} bag
 * @param {{ calendar?: Calendar, worldPanel?: object, timeline?: object, entities?: array, protagonist?: object }} bag
 * @param {{ unit?: string, amount?: number, reason?: string } | null} delta
 * @returns {{ calendar: Calendar, worldPanel: object|null, timeline: object|null, entities: array|null, applied: object|null, display: string }}
 */
export function worldTick(bag = {}, delta = null) {
  const amount = delta ? Math.max(0, Number(delta.amount) || 0) : 0;
  const unit = delta?.unit || "period";
  const calendarIn = bag.calendar;
  const worldPanelIn = bag.worldPanel;
  const timelineIn = bag.timeline;
  const entitiesIn = bag.entities;
  const protagonist = bag.protagonist || {};

  if (!delta || amount === 0) {
    const calendar = calendarIn && typeof calendarIn === "object" ? { ...calendarIn } : null;
    return {
      calendar,
      worldPanel: worldPanelIn || null,
      timeline: timelineIn || null,
      entities: entitiesIn || null,
      applied: null,
      display: calendar ? calendarDisplay(calendar) : ""
    };
  }

  const calendar = advanceCalendar(calendarIn || createCalendar(), unit, amount);

  let worldPanel = worldPanelIn;
  {
    // Keep a structured panel clock in sync with the calendar (create if absent).
    const panel = worldPanelIn && typeof worldPanelIn === "object" ? worldPanelIn : createWorldPanel();
    const prevPhase = panel.currentTime?.dayPhase || "";
    const phaseIdx = DAY_PHASES.indexOf(prevPhase);
    // One period/day: bump dayNumber to totalDays; nudge phase forward one slot (wrap).
    const nextPhase =
      unit === "period" || unit === "day"
        ? DAY_PHASES[phaseIdx >= 0 ? (phaseIdx + amount) % DAY_PHASES.length : 0]
        : prevPhase || DAY_PHASES[0];
    worldPanel = advanceWorldPanelTime(panel, {
      dayNumber: calendar.totalDays,
      dayPhase: nextPhase,
      display: calendarDisplay(calendar),
      season: SEASON_NAMES[calendar.season] || panel.currentTime?.season || ""
      // omit absolute (wall-clock) — leave whatever was there untouched via spread in helper
    });
  }

  let timeline = timelineIn;
  if (timeline && typeof timeline === "object") {
    timeline = advanceTimelineTime(timeline, unit === "period" ? "period" : unit);
  }

  let entities = entitiesIn;
  if (Array.isArray(entitiesIn) && entitiesIn.length > 0) {
    entities = onTimeAdvance(entitiesIn, "recent", protagonist);
  }

  return {
    calendar,
    worldPanel: worldPanel || null,
    timeline: timeline || null,
    entities: entities || null,
    applied: { unit, amount, reason: delta.reason || "explicit" },
    display: calendarDisplay(calendar)
  };
}

export default {
  TIME_UNITS,
  SEASON_NAMES,
  DAY_PHASES,
  createCalendar,
  advanceCalendar,
  calendarDisplay,
  resolveTurnDelta,
  worldTick
};
