import test from "node:test";
import assert from "node:assert/strict";

import {
  publicDetectivePayload,
  buildDetectiveInterrogationPrompt,
  assertDetectiveLlmPayloadSafe
} from "../../src/core/detective/detective-v2-llm-narration.js";

test("detective public payload strips hidden keys", () => {
  const payload = publicDetectivePayload({
    character: { name: "A", isCulprit: true, hiddenNotes: "secret" },
    truthLedger: { answer: "A" }
  });
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /isCulprit/);
  assert.doesNotMatch(text, /hiddenNotes/);
  assert.doesNotMatch(text, /truthLedger/);
});

test("detective interrogation prompt includes safety rules", () => {
  const packet = buildDetectiveInterrogationPrompt({
    character: { name: "嫌疑人" },
    publicTestimonies: [{ summary: "我当时在大厅。" }],
    question: "你在哪里？"
  });
  assert.match(packet.promptText, /不得透露凶手身份/);
  assert.match(packet.promptText, /不得新增证词/);
});

test("detective safe assertion catches forbidden keys", () => {
  const result = assertDetectiveLlmPayloadSafe({ truthLedger: { x: 1 } });
  assert.equal(result.ok, false);
});
