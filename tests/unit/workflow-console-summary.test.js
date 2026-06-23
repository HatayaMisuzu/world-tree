// tests/unit/workflow-console-summary.test.js — WSD-7 console adapter safety tests
import test from "node:test"; import assert from "node:assert/strict";
import { buildConsoleWorkflowSummary, redactConsoleWorkflowSummary } from "../../src/core/workflows/adapters/console-workflow-adapter.js";

test("summary includes workflowType and counts", () => {
  const s = buildConsoleWorkflowSummary({ debugSummary: { workflowType: "play.turn", modeId: "world-rpg", candidateCount: 3, proposalCount: 1, runtimeUpdateCount: 2, warnings: ["test"] } });
  assert.equal(s.workflowType, "play.turn"); assert.equal(s.counts.candidates, 3);
});

test("hiddenTruth is filtered", () => {
  const s = buildConsoleWorkflowSummary({ debugSummary: { workflowType: "hiddenTruth", modeId: "test", warnings: ["hiddenTruth leak"] } });
  assert.equal(s.workflowType, "[REDACTED]"); assert.equal(s.warnings[0], "[REDACTED]");
});

test("Windows paths are redacted", () => {
  const s = buildConsoleWorkflowSummary({ debugSummary: { workflowType: "play.turn", modeId: "C:\\Users\\test", warnings: [] } });
  assert.equal(s.modeId, "[REDACTED]");
});

test("redactConsoleWorkflowSummary catches unsafe summary", () => {
  const r = redactConsoleWorkflowSummary({ unsafe: "hiddenTruth data" });
  assert.equal(r.redacted, true);
});
