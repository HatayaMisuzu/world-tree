import test from "node:test";
import assert from "node:assert/strict";

import { createGrandWorldModeContext, createGrandWorldTurnPacket, createGrandWorldPrompt, runGrandWorldTurn, createGrandWorldModeSummary } from "../../src/core/grand-world/grand-world-mode-adapter.js";
import { planGrandWorldTurn, classifyGrandWorldIntent } from "../../src/core/grand-world/grand-world-turn-planner.js";
import { createGrandWorldChangeProposals, createSceneTransitionProposal, createTimelineAppendProposal } from "../../src/core/grand-world/grand-world-state.js";
import { createWorldThread, selectActiveWorldThreads } from "../../src/core/grand-world/grand-world-objectives.js";
import { createWorldbook, createWorldbookEntry, createDefaultScene, createDefaultWorldState } from "../../src/core/worldbook/worldbook-schema.js";

// Mode Adapter
test("createGrandWorldModeContext uses modeMeaning grand_world", () => {
  const ctx = createGrandWorldModeContext({ worldbook: createWorldbook({ title: "测试" }) }, { text: "探索" });
  assert.equal(ctx.modeMeaning, "grand_world");
  assert.equal(ctx.worldbook.title, "测试");
});

test("createGrandWorldTurnPacket contains modeMeaning", () => {
  const p = createGrandWorldTurnPacket({}, { text: "test" });
  assert.equal(p.modeMeaning, "grand_world");
  assert.equal(p.schemaVersion, 1);
});

test("createGrandWorldPrompt does not mention RPG mechanics", () => {
  const prompt = createGrandWorldPrompt({ worldbook: createWorldbook({ title: "T" }) }, { text: "hello" });
  assert.ok(prompt.promptText.includes("大世界"));
  assert.doesNotMatch(prompt.promptText, /等级|职业|装备|经验值/);
});

test("runGrandWorldTurn returns ready status", () => {
  const r = runGrandWorldTurn({ worldbook: createWorldbook() }, { text: "探索" });
  assert.equal(r.status, "ready");
  assert.ok(r.cacheKey);
});

test("createGrandWorldModeSummary reports entry count", () => {
  const wb = createWorldbook({ title: "T" });
  wb.entries.push(createWorldbookEntry({ title: "e" }));
  const s = createGrandWorldModeSummary({ worldbook: wb, scenes: createDefaultScene() });
  assert.equal(s.entryCount, 1);
  assert.equal(s.modeMeaning, "grand_world");
});

// Turn Planner
test("classifyGrandWorldIntent detects explore", () => {
  const r = classifyGrandWorldIntent({ text: "探索前方" });
  assert.equal(r.kind, "explore");
});

test("classifyGrandWorldIntent detects talk", () => {
  assert.equal(classifyGrandWorldIntent({ text: "和他对话" }).kind, "talk");
});

test("classifyGrandWorldIntent returns unknown for empty", () => {
  assert.equal(classifyGrandWorldIntent({ text: "" }).kind, "unknown");
});

test("planGrandWorldTurn returns intent and hooks", () => {
  const r = planGrandWorldTurn({ text: "探索周围" }, { currentScene: { title: "广场" } });
  assert.equal(r.intent.kind, "explore");
  assert.ok(r.hooks.length > 0);
  assert.ok(r.actions.length > 0);
});

// State
test("createSceneTransitionProposal defaults to pending", () => {
  const p = createSceneTransitionProposal();
  assert.equal(p.status, "pending");
  assert.equal(p.type, "scene_transition");
});

test("createTimelineAppendProposal status is pending", () => {
  assert.equal(createTimelineAppendProposal().status, "pending");
});

test("createGrandWorldChangeProposals returns array", () => {
  const proposals = createGrandWorldChangeProposals();
  assert.ok(Array.isArray(proposals));
  assert.equal(proposals[0].status, "pending");
});

// Objectives
test("createWorldThread defaults to active lead", () => {
  const t = createWorldThread({ title: "调查失踪" });
  assert.equal(t.type, "lead");
  assert.equal(t.status, "active");
});

test("selectActiveWorldThreads filters by status", () => {
  const threads = [
    createWorldThread({ title: "A", status: "active" }),
    createWorldThread({ title: "B", status: "completed" })
  ];
  assert.equal(selectActiveWorldThreads(threads).length, 1);
});
