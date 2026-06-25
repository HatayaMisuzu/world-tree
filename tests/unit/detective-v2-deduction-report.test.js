import test from "node:test";
import assert from "node:assert/strict";
import { createDeductionReportSchema, normalizeDeductionReport, validateDeductionReport, scoreDeductionReport } from "../../src/core/detective/detective-deduction-report.js";

test("createDeductionReportSchema: default locks", () => {
  const s = createDeductionReportSchema();
  assert.ok(s.locks.length >= 7);
});

test("normalizeDeductionReport: fills defaults", () => {
  const r = normalizeDeductionReport({ caseId: "c1", culpritIds: ["x"], motive: "greed", method: "knife" });
  assert.equal(r.caseId, "c1");
  assert.deepEqual(r.culpritIds, ["x"]);
});

test("validateDeductionReport: missing required locks fails", () => {
  const s = createDeductionReportSchema();
  const r = normalizeDeductionReport({ caseId: "c1" });
  assert.equal(validateDeductionReport(r, s).valid, false);
});

test("scoreDeductionReport: correct culprit scores", () => {
  const truth = { culpritIds: ["x"], criticalEvidenceIds: ["e1"] };
  const r = normalizeDeductionReport({ caseId: "c1", culpritIds: ["x"], keyEvidenceIds: ["e1"] });
  const result = scoreDeductionReport(r, truth);
  assert.ok(result.score > 0);
  assert.ok(result.locks.some(l => l.lockId === "culprit" && l.ok));
});

test("scoreDeductionReport: wrong culprit scores 0", () => {
  const truth = { culpritIds: ["x"] };
  const r = normalizeDeductionReport({ caseId: "c1", culpritIds: ["y"] });
  const result = scoreDeductionReport(r, truth);
  const culpritLock = result.locks.find(l => l.lockId === "culprit");
  assert.equal(culpritLock.ok, false);
});
