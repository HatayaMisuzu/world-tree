import test from "node:test";
import assert from "node:assert/strict";
import { extractDetectivePlayerCaseView, normalizeDetectiveCaseCapsule } from "../../src/core/detective/detective-case-capsule.js";
import { stripDetectiveRunForPlayer, createDetectiveRunState } from "../../src/core/detective/detective-run-state.js";
import { investigateDetectiveLocation, interrogateDetectiveCharacter, assertNoDetectiveHiddenLeak } from "../../src/core/detective/detective-runtime-engine.js";

const FORBIDDEN = ["truthLedger", "hiddenMeaning", "deceptionReason", "isCulprit", "hiddenNotes", "solutionChain", "realTimeline"];

function assertJsonClean(obj, label) {
  const json = JSON.stringify(obj);
  for (const key of FORBIDDEN) {
    // Check for JSON key pattern "key": not substring
    const keyPattern = new RegExp(`"${key}"`);
    assert.equal(keyPattern.test(json), false, `${label} should not contain key "${key}"`);
  }
}

test("player case view is clean", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Test", truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    evidence: [{ label: "E1", hiddenMeaning: "SECRET" }],
    testimonies: [{ witnessName: "X", deceptionType: "lie", deceptionReason: "hidden" }],
    characters: [{ name: "Culprit", isCulprit: true, hiddenNotes: "secret" }],
  });
  const view = extractDetectivePlayerCaseView(c);
  assertJsonClean(view, "playerCaseView");
});

test("player run state is clean", () => {
  const rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  rs.hiddenCaseState.gmOnlyFlags = { secret: true };
  const safe = stripDetectiveRunForPlayer(rs);
  assertJsonClean(safe, "playerRunState");
});

test("investigate response is clean", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Test", truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    locations: [{ name: "Room", locationId: "l1", discoverableEvidence: ["e1"], isStartingLocation: true }],
    evidence: [{ label: "Knife", evidenceId: "e1", hiddenMeaning: "SECRET" }],
  });
  const rs = createDetectiveRunState({ caseCapsule: c });
  const r = investigateDetectiveLocation({ caseCapsule: c, runState: rs, locationId: "l1" });
  assertJsonClean(r, "investigateResponse");
});

test("interrogate response is clean", () => {
  const c = normalizeDetectiveCaseCapsule({
    title: "Test", truthLedger: { culpritIds: ["x"], motive: "m", method: "m2" },
    characters: [{ name: "Alice", characterId: "c1", testimonyIds: [], isCulprit: false }],
  });
  const rs = createDetectiveRunState({ caseCapsule: c });
  const r = interrogateDetectiveCharacter({ caseCapsule: c, runState: rs, characterId: "c1", question: "?" });
  assertJsonClean(r, "interrogateResponse");
});
