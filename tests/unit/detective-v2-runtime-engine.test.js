import test from "node:test";
import assert from "node:assert/strict";
import { investigateDetectiveLocation, interrogateDetectiveCharacter, extractDetectiveNotebookEntry, submitDetectiveDeduction, assertNoDetectiveHiddenLeak } from "../../src/core/detective/detective-runtime-engine.js";
import { createDetectiveRunState } from "../../src/core/detective/detective-run-state.js";
import { normalizeDetectiveCaseCapsule } from "../../src/core/detective/detective-case-capsule.js";

const makeCase = () => normalizeDetectiveCaseCapsule({
  title: "Test",
  truthLedger: { culpritIds: ["x"], motive: "greed", method: "knife" },
  locations: [{ name: "Room", locationId: "loc1", discoverableEvidence: ["e1"], isStartingLocation: true }],
  characters: [{ name: "Alice", characterId: "c1", testimonyIds: ["t1"] }, { name: "Bob", characterId: "c2" }],
  evidence: [{ label: "Knife", evidenceId: "e1" }],
  testimonies: [{ testimonyId: "t1", witnessName: "Alice", summary: "I saw it", deceptionType: "lie", deceptionReason: "hidden" }],
});

test("investigate: returns public evidence only", () => {
  const c = makeCase();
  const rs = createDetectiveRunState({ caseCapsule: c });
  const r = investigateDetectiveLocation({ caseCapsule: c, runState: rs, locationId: "loc1" });
  assert.equal(r.status, "ok");
  if (r.discoveredEvidence.length > 0) assert.equal(r.discoveredEvidence[0].hiddenMeaning, undefined);
});

test("interrogate: no deceptionReason in response", () => {
  const c = makeCase();
  const rs = createDetectiveRunState({ caseCapsule: c });
  const r = interrogateDetectiveCharacter({ caseCapsule: c, runState: rs, characterId: "c1", question: "What happened?" });
  assert.equal(r.status, "ok");
  const json = JSON.stringify(r);
  assert.equal(json.includes("deceptionReason"), false);
});

test("extractNotebookEntry: creates entry", () => {
  const rs = createDetectiveRunState({ caseCapsule: makeCase() });
  const r = extractDetectiveNotebookEntry({ runState: rs, selection: { sourceType: "evidence", sourceId: "e1", summary: "Knife" } });
  assert.equal(r.status, "ok");
  assert.ok(r.entry.noteId);
});

test("deduction: returns score without truth dump", () => {
  const c = makeCase();
  const rs = createDetectiveRunState({ caseCapsule: c });
  const r = submitDetectiveDeduction({ caseCapsule: c, runState: rs, report: { culpritIds: ["x"], motive: "greed", method: "knife" } });
  assert.equal(r.status, "ok");
  assert.ok(r.score > 0);
  const json = JSON.stringify(r);
  assert.equal(json.includes("truthLedger"), false);
});

test("assertNoDetectiveHiddenLeak: catches leakage", () => {
  assert.equal(assertNoDetectiveHiddenLeak({ title: "Safe" }).ok, true);
  assert.equal(assertNoDetectiveHiddenLeak({ truthLedger: "bad" }).ok, false);
});
