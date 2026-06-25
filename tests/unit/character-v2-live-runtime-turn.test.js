import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCharacterV2LivePromptPacket,
  inspectCharacterV2LiveOutput,
  buildCharacterV2LiveTurnResult,
  validateCharacterV2LiveTurnResult
} from "../../src/core/character/character-v2-live-runtime-turn.js";

const runtimeMvp = {
  available: true,
  previewOnly: true,
  characterId: "char_misuzu",
  displayName: "美铃",
  normalSummary: { lines: ["Prompt Packet Preview：已生成"] },
  promptPacketSummary: { blockCount: 5 },
  firstTurnDraftTemplate: { template: ["以角色身份回应", "不要暴露元信息"] }
};

test("builds live prompt packet without write permissions", () => {
  const packet = buildCharacterV2LivePromptPacket(runtimeMvp, { characterId: "char_misuzu", userInput: "今天有点累" });
  assert.equal(packet.llmInjectionEnabled, true);
  assert.equal(packet.writerOnly, true);
  assert.equal(packet.mayWriteCanon, false);
  assert.equal(packet.mayWriteLongTermMemory, false);
  assert.ok(packet.packetText.includes("美铃"));
  assert.ok(packet.packetText.includes("今天有点累"));
});

test("detects meta leak in output", () => {
  const quality = inspectCharacterV2LiveOutput("作为AI，我不能透露 prompt 和 token。");
  assert.equal(quality.ok, false);
  assert.ok(quality.risks.some(r => r.type === "meta_or_ooc_leak"));
});

test("live turn result returns candidates but no writes", () => {
  const result = buildCharacterV2LiveTurnResult({
    runtimeMvp,
    request: { characterId: "char_misuzu", userInput: "以后记住我喜欢红茶" },
    rawReply: "嗯，我会记得你喜欢红茶的。"
  });
  assert.equal(result.writes.longTermMemory, false);
  assert.equal(result.candidates.autoWrite, false);
  assert.equal(result.candidates.memoryCandidates.length, 1);
  assert.equal(validateCharacterV2LiveTurnResult(result).ok, true);
});
