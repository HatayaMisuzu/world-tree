import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_RELATIONSHIP_BASELINE, createCharacterCapsuleDraft, validateCharacterCapsuleDraft, buildCharacterCapsuleSummary } from "../../src/core/character/character-v2-capsule-creation.js";

test("plain text input creates pending capsule draft", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃", text: "普通日本学生，语气温和，有一点嘴硬。" }, { seed: "t1", now: "2026-06-25T00:00:00.000Z" });
  assert.equal(result.ok, true);
  assert.equal(result.draft.status, "draft");
  assert.equal(result.draft.requiresUserConfirmation, true);
  assert.equal(result.draft.displayName, "美铃");
});

test("empty input is rejected with user-friendly validation", () => {
  const result = createCharacterCapsuleDraft({}, { seed: "t2" });
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some(w => w.includes("缺少角色文本") || w.includes("角色名")));
});

test("default relationship is familiar companion and not romance", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "t3" });
  assert.equal(result.draft.relationship.baseline, DEFAULT_RELATIONSHIP_BASELINE);
  assert.ok(result.draft.relationship.forbids.includes("默认恋爱"));
  assert.ok(result.draft.relationship.forbids.includes("默认暧昧"));
});

test("manual avatar is UI-only and not cognition/prompt source", () => {
  const result = createCharacterCapsuleDraft({
    name: "美铃",
    text: "角色设定",
    avatar: { label: "头像", dataUri: "data:image/png;base64,AAAA" }
  }, { seed: "t4" });
  assert.equal(result.draft.avatar.uiOnly, true);
  assert.equal(result.draft.avatar.participatesInPrompt, false);
  assert.equal(result.draft.avatar.participatesInCognition, false);
  assert.equal(result.draft.avatar.metadataParsed, false);
});

test("performance fingerprint seed exists", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃", text: "她紧张时会捏袖口。" }, { seed: "t5" });
  assert.ok(result.draft.performanceFingerprint.voice);
  assert.ok(result.draft.performanceFingerprint.nonverbal);
  assert.ok(result.draft.performanceFingerprint.appearance);
  assert.ok(result.draft.performanceFingerprint.overuseGuard.length >= 2);
});

test("runtime contract blocks model/meta leakage", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "t6" });
  assert.ok(result.draft.runtimeContract.blocks.includes("ai_identity_leak"));
  assert.ok(result.draft.runtimeContract.blocks.includes("module_disclosure"));
});

test("cognition boundary allows daily concepts but blocks technical meta", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "t7" });
  assert.ok(result.draft.cognitionBoundary.commonKnowledgeExamples.includes("微信"));
  assert.ok(result.draft.cognitionBoundary.commonKnowledgeExamples.includes("长城"));
  assert.ok(result.draft.cognitionBoundary.blockedMetaExamples.includes("LLM prompt"));
});

test("advanced UI is hidden by default", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "t8" });
  assert.deepEqual(result.draft.advancedUi, {
    advancedSettingsVisible: false,
    debugVisible: false,
    promptPreviewVisible: false,
    moduleTraceVisible: false,
    qualityScoreVisible: false
  });
});

test("validate draft catches unsafe persistence flags", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃" }, { seed: "t9" });
  const validation = validateCharacterCapsuleDraft({
    ...result.draft,
    persistencePolicy: { ...result.draft.persistencePolicy, mayWriteCanon: true }
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(e => e.includes("canon")));
});

test("summary is safe for normal UI", () => {
  const result = createCharacterCapsuleDraft({ name: "美铃", text: "角色设定" }, { seed: "t10" });
  const summary = buildCharacterCapsuleSummary(result.draft);
  assert.equal(summary.safeForNormalUi, true);
  assert.ok(summary.omittedTechnicalDetails.includes("prompt"));
  assert.ok(summary.lines.some(line => line.includes("熟悉但不过界")));
});
