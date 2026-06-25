import test from "node:test";
import assert from "node:assert/strict";

import { buildCharacterV2RuntimeCandidates } from "../../src/core/character/character-v2-runtime-candidates.js";
import { persistCharacterV2PendingCandidates } from "../../src/core/character/character-v2-candidate-persistence.js";
import { createCharacterV2LongTermState } from "../../src/core/character/character-v2-long-term-state.js";
import { acceptMemoryCandidate } from "../../src/core/character/character-v2-memory-writeback.js";
import { acceptRelationshipWriteback } from "../../src/core/character/character-v2-relationship-writeback.js";

test("Character V2 live candidate envelope persists to pending queues", () => {
  const state = createCharacterV2LongTermState({ characterId: "alice" });
  const envelope = buildCharacterV2RuntimeCandidates({
    runtimeContext: { characterId: "alice", relationship: { baseline: "familiar_companion" } },
    userInput: "请记住我喜欢安静的咖啡馆，我们是朋友。",
    assistantDraft: "我会记住，也会尊重你的节奏。"
  });

  const result = persistCharacterV2PendingCandidates({ state, candidateEnvelope: envelope, characterId: "alice", sourceTurnId: "turn_1" });
  assert.ok(result.persisted >= 1);
  assert.ok(result.state.memory.pending.length >= 1);
  assert.ok(result.state.relationship.pending.length >= 1);
  assert.equal(result.state.memory.pending[0].autoWrite, false);
  assert.equal(result.state.memory.pending[0].requiresUserConfirmation, true);
});

test("Character V2 accepted memory moves pending to confirmed with timestamp", () => {
  let state = createCharacterV2LongTermState({ characterId: "alice" });
  const candidate = { candidateId: "cand_mem_1", kind: "memory", excerpt: "用户喜欢安静咖啡馆", confidence: 0.8 };
  state.memory.pending.push(candidate);

  const result = acceptMemoryCandidate({ state, candidate, userPatch: { content: "用户喜欢安静的咖啡馆。", type: "preference" } });
  assert.equal(result.status, "ok");
  assert.equal(result.state.memory.pending.length, 0);
  assert.equal(result.state.memory.confirmed.length, 1);
  assert.ok(result.state.memory.confirmed[0].acceptedAt, "acceptedAt should be preserved");
  assert.equal(result.state.memory.confirmed[0].content, "用户喜欢安静的咖啡馆。");
});

test("Character V2 relationship major change requires double confirmation", () => {
  const state = createCharacterV2LongTermState({ characterId: "alice" });
  const proposal = {
    candidateId: "cand_rel_1",
    kind: "relationship",
    changeType: "romance",
    requiresDoubleConfirm: true,
    fromState: { baseline: "familiar_companion" },
    toState: { baseline: "romance" }
  };

  const first = acceptRelationshipWriteback({ state, proposal, userDecision: "accepted", doubleConfirmed: false });
  assert.equal(first.status, "pending_double_confirm");

  const second = acceptRelationshipWriteback({ state, proposal, userDecision: "accepted", doubleConfirmed: true });
  assert.equal(second.status, "ok");
});
