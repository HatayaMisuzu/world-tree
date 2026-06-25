import test from "node:test";
import assert from "node:assert/strict";
import {
  detectEndingAvailable,
  buildEndingSummary,
  buildDefaultSessionSummary,
  validateEndingSummary,
} from "../../src/core/tabletop/tabletop-v2-ending-summary.js";
import { normalizeAdventureModule } from "../../src/core/tabletop/tabletop-v2-adventure-module.js";
import { createTabletopRun } from "../../src/core/tabletop/tabletop-v2-save-branch.js";

// ── Ending detection ──

test("detectEndingAvailable: no endings by default", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const result = detectEndingAvailable({ module, run });
  assert.equal(result.available, false);
});

test("detectEndingAvailable: scene ending detected", () => {
  const module = normalizeAdventureModule({
    title: "Test",
    scenes: [
      { title: "Final Scene", isEnding: true },
    ],
  });
  const run = createTabletopRun({ module });
  run.currentSceneId = module.scenes[0].sceneId;
  const result = detectEndingAvailable({ module, runState: run });
  assert.equal(result.available, true);
  assert.ok(result.endings.some((e) => e.source === "scene"));
});

test("detectEndingAvailable: book-defined condition", () => {
  const module = normalizeAdventureModule({
    title: "Test",
    endingPolicy: {
      conditions: [
        { id: "end1", label: "Boss defeated", minTurns: 3 },
      ],
    },
  });
  const run = createTabletopRun({ module });
  run.turnIndex = 5;
  const result = detectEndingAvailable({ module, runState: run });
  assert.equal(result.available, true);
  assert.ok(result.endings.some((e) => e.endingId === "end1"));
});

// ── Default summary ──

test("buildDefaultSessionSummary: produces summary", () => {
  const module = normalizeAdventureModule({ title: "Test Adventure" });
  const run = createTabletopRun({ module });
  run.turnIndex = 3;
  run.rollHistory = [
    { turnIndex: 1, roll: { expression: "1d20", total: 20, outcome: "critical_success" } },
  ];
  run.reviewCandidates = [
    { type: "major_choice", description: "Chose path A" },
  ];
  const summary = buildDefaultSessionSummary(run);
  assert.ok(summary);
  assert.equal(summary.type, "default");
  assert.ok(summary.summary.includes(run.moduleId));
  assert.ok(summary.sections.length > 0);
});

test("buildDefaultSessionSummary: includes clock state", () => {
  const module = normalizeAdventureModule({ title: "Clock Test" });
  const run = createTabletopRun({ module });
  run.publicState.clocks = [
    { id: "c1", label: "Danger", segments: 4, value: 4, filled: true },
    { id: "c2", label: "Progress", segments: 6, value: 2, filled: false },
  ];
  const summary = buildDefaultSessionSummary(run);
  const clockSections = summary.sections.filter((s) => s.heading.includes("时钟"));
  assert.ok(clockSections.length > 0);
});

// ── Book-defined ending ──

test("buildEndingSummary: uses book template when available", () => {
  const module = normalizeAdventureModule({
    title: "Epic Quest",
    endingPolicy: {
      conditions: [
        { id: "victory", label: "Victory", summaryTemplate: "{{title}} 完成于 {{turnCount}} 回合！" },
      ],
    },
  });
  const run = createTabletopRun({ module });
  run.turnIndex = 12;
  const summary = buildEndingSummary({ module, runState: run, endingId: "victory" });
  assert.ok(summary);
  assert.equal(summary.type, "book_defined");
  assert.ok(summary.summary.includes("12 回合"));
});

test("buildEndingSummary: falls back to default when no template", () => {
  const module = normalizeAdventureModule({ title: "Default End" });
  const run = createTabletopRun({ module });
  const summary = buildEndingSummary({ module, runState: run, endingId: "nonexistent" });
  assert.ok(summary);
  assert.equal(summary.type, "default");
});

// ── Validate ──

test("validateEndingSummary: valid summary passes", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const run = createTabletopRun({ module });
  const summary = buildDefaultSessionSummary(run);
  const result = validateEndingSummary(summary);
  assert.equal(result.valid, true);
});

test("validateEndingSummary: null fails", () => {
  const result = validateEndingSummary(null);
  assert.equal(result.valid, false);
});
