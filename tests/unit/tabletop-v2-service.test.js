import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startTabletopV2Run,
  previewTabletopV2Import,
  handleTabletopV2Turn,
  saveTabletopV2Run,
  branchTabletopV2Run,
  endTabletopV2Run,
} from "../../src/server/tabletop-v2-service.js";

// Isolated temp directory
const DATA_ROOT = join(tmpdir(), `wtd-tabletop-v2-test-${Date.now()}`);
const deps = { dataRoot: DATA_ROOT };

function ensureCleanRoot() {
  if (existsSync(DATA_ROOT)) rmSync(DATA_ROOT, { recursive: true, force: true });
  mkdirSync(DATA_ROOT, { recursive: true });
}

// ── Start run ──

test("startTabletopV2Run: creates run from module", async () => {
  ensureCleanRoot();
  const result = await startTabletopV2Run({
    module: { title: "Test Adventure", sourceType: "quick_start" },
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.run.runId);
  assert.ok(result.run.publicState);

  // Verify persistence
  const statePath = join(DATA_ROOT, "engine", "tabletop-v2", "runs", result.run.runId, "run-state.json");
  assert.ok(existsSync(statePath));
});

test("startTabletopV2Run: no dataRoot returns error", async () => {
  const result = await startTabletopV2Run({ module: { title: "Test" } }, {});
  assert.equal(result.status, "error");
});

// ── Import preview ──

test("previewTabletopV2Import: returns preview", async () => {
  const result = await previewTabletopV2Import({
    text: "A dark forest adventure",
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.preview.title);
});

// ── Turn ──

test("handleTabletopV2Turn: processes intent with ruling", async () => {
  ensureCleanRoot();
  const start = await startTabletopV2Run({
    module: { title: "Turn Test", sourceType: "quick_start" },
  }, deps);
  const result = await handleTabletopV2Turn({
    runId: start.run.runId,
    playerIntent: "我搜索房间",
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.ruling);
  assert.ok(result.ruling.classification);
});

test("handleTabletopV2Turn: returns hidden roll without details for player", async () => {
  ensureCleanRoot();
  const start = await startTabletopV2Run({
    module: {
      title: "Hidden Roll Test",
      sourceType: "quick_start",
      ruleset: { kind: "d20", rollVisibilityPolicy: { defaultVisibility: "public", hiddenActionTypes: ["stealth"] } },
    },
  }, deps);
  const result = await handleTabletopV2Turn({
    runId: start.run.runId,
    playerIntent: "我潜行通过走廊",
  }, deps);
  assert.equal(result.status, "ok");
  if (result.ruling.roll?.visibility === "hidden") {
    assert.equal(result.ruling.roll.expression, "???");
    assert.equal(result.ruling.roll.total, null);
  }
});

test("handleTabletopV2Turn: missing runId returns error", async () => {
  const result = await handleTabletopV2Turn({
    playerIntent: "test",
  }, deps);
  assert.equal(result.status, "error");
});

// ── Save ──

test("saveTabletopV2Run: creates save slot", async () => {
  ensureCleanRoot();
  const start = await startTabletopV2Run({
    module: { title: "Save Test", sourceType: "quick_start" },
  }, deps);
  const result = await saveTabletopV2Run({
    runId: start.run.runId,
    label: "checkpoint 1",
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.saveId);

  // Verify persistence
  const savePath = join(DATA_ROOT, "engine", "tabletop-v2", "runs", start.run.runId, "saves", `${result.saveId}.json`);
  assert.ok(existsSync(savePath));
});

// ── Branch ──

test("branchTabletopV2Run: forks from save", async () => {
  ensureCleanRoot();
  const start = await startTabletopV2Run({
    module: { title: "Branch Test", sourceType: "quick_start" },
  }, deps);
  const save = await saveTabletopV2Run({
    runId: start.run.runId,
    label: "before branch",
  }, deps);
  const result = await branchTabletopV2Run({
    runId: start.run.runId,
    saveId: save.saveId,
    branchLabel: "alternate",
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.branchId);
});

// ── End summary ──

test("endTabletopV2Run: produces summary", async () => {
  ensureCleanRoot();
  const start = await startTabletopV2Run({
    module: { title: "End Test", sourceType: "quick_start" },
  }, deps);
  const result = await endTabletopV2Run({
    runId: start.run.runId,
  }, deps);
  assert.equal(result.status, "ok");
  assert.ok(result.summary);
  assert.ok(result.summary.summary);
});

test("endTabletopV2Run: missing runId returns error", async () => {
  const result = await endTabletopV2Run({}, deps);
  assert.equal(result.status, "error");
});

// Cleanup
test("cleanup", () => {
  if (existsSync(DATA_ROOT)) rmSync(DATA_ROOT, { recursive: true, force: true });
});
