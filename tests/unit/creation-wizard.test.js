// tests/unit/creation-wizard.test.js — M1 Creation Wizard v2 tests
import test from "node:test";
import assert from "node:assert/strict";
import { createWizardSession, advanceStage } from "../../src/core/creation-wizard/wizard-session.js";
import { detectGaps, generateNextQuestion } from "../../src/core/creation-wizard/wizard-gap-detector.js";
import { buildBlueprintCandidate, validateBlueprint } from "../../src/core/creation-wizard/wizard-blueprint-builder.js";
import { reviewBlueprint, isReadyForDelivery } from "../../src/core/creation-wizard/wizard-risk-review.js";
import { prepareWizardDelivery } from "../../src/core/creation-wizard/wizard-delivery.js";

test("vague input does not directly create a project", () => {
  const session = createWizardSession({ modeHint: "world-rpg", userInput: "想玩一个奇幻世界" });
  assert.equal(session.status, "draft");
  const gaps = detectGaps(session);
  assert.ok(gaps.length >= 2, "should have hard field gaps");
});

test("hard fields missing returns next question", () => {
  const session = createWizardSession({ modeHint: "world-rpg" });
  const q = generateNextQuestion(session);
  assert.ok(q.question.length > 0);
  assert.equal(q.level, "hard");
});

test("complete hard fields enables next stage", () => {
  const session = createWizardSession({ modeHint: "world-rpg" });
  session.fields.hard = { worldName: "艾尔德兰", genre: "奇幻", tone: "严肃", playerRole: "冒险者" };
  const gaps = detectGaps(session);
  assert.equal(gaps.length, 0);
});

test("full input generates blueprint candidate", () => {
  const session = createWizardSession({ modeHint: "world-rpg" });
  session.fields.hard = { worldName: "艾尔德兰", genre: "奇幻", tone: "严肃", playerRole: "冒险者", protagonistName: "艾伦", protagonistRole: "佣兵", openingScene: "酒馆外的雨夜" };
  session.fields.soft = { worldHook: "魔法正在消退", coreRule: "魔法有代价" };
  const bp = buildBlueprintCandidate(session);
  assert.equal(bp.worldName, "艾尔德兰");
  assert.equal(bp.genre, "奇幻");
  assert.ok(bp.version === 2);
});

test("blueprint validation catches missing opening", () => {
  const bp = { worldName: "test", genre: "test", opening: { scene: "" }, protagonist: { name: "" }, world: {}, rules: {}, events: {}, optional: {}, risks: [] };
  const v = validateBlueprint(bp);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some(e => e.includes("openingScene")));
});

test("risk review catches high-risk empty world name", () => {
  const bp = { worldName: "未命名世界", genre: "奇幻", opening: { scene: "test" }, protagonist: { name: "x" }, world: {}, rules: {}, events: {}, optional: {}, risks: [] };
  const review = reviewBlueprint(bp);
  assert.equal(review.passed, false);
});

test("blueprint delivery does not write shared canon", () => {
  const session = createWizardSession({ modeHint: "world-rpg" });
  session.fields.hard = { worldName: "X", genre: "Y", tone: "Z", playerRole: "test", protagonistName: "A", protagonistRole: "B", openingScene: "C" };
  const result = prepareWizardDelivery(session);
  assert.equal(result.ok, true);
  assert.equal(result.deliveryMethod, "candidate");
  assert.ok(result.note.includes("CANDIDATE"));
});

test("hidden truth never enters user-visible fields", () => {
  const session = createWizardSession({ modeHint: "murder-mystery" });
  session.fields.hard = { worldName: "Test", genre: "悬疑", tone: "dark", playerRole: "侦探", protagonistName: "A", protagonistRole: "B", openingScene: "C" };
  const bp = buildBlueprintCandidate(session);
  const str = JSON.stringify(bp);
  assert.ok(!str.includes("hiddenTruth"));
  assert.ok(!str.includes("answerLock"));
});
