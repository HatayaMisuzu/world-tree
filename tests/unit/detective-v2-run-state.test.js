import test from "node:test";
import assert from "node:assert/strict";
import { createDetectiveRunState, stripDetectiveRunForPlayer, recordDetectiveDiscovery, validateDetectiveRunState } from "../../src/core/detective/detective-run-state.js";

test("createDetectiveRunState: detective mode", () => {
  const rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  assert.equal(rs.mode, "detective");
  assert.ok(rs.runId);
  assert.ok(rs.runtimeIsolation);
});

test("stripDetectiveRunForPlayer: removes hiddenCaseState", () => {
  const rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  const safe = stripDetectiveRunForPlayer(rs);
  assert.equal(safe.hiddenCaseState, undefined);
  assert.equal(safe.runtimeIsolation, undefined);
  assert.ok(safe.publicState);
});

test("recordDetectiveDiscovery: adds evidence IDs", () => {
  let rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  rs = recordDetectiveDiscovery(rs, { locationId: "loc1", newEvidenceIds: ["e1", "e2"] });
  assert.ok(rs.publicState.discoveredEvidenceIds.includes("e1"));
});

test("validateDetectiveRunState: valid passes", () => {
  const rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  assert.equal(validateDetectiveRunState(rs).valid, true);
});

test("validateDetectiveRunState: non-detective mode fails", () => {
  const rs = createDetectiveRunState({ caseCapsule: { caseId: "c1" } });
  rs.mode = "tabletop";
  assert.equal(validateDetectiveRunState(rs).valid, false);
});
