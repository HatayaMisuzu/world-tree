import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScriptKillSpeechPrompt
} from "../../src/core/single-player-scriptkill/single-player-scriptkill-llm-dialogue.js";

test("scriptkill public speech prompt forbids hidden truth and unopened clues", () => {
  const packet = buildScriptKillSpeechPrompt({
    role: { roleId: "r1", roleName: "角色A", secrets: ["不能泄露"] },
    simulatedPlayer: { assignedRoleId: "r1", visibleName: "A" },
    boundary: { allowedFacts: ["公开线索1"], forbiddenFacts: ["最终真相"] },
    channel: "public",
    userText: "你怎么看？"
  });
  assert.match(packet.promptText, /不得透露未公开线索/);
  assert.match(packet.promptText, /不得透露.*最终真相/);
  assert.doesNotMatch(packet.promptText, /不能泄露/);
});
