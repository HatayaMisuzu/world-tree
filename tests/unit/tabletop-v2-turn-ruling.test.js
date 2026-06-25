import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPlayerIntent,
  createRulingRequest,
  resolveRulingWithoutLlm,
  buildGmNarrationPacket,
  validateRuling,
} from "../../src/core/tabletop/tabletop-v2-turn-ruling.js";
import { normalizeAdventureModule } from "../../src/core/tabletop/tabletop-v2-adventure-module.js";
import { createTabletopRun } from "../../src/core/tabletop/tabletop-v2-save-branch.js";

// ── Intent classification ──

test("classifyPlayerIntent: combat intent", () => {
  const result = classifyPlayerIntent("我攻击地精");
  assert.equal(result.type, "combat");
});

test("classifyPlayerIntent: social intent", () => {
  const result = classifyPlayerIntent("我试图说服守卫放行");
  assert.equal(result.type, "social");
});

test("classifyPlayerIntent: investigate intent", () => {
  const result = classifyPlayerIntent("我检查房间里的书桌");
  assert.equal(result.type, "investigate");
});

test("classifyPlayerIntent: empty intent returns unknown", () => {
  const result = classifyPlayerIntent("");
  assert.equal(result.type, "unknown");
});

// ── Ruling request ──

test("createRulingRequest: valid intent produces request", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({
    module,
    runState,
    playerIntent: "我攻击怪物",
  });
  assert.equal(req.intent, "我攻击怪物");
  assert.equal(req.classification.type, "combat");
  assert.equal(req.rulesetKind, "d20");
});

test("createRulingRequest: empty intent returns error", () => {
  const req = createRulingRequest({ module: {}, runState: {}, playerIntent: "" });
  assert.ok(req.error);
});

// ── Deterministic ruling (no LLM) ──

test("resolveRulingWithoutLlm: produces ruling for combat", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({ module, runState, playerIntent: "我攻击地精" });
  const ruling = resolveRulingWithoutLlm(req);
  assert.ok(ruling);
  assert.ok(!ruling.error);
  assert.equal(ruling.classification, "combat");
  if (ruling.roll) {
    assert.equal(ruling.roll.source, "system_dice_engine");
    assert.equal(ruling.roll.llmGenerated, false);
  }
});

test("resolveRulingWithoutLlm: knowledge check = no roll", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({ module, runState, playerIntent: "我知道这个地方的历史吗" });
  const ruling = resolveRulingWithoutLlm(req);
  assert.ok(ruling.noRoll);
  assert.equal(ruling.roll, null);
});

test("resolveRulingWithoutLlm: hidden roll for stealth", () => {
  const module = normalizeAdventureModule({
    title: "Test",
    ruleset: { kind: "d20", rollVisibilityPolicy: { defaultVisibility: "public", hiddenActionTypes: ["stealth"] } },
  });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({ module, runState, playerIntent: "我潜行进入城堡" });
  const ruling = resolveRulingWithoutLlm(req);
  if (ruling.roll) {
    assert.equal(ruling.roll.visibility, "hidden");
  }
});

// ── Invalid request ──

test("resolveRulingWithoutLlm: error request returns error", () => {
  const ruling = resolveRulingWithoutLlm({ error: "bad" });
  assert.ok(ruling.error);
});

// ── GM narration packet ──

test("buildGmNarrationPacket: produces hints", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({ module, runState, playerIntent: "我攻击地精" });
  const ruling = resolveRulingWithoutLlm(req);
  const packet = buildGmNarrationPacket(ruling);
  assert.ok(packet.promptHints.length > 0);
  assert.ok(packet.promptHints.some((h) => h.includes("投骰结果") || h.includes("无需投骰")));
});

test("buildGmNarrationPacket: error ruling returns error packet", () => {
  const packet = buildGmNarrationPacket({ error: "bad" });
  assert.ok(packet.error);
});

// ── Validate ruling ──

test("validateRuling: valid ruling passes", () => {
  const module = normalizeAdventureModule({ title: "Test" });
  const runState = createTabletopRun({ module });
  const req = createRulingRequest({ module, runState, playerIntent: "我攻击地精" });
  const ruling = resolveRulingWithoutLlm(req);
  const result = validateRuling(ruling);
  assert.equal(result.valid, true);
});
