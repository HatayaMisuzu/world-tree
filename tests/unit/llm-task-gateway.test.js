import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLLMTaskPrompt,
  parseJsonLoose
} from "../../src/core/prompts/llm-task-gateway.js";

test("gateway builds role-specific prompt without leaking hidden fields", () => {
  const packet = buildLLMTaskPrompt({
    modeId: "murder-mystery",
    taskId: "guardian-audit",
    userInput: "检查输出",
    extraContext: {
      public: "ok",
      truthLedger: { culprit: "A" },
      hidden_truth: "secret"
    }
  });
  assert.equal(packet.contract.taskId, "guardian-audit");
  assert.match(packet.promptText, /LLM Task Contract/);
  assert.match(packet.promptText, /\[FILTERED\]/);
  assert.doesNotMatch(packet.promptText, /culprit/);
  assert.doesNotMatch(packet.promptText, /secret/);
});

test("gateway maps tabletop data to tabletop prompt profile", () => {
  const packet = buildLLMTaskPrompt({
    modeId: "tabletop",
    dataMode: "worldbook",
    taskId: "tabletop-narration-polish",
    userInput: "行动成功"
  });
  assert.equal(packet.promptModeId, "tabletop");
});

test("parseJsonLoose parses fenced json", () => {
  const r = parseJsonLoose("```json\n{\"ok\":true}\n```");
  assert.equal(r.ok, true);
  assert.equal(r.value.ok, true);
});
