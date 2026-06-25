import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetectiveCaseCapsule, validateDetectiveCaseCapsule, extractDetectivePlayerCaseView, extractDetectiveHiddenCaseView } from "../../src/core/detective/detective-case-capsule.js";

test("normalizeDetectiveCaseCapsule: sets mode detective", () => {
  const c = normalizeDetectiveCaseCapsule({ title: "Test Case", truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" } });
  assert.equal(c.mode, "detective");
  assert.ok(c.runtimeIsolation);
  assert.equal(c.runtimeIsolation.mode, "detective");
});

test("extractDetectivePlayerCaseView: no truthLedger", () => {
  const c = normalizeDetectiveCaseCapsule({ title: "Secret", truthLedger: { culpritIds: ["x"], motive: "greed", method: "poison" } });
  const view = extractDetectivePlayerCaseView(c);
  assert.equal(view.title, "Secret");
  assert.equal(view.truthLedger, undefined);
  assert.equal(view.runtimeIsolation, undefined);
});

test("extractDetectivePlayerCaseView: evidence strips hiddenMeaning", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Evidence Test",
    truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    evidence: [{ label: "E1", visibleDescription: "A letter", hiddenMeaning: "TOP SECRET" }],
  });
  const view = extractDetectivePlayerCaseView(c);
  assert.equal(view.evidence[0].hiddenMeaning, undefined);
  assert.equal(view.evidence[0].label, "E1");
});

test("extractDetectivePlayerCaseView: testimony strips deceptionReason", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Testimony Test",
    truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    testimonies: [{ witnessName: "Bob", summary: "I saw it", deceptionType: "lie", deceptionReason: "protecting son" }],
  });
  const view = extractDetectivePlayerCaseView(c);
  assert.equal(view.testimonies[0].deceptionReason, undefined);
});

test("extractDetectivePlayerCaseView: characters strip isCulprit", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Char Test",
    truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    characters: [{ name: "Alice", isCulprit: true }, { name: "Bob" }],
  });
  const view = extractDetectivePlayerCaseView(c);
  assert.equal(view.characters[0].isCulprit, undefined);
});

test("extractDetectiveHiddenCaseView: includes truth and hidden", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Hidden Test",
    truthLedger: { culpritIds: ["x"], motive: "greed", method: "poison" },
    locations: [{ name: "Secret Room", isHidden: true }],
  });
  const hidden = extractDetectiveHiddenCaseView(c);
  assert.ok(hidden.truthLedger);
  assert.equal(hidden.hiddenLocations.length, 1);
});

test("validateDetectiveCaseCapsule: valid passes", () => {
  const c = normalizeDetectiveCaseCapsule({ title: "Valid", truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" } });
  assert.equal(validateDetectiveCaseCapsule(c).valid, true);
});

test("player view JSON does not contain forbidden strings", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Forbidden Test",
    truthLedger: { culpritIds: ["x"], motive: "m", method: "m2", solutionChain: ["step1"] },
    testimonies: [{ witnessName: "X", deceptionType: "lie", deceptionReason: "hidden reason" }],
    evidence: [{ label: "E1", hiddenMeaning: "TOP SECRET" }],
    characters: [{ name: "Culprit", isCulprit: true, hiddenNotes: "secret" }],
  });
  const view = extractDetectivePlayerCaseView(c);
  const json = JSON.stringify(view);
  for (const forbidden of ["truthLedger", "hiddenTruth", "solutionChain", "hiddenMeaning", "isLie", "lieReason"]) {
    assert.equal(json.includes(forbidden), false, `player view should not contain "${forbidden}"`);
  }
});
