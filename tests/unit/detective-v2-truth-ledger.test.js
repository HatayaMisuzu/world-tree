import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTruthLedger, validateTruthLedger, extractTruthLedgerForReview, assertTruthLedgerNotInPlayerView } from "../../src/core/detective/detective-truth-ledger.js";

test("normalizeTruthLedger: fills defaults", () => {
  const t = normalizeTruthLedger({ culpritIds: ["a"], motive: "greed", method: "poison" });
  assert.deepEqual(t.culpritIds, ["a"]);
  assert.equal(t.motive, "greed");
  assert.ok(Array.isArray(t.solutionChain));
});

test("validateTruthLedger: valid passes", () => {
  assert.equal(validateTruthLedger(normalizeTruthLedger({ culpritIds: ["x"], motive: "m", method: "m2" })).valid, true);
});

test("validateTruthLedger: missing method fails", () => {
  assert.equal(validateTruthLedger(normalizeTruthLedger({ culpritIds: ["x"], motive: "m" })).valid, false);
});

test("assertTruthLedgerNotInPlayerView: clean view passes", () => {
  const view = { title: "Case", evidence: [{ label: "knife" }] };
  assert.equal(assertTruthLedgerNotInPlayerView(view).ok, true);
});

test("assertTruthLedgerNotInPlayerView: detects leaked truthLedger", () => {
  const view = { title: "Case", truthLedger: {} };
  const result = assertTruthLedgerNotInPlayerView(view);
  assert.equal(result.ok, false);
  assert.ok(result.leaked.includes("truthLedger"));
});

test("assertTruthLedgerNotInPlayerView: detects isLie", () => {
  const view = { testimony: { isLie: true } };
  assert.equal(assertTruthLedgerNotInPlayerView(view).ok, false);
});
