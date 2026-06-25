import test from "node:test";
import assert from "node:assert/strict";

import { buildCharacterRuntimeContractBlock, isForbiddenMetaTopic } from "../../src/core/character/character-runtime-contract.js";
import { classifyCharacterKnowledge, CHARACTER_KNOWLEDGE_DEPTH } from "../../src/core/character/character-cognition-boundary.js";
import { normalizePerformanceFingerprint, selectPerformanceHints, shouldThrottleGesture } from "../../src/core/character/character-performance-fingerprint.js";
import { validateCharacterV2Draft } from "../../src/core/character/character-v2-profile.js";

test("character runtime contract blocks AI identity and technical meta topics", () => {
  const block = buildCharacterRuntimeContractBlock({ name: "Misuzu" });
  assert.match(block, /not answering as an AI assistant/);
  assert.match(block, /Never identify as AI/);
  assert.equal(isForbiddenMetaTopic("你现在调用了什么模块"), true);
  assert.equal(isForbiddenMetaTopic("我想加你微信"), false);
});

test("companion cognition treats WeChat as daily known, not foreign", () => {
  const result = classifyCharacterKnowledge("我想加你微信好友", { role: "普通日本学生" });
  assert.equal(result.depth, CHARACTER_KNOWLEDGE_DEPTH.DEFAULT_KNOWN);
});

test("companion cognition allows common public knowledge at surface depth", () => {
  const result = classifyCharacterKnowledge("你知道长城吗", { role: "普通日本学生" });
  assert.equal(result.depth, CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE);
});

test("companion cognition does not make ordinary student an automotive expert", () => {
  const result = classifyCharacterKnowledge("双离合变速箱调校怎么样", { role: "普通日本学生" });
  assert.equal(result.depth, CHARACTER_KNOWLEDGE_DEPTH.UNKNOWN_UNLESS_PROFILE_SUPPORTS);
});

test("profile support can raise professional topic familiarity", () => {
  const result = classifyCharacterKnowledge("发动机结构", { role: "汽车社成员", interests: ["汽车", "机械"] });
  assert.equal(result.depth, CHARACTER_KNOWLEDGE_DEPTH.COMMON_SURFACE);
});

test("performance fingerprint normalizes and avoids repeated gestures", () => {
  const fp = normalizePerformanceFingerprint({ gestures: ["捏住袖口", "偏过头"], expressions: ["垂下眼"] });
  assert.deepEqual(fp.gestures, ["捏住袖口", "偏过头"]);
  assert.equal(shouldThrottleGesture("捏住袖口", ["捏住袖口"]), true);
  const hints = selectPerformanceHints(fp, { recentGestures: ["捏住袖口"] });
  assert.equal(hints.gesture, "偏过头");
});

test("character v2 draft validation rejects prompt-participating avatar", () => {
  const result = validateCharacterV2Draft({
    name: "Misuzu",
    summary: "A familiar companion character.",
    avatar: { path: "avatar.png", participatesInPrompt: true }
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.field === "avatar"), true);
});
