import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultRulesetProfile,
  normalizeRulesetProfile,
  validateRulesetProfile,
  listRulesetKinds,
} from "../../src/core/tabletop/tabletop-v2-ruleset-profile.js";

// ── Default profiles ──

test("createDefaultRulesetProfile: d20_fantasy", () => {
  const p = createDefaultRulesetProfile("d20_fantasy");
  assert.equal(p.rulesetId, "d20_fantasy");
  assert.equal(p.kind, "d20");
  assert.equal(p.dicePolicy.defaultExpression, "1d20");
  assert.equal(p.rollVisibilityPolicy.defaultVisibility, "public");
});

test("createDefaultRulesetProfile: d100_investigation", () => {
  const p = createDefaultRulesetProfile("d100_investigation");
  assert.equal(p.kind, "d100");
  assert.equal(p.rollVisibilityPolicy.defaultVisibility, "hidden");
});

test("createDefaultRulesetProfile: 2d6_narrative", () => {
  const p = createDefaultRulesetProfile("2d6_narrative");
  assert.equal(p.kind, "2d6");
  assert.equal(p.outcomeBands.length, 3);
});

test("createDefaultRulesetProfile: dice_pool_pressure", () => {
  const p = createDefaultRulesetProfile("dice_pool_pressure");
  assert.equal(p.kind, "dice_pool");
  assert.equal(p.dicePolicy.defaultPool, 4);
});

test("createDefaultRulesetProfile: low_dice_story", () => {
  const p = createDefaultRulesetProfile("low_dice_story");
  assert.equal(p.kind, "low_dice");
  assert.equal(p.rollVisibilityPolicy.allowHidden, false);
});

test("createDefaultRulesetProfile: unknown kind throws", () => {
  assert.throws(() => createDefaultRulesetProfile("nonexistent"));
});

test("all 5 default profiles exist", () => {
  const kinds = listRulesetKinds();
  assert.equal(kinds.length, 5);
  const ids = kinds.map((k) => k.kind);
  assert.ok(ids.includes("d20_fantasy"));
  assert.ok(ids.includes("d100_investigation"));
  assert.ok(ids.includes("2d6_narrative"));
  assert.ok(ids.includes("dice_pool_pressure"));
  assert.ok(ids.includes("low_dice_story"));
});

// ── Normalizer ──

test("normalizeRulesetProfile: fills defaults for partial input", () => {
  const p = normalizeRulesetProfile({ kind: "d20_fantasy", rulesetId: "my_d20" });
  assert.equal(p.rulesetId, "my_d20");
  assert.equal(p.kind, "d20_fantasy");
  assert.ok(p.dicePolicy);
  assert.ok(p.outcomeBands.length > 0);
});

test("normalizeRulesetProfile: preserves custom fields", () => {
  const p = normalizeRulesetProfile({ kind: "d20_fantasy", custom: { houseRule: "no crit fails" } });
  assert.deepEqual(p.custom, { houseRule: "no crit fails" });
});

test("normalizeRulesetProfile: override probability policy", () => {
  const p = normalizeRulesetProfile({
    kind: "d20_fantasy",
    probabilityPolicy: { showEstimate: false },
  });
  assert.equal(p.probabilityPolicy.showEstimate, false);
});

test("normalizeRulesetProfile: null input returns null", () => {
  assert.equal(normalizeRulesetProfile(null), null);
});

// ── Validator ──

test("validateRulesetProfile: valid profile passes", () => {
  const p = createDefaultRulesetProfile("d20_fantasy");
  const result = validateRulesetProfile(p);
  assert.equal(result.valid, true);
});

test("validateRulesetProfile: missing rulesetId fails", () => {
  const result = validateRulesetProfile({ kind: "d20", outcomeBands: [{ outcome: "success" }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("rulesetId")));
});

test("validateRulesetProfile: empty outcomeBands fails", () => {
  const p = createDefaultRulesetProfile("d20_fantasy");
  p.outcomeBands = [];
  const result = validateRulesetProfile(p);
  assert.equal(result.valid, false);
});
