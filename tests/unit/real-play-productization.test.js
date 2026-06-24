import test from "node:test";
import assert from "node:assert/strict";
import { parseDiceNotation, rollDice, formatDicePromptContext } from "../../src/core/tabletop/dice.js";
import { addDiscoveredClue, buildVisibleClueContext, createClueBoard } from "../../src/core/mystery-puzzle/clue-board.js";
import { applyStrategyChoice, createResourcePanel } from "../../src/core/strategy-sim/resource-panel.js";
import { createFallbackChapterRecap, shouldCreateChapterRecap } from "../../src/core/narrative/chapter-recap.js";
import { createQuestTracker, getPlayerVisibleGoals, updateQuestProgress } from "../../src/core/narrative/quest-tracker.js";
import { inferRhythmTag, normalizeRhythmTag, rhythmInstruction } from "../../src/core/narrative/rhythm-tags.js";
import { buildRealPlayTurnContext } from "../../src/core/real-play/turn-context.js";

test("tabletop dice parses supported notation and rejects unsafe ranges", () => {
  assert.deepEqual(parseDiceNotation("/roll 1d20+3"), { ok: true, notation: "1d20+3", count: 1, sides: 20, modifier: 3 });
  assert.equal(parseDiceNotation("0d20").ok, false);
  assert.equal(parseDiceNotation("101d6").ok, false);
  assert.equal(parseDiceNotation("not dice").ok, false);
});

test("tabletop dice reports totals and d20 critical outcomes deterministically", () => {
  const success = rollDice("1d20+3", () => 0.999999);
  assert.equal(success.total, 23);
  assert.equal(success.isCriticalSuccess, true);
  assert.match(formatDicePromptContext(success), /不得被 Writer 或 Guardian 改写/);
  assert.equal(rollDice("1d20", () => 0).isCriticalFailure, true);
  assert.deepEqual(rollDice("2d6-1", () => 0.5).rolls, [4, 4]);
});

test("mystery clue board excludes hidden truth from player context", () => {
  let board = createClueBoard();
  const visible = addDiscoveredClue(board, { id: "mud", name: "泥脚印", location: "窗边" });
  board = visible.board;
  assert.equal(visible.ok, true);
  const hidden = addDiscoveredClue(board, { id: "killer", name: "凶手身份", revealsTruth: true, hiddenTruth: "管家" });
  assert.equal(hidden.ok, false);
  assert.doesNotMatch(JSON.stringify(buildVisibleClueContext(hidden.board)), /管家|hiddenTruth/);
});

test("strategy choices update bounded runtime resources without canon writes", () => {
  const result = applyStrategyChoice(createResourcePanel({ food: { value: 3 } }), "invest_military");
  assert.equal(result.ok, true);
  assert.equal(result.resources.food.value, 0);
  assert.equal(result.resources.military.value, 42);
  assert.deepEqual(result.runtimeUpdate.canonWrites, []);
});

test("chapter recap has bounded deterministic fallback", () => {
  assert.equal(shouldCreateChapterRecap({ turn: 25 }), true);
  const recap = createFallbackChapterRecap({ messages: Array.from({ length: 30 }, (_, i) => ({ content: `事件 ${i}` })) });
  assert.equal(recap.generatedBy, "deterministic-fallback");
  assert.ok(recap.keyEvents.length <= 5);
  assert.doesNotMatch(recap.summary, /事件 0/);
});

test("quest tracker hides unrevealed storylines and keeps progress runtime-only", () => {
  const tracker = createQuestTracker({ activeQuests: [{ id: "q1", name: "寻找钥匙" }], hiddenStorylines: [{ id: "h1", name: "幕后人", entries: ["秘密"], revealed: false }] });
  assert.deepEqual(getPlayerVisibleGoals(tracker).revealedStorylines, []);
  const updated = updateQuestProgress(tracker, "q1", 120);
  assert.equal(updated.tracker.activeQuests[0].progress, 100);
  assert.deepEqual(updated.runtimeUpdate.canonWrites, []);
});

test("rhythm tags preserve existing pacing as an auxiliary valid tag", () => {
  assert.equal(normalizeRhythmTag("invalid"), "breath");
  assert.equal(inferRhythmTag({ tension: 9 }), "climax");
  assert.match(rhythmInstruction("reveal").instruction, /hidden truth/);
});

test("real-play turn context wires mode slices into safe prompt and runtime state", () => {
  const tabletop = buildRealPlayTurnContext({ modeId: "tabletop", input: "/roll 1d20+3", rng: () => 0.5 });
  assert.equal(tabletop.publicState.tabletop.lastDiceResult.total, 14);
  assert.match(tabletop.promptBlock, /桌面判定/);
  assert.deepEqual(tabletop.commandResult.canonWrites, []);

  const mystery = buildRealPlayTurnContext({ modeId: "mystery-puzzle", input: "/clue 窗边泥脚印" });
  assert.equal(mystery.publicState.mystery.discoveredClues[0].name, "窗边泥脚印");
  assert.doesNotMatch(mystery.promptBlock, /hiddenTruth\s*:/);

  const strategy = buildRealPlayTurnContext({ modeId: "strategy-sim", input: "/invest_military" });
  assert.equal(strategy.publicState.strategy.resources.military.value, 42);
  assert.deepEqual(strategy.commandResult.canonWrites, []);
});
