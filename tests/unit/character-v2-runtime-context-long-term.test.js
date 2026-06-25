import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCharacterV2RuntimeContext,
  validateCharacterV2RuntimeContext,
  summarizeCharacterV2RuntimeContext
} from "../../src/core/character/character-v2-runtime-context.js";

test("runtime context consumes confirmed long-term state read-only", () => {
  const context = buildCharacterV2RuntimeContext({
    manifest: { characterId: "char_misuzu", displayName: "美铃", textFirst: true },
    profile: { characterId: "char_misuzu", identity: { oneLineSummary: "普通日本学生" } },
    relationship: { baseline: "familiar_companion", label: "熟悉但不过界" },
    memorySeed: { memories: [], note: "seed empty" },
    longTermState: {
      schemaVersion: "world-tree.character.v2.long-term.1",
      characterId: "char_misuzu",
      memory: {
        pending: [],
        confirmed: [
          { memoryId: "mem_1", type: "preference", content: "用户喜欢安静的咖啡馆。", confidence: 0.9, tags: ["preference"], acceptedAt: "2026-01-01T00:00:00.000Z" }
        ],
        rejected: []
      },
      relationship: {
        pending: [],
        confirmed: { baseline: "trusted_friend", label: "值得信任的朋友", stage: "trusted", trustScore: 7, familiarityScore: 6, boundaryFlags: ["no_romance"], lastChangedAt: "2026-01-02T00:00:00.000Z" },
        rejected: []
      },
      canon: {
        proposals: [],
        confirmed: [
          { canonId: "canon_1", category: "identity", content: "美铃会避免自称 AI。", acceptedAt: "2026-01-03T00:00:00.000Z" }
        ]
      },
      quality: { issues: [{ issueId: "q_1", type: "ooc_risk" }] },
      auditLog: [{ eventId: "audit_secret", type: "internal", secret: "do-not-show" }]
    },
    uiSummary: { title: "美铃", subtitle: "角色摘要", lines: ["默认关系：熟悉但不过界"] }
  });

  assert.equal(context.available, true);
  assert.equal(context.readOnly, true);
  assert.equal(context.mayWriteLongTermMemory, false);
  assert.equal(context.mayWriteRelationship, false);
  assert.equal(context.mayWriteCanon, false);

  assert.equal(context.longTerm.available, true);
  assert.equal(context.longTerm.memoryConfirmedCount, 1);
  assert.equal(context.longTerm.canonConfirmedCount, 1);
  assert.equal(context.longTerm.qualityIssueCount, 1);
  assert.equal(context.memory.confirmedCount, 1);
  assert.equal(context.memory.count, 1);
  assert.equal(context.relationship.baseline, "trusted_friend");
  assert.equal(context.relationship.label, "值得信任的朋友");

  assert.ok(context.normalSummary.lines.some((line) => line.includes("长期状态")));
  assert.ok(JSON.stringify(context.longTerm.confirmedMemorySummary).includes("安静的咖啡馆"));
  assert.ok(!JSON.stringify(context.normalSummary).includes("audit_secret"));
  assert.ok(!JSON.stringify(context).includes("do-not-show"));

  const validation = validateCharacterV2RuntimeContext(context);
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("summary includes safe long-term counts without raw audit", () => {
  const context = buildCharacterV2RuntimeContext({
    manifest: { characterId: "char_a", displayName: "A" },
    longTermState: {
      memory: { confirmed: [{ memoryId: "m", content: "safe memory" }] },
      relationship: { confirmed: { baseline: "trusted_friend", label: "朋友" } },
      canon: { confirmed: [{ canonId: "c", content: "safe canon" }] },
      auditLog: [{ eventId: "audit_raw" }]
    }
  });

  const summary = summarizeCharacterV2RuntimeContext(context);
  assert.equal(summary.longTerm.available, true);
  assert.equal(summary.longTerm.memoryConfirmedCount, 1);
  assert.equal(summary.longTerm.canonConfirmedCount, 1);
  assert.equal(summary.longTerm.relationshipLabel, "朋友");
  assert.ok(!JSON.stringify(summary).includes("audit_raw"));
});
