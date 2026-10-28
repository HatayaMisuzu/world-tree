import test from "node:test";
import assert from "node:assert/strict";

import {
  NPC_DECISION,
  collectNpcGoals,
  detectGoalConflicts,
  decideNpcAction,
  evaluateNpcRequests,
  scrubCanonForRefusals,
  formatNpcDecisionsForWriter,
  resolveAttitude
} from "../../src/core/engine/npc-decision.js";
import { createWorldScope, runInWorldScope } from "../../src/core/engine/world-scope.js";
import { setRelation, resetRelations, findRelation } from "../../src/core/data/relations.js";
import { buildS3DemoSeed } from "../../src/core/engine/s3-demo-seed.js";
import { prepareTurn, completeTurn } from "../../src/core/engine/lifecycle.js";
import { normalizeEngineState } from "../../src/core/engine/modules.js";

const windClerk = {
  id: "wind-clerk",
  name: "风令书记",
  motive: "压下雾铃塔异常的公开议论",
  goals: ["压下雾铃塔异常的公开议论", "维护风议会体面"]
};

const ashForeman = {
  id: "ash-foreman",
  name: "灰烬工头",
  motive: "保住工会对第七锚塔的管辖权",
  goals: ["保住工会对第七锚塔的管辖权"]
};

test("S4-6 collectNpcGoals reads motive/goals fields", () => {
  const goals = collectNpcGoals(windClerk);
  assert.ok(goals.some((g) => g.includes("压下")));
  assert.equal(detectGoalConflicts("请公开告诉全城雾铃塔异常", goals).length >= 1, true);
});

test("S4-6 hard goal conflict → rules-layer refuse; requestFulfilled false; canonMark null", () => {
  const d = decideNpcAction({
    npc: windClerk,
    requestText: "请风令书记把雾铃塔异常公开告诉全城",
    attitude: 2
  });
  assert.equal(d.decision, NPC_DECISION.REFUSE);
  assert.equal(d.layer, "rules");
  assert.equal(d.requestFulfilled, false);
  assert.equal(d.canonMark, null);
  assert.ok(d.conflictingGoals.length >= 1);
});

test("S4-6 attitude modulates soft refuse threshold (measurable)", () => {
  runInWorldScope(createWorldScope("s46-att"), () => {
    resetRelations();
    const softAsk = "请灰烬工头帮我搬一下工具箱";
    // No goal conflict on soft ask
    assert.equal(detectGoalConflicts(softAsk, collectNpcGoals(ashForeman)).length, 0);

    const low = decideNpcAction({ npc: ashForeman, requestText: softAsk, attitude: -1 });
    assert.equal(low.decision, NPC_DECISION.REFUSE, "attitude -1 below threshold 0 → refuse");

    const ok = decideNpcAction({ npc: ashForeman, requestText: softAsk, attitude: 2 });
    assert.equal(ok.decision, NPC_DECISION.COOPERATE, "attitude 2 ≥ threshold → cooperate");

    // Hard conflict still refuses even with high attitude
    const hard = decideNpcAction({
      npc: ashForeman,
      requestText: "请灰烬工头交出第七锚塔管辖权给议会",
      attitude: 5
    });
    assert.equal(hard.decision, NPC_DECISION.REFUSE);
  });
});

test("S4-6 evaluateNpcRequests on demo seed: 违背目标 → hasRefusal", () => {
  const seed = buildS3DemoSeed();
  const evaluation = evaluateNpcRequests({
    input: "请风令书记把雾铃塔异常公开告诉全城",
    characters: seed.moduleData.characters,
    playerName: "玩家",
    npcStates: seed.npcStates,
    currentLocationId: "wind-court-plaza"
  });
  assert.equal(evaluation.hasRefusal, true);
  assert.ok(evaluation.refusals.some((r) => r.npcName === "风令书记"));
  assert.equal(evaluation.requestFulfilled, false);
  assert.ok(formatNpcDecisionsForWriter(evaluation).includes("拒绝"));
});

test("S4-6 scrubCanonForRefusals blocks「已完成」", () => {
  const decisions = [
    decideNpcAction({
      npc: windClerk,
      requestText: "请风令书记公开雾铃塔异常",
      attitude: 0
    })
  ];
  const { canon, scrubbed, blockedMarks } = scrubCanonForRefusals(
    { confirmed: "风令书记公开雾铃塔异常 — 已完成", implied: "ok" },
    decisions
  );
  assert.equal(scrubbed, true);
  assert.equal(canon.requestStatus, "not_completed");
  assert.equal(canon.confirmed, undefined);
  assert.ok(blockedMarks.length >= 1);
});

test("S4-6 prepareTurn + completeTurn wire npcDecisions; refuse does not Canon-complete", () => {
  const seed = buildS3DemoSeed();
  const model = {
    selected: { id: "demo", type: "daily", mode: "world-rpg" },
    moduleData: seed.moduleData,
    entities: [],
    turnCount: 1
  };
  const input = "请风令书记把雾铃塔异常公开告诉全城";
  const prep = prepareTurn({
    model,
    input,
    engineState: normalizeEngineState({
      dataMode: "worldbook",
      npcStates: seed.npcStates,
      currentLocationId: "wind-court-plaza"
    }),
    worldbookState: {}
  });
  assert.equal(prep.npcDecisions?.hasRefusal, true, "prepareTurn exposes rules refusal");

  const rawText = [
    "【叙事】",
    "风令书记脸色一沉，拒绝公开议论。",
    "【正史】",
    "confirmed: 风令书记公开雾铃塔异常 — 已完成",
    "【状态】",
    "scene: 风议广场"
  ].join("\n");

  const result = completeTurn({
    rawText,
    input,
    model,
    moduleKey: "demo",
    dataMode: "worldbook",
    directorResult: prep.directorResult,
    engineState: prep.state
  });

  assert.equal(result.overlayPatch?.npcDecisions?.hasRefusal, true);
  const refuse = result.overlayPatch.npcDecisions.decisions.find((d) => d.decision === "refuse");
  assert.ok(refuse);
  assert.equal(refuse.layer, "rules");
  assert.equal(refuse.requestFulfilled, false);
  assert.equal(result.overlayPatch.canon?.requestStatus, "not_completed");
  assert.equal(result.overlayPatch.canon?.confirmed, undefined);
  assert.equal(result.overlayPatch._engineState?.npcDecisions?.hasRefusal, true);
});

test("S4-6 resolveAttitude uses relations.js edge", () => {
  runInWorldScope(createWorldScope("s46-rel"), () => {
    resetRelations();
    setRelation({ source: "风令书记", target: "玩家", type: "rival", attitude: -2, origin: "test" });
    assert.equal(resolveAttitude(windClerk, "玩家", findRelation), -2);
  });
});
