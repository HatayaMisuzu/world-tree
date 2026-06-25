import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { previewDetectiveV2Import, commitDetectiveV2Import, startDetectiveV2Run, investigateDetectiveV2 } from "../../src/server/detective-v2-service.js";

const DATA_ROOT = join(tmpdir(), `wtd-detective-v2-test-${Date.now()}`);
const deps = { dataRoot: DATA_ROOT };

function ensureCleanRoot() {
  if (existsSync(DATA_ROOT)) rmSync(DATA_ROOT, { recursive: true, force: true });
  mkdirSync(DATA_ROOT, { recursive: true });
}

test("preview: JSON case returns ok", async () => {
  const r = await previewDetectiveV2Import({ text: '{"title":"T","truthLedger":{"culpritIds":["x"],"motive":"m","method":"m2"}}' });
  assert.ok(r.status === "ok" || r.status === "needs_completion");
});

test("preview: markdown returns sections", async () => {
  const r = await previewDetectiveV2Import({ text: "# Case\n## Truth\nculprit: Bob" });
  assert.equal(r.inputType, "markdown_case_design");
});

test("commit: writes to detective-v2 namespace", async () => {
  ensureCleanRoot();
  const r = await commitDetectiveV2Import({
    text: '{"title":"T","truthLedger":{"culpritIds":["x"],"motive":"m","method":"m2"}}'
  }, deps);
  assert.equal(r.status, "ok");
  const casePath = join(DATA_ROOT, "engine", "detective-v2", "cases", r.caseId, "case.json");
  assert.ok(existsSync(casePath), `expected ${casePath} to exist`);
});

test("commit: needs_completion without truth", async () => {
  ensureCleanRoot();
  const r = await commitDetectiveV2Import({ text: "A murder happened" }, deps);
  assert.equal(r.status, "needs_completion");
});

test("start: creates run in detective-v2 namespace", async () => {
  ensureCleanRoot();
  const commit = await commitDetectiveV2Import({ text: '{"title":"T","truthLedger":{"culpritIds":["x"],"motive":"m","method":"m2"}}' }, deps);
  const r = await startDetectiveV2Run({ caseId: commit.caseId }, deps);
  assert.equal(r.status, "ok");
  const runPath = join(DATA_ROOT, "engine", "detective-v2", "runs", r.run.runId, "run-state.json");
  assert.ok(existsSync(runPath));
});

test("investigate: returns public fields", async () => {
  ensureCleanRoot();
  const c = await commitDetectiveV2Import({ text: '{"title":"T","truthLedger":{"culpritIds":["x"],"motive":"m","method":"m2"},"locations":[{"name":"Room","locationId":"l1","isStartingLocation":true}]}' }, deps);
  const s = await startDetectiveV2Run({ caseId: c.caseId }, deps);
  const r = await investigateDetectiveV2({ runId: s.run.runId, locationId: "l1" }, deps);
  assert.equal(r.status, "ok");
  const json = JSON.stringify(r);
  assert.equal(json.includes("truthLedger"), false);
});

test("cleanup", () => { if (existsSync(DATA_ROOT)) rmSync(DATA_ROOT, { recursive: true, force: true }); });
