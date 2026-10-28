import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startTabletopV2Run,
  saveTabletopV2Run,
  branchTabletopV2Run,
  switchTabletopV2Branch,
} from "../../src/server/tabletop-v2-service.js";

function runPaths(dataRoot, runId) {
  const dir = join(dataRoot, "engine", "tabletop-v2", "runs", runId);
  return { dir, state: join(dir, "run-state.json") };
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf-8"));

async function setup() {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-h3-"));
  const deps = { dataRoot };
  const start = await startTabletopV2Run({ module: { title: "H3 Adventure", sourceType: "quick_start" } }, deps);
  assert.equal(start.status, "ok");
  const runId = start.run.runId;
  const p = runPaths(dataRoot, runId);
  const save = await saveTabletopV2Run({ runId, label: "fork-point" }, deps);
  assert.equal(save.status, "ok");
  const saveSlot = readJson(join(p.dir, "saves", `${save.saveId}.json`));
  // Advance the run past the fork point (simulated later turns).
  const advanced = readJson(p.state);
  advanced.turnIndex = 7;
  advanced.publicState = { ...(advanced.publicState || {}), marker: "after-fork" };
  advanced.hiddenGmState = { ...(advanced.hiddenGmState || {}), secret: "after-fork" };
  advanced.rollHistory = [{ roll: 20 }];
  writeFileSync(p.state, JSON.stringify(advanced));
  const branch = await branchTabletopV2Run({ runId, saveId: save.saveId, branchLabel: "alt" }, deps);
  assert.equal(branch.status, "ok");
  return { dataRoot, deps, runId, p, saveSlot, saveId: save.saveId, branchId: branch.branchId };
}

test("H3: switching branch restores the forked save state and later saves carry the branch lineage", async () => {
  const ctx = await setup();
  try {
    const result = await switchTabletopV2Branch({ runId: ctx.runId, branchId: ctx.branchId }, ctx.deps);
    assert.equal(result.status, "ok");
    const state = readJson(ctx.p.state);
    assert.equal(state.turnIndex, ctx.saveSlot.turnIndex);
    assert.deepEqual(state.publicState, ctx.saveSlot.publicSnapshot);
    assert.deepEqual(state.hiddenGmState, ctx.saveSlot.hiddenSnapshot);
    assert.deepEqual(state.rollHistory, ctx.saveSlot.rollHistorySnapshot);
    assert.equal(state.publicState.marker, undefined);
    assert.equal(state.restoredFromSaveId, ctx.saveId);
    assert.equal(state.branchId, ctx.branchId);
    assert.equal(state.activeBranchId, ctx.branchId);

    const after = await saveTabletopV2Run({ runId: ctx.runId, label: "on-branch" }, ctx.deps);
    const slot = readJson(join(ctx.p.dir, "saves", `${after.saveId}.json`));
    assert.equal(slot.branchId, ctx.branchId);
    assert.deepEqual(slot.publicSnapshot, ctx.saveSlot.publicSnapshot);
  } finally {
    rmSync(ctx.dataRoot, { recursive: true, force: true });
  }
});

test("H3: corrupt forked save degrades to a label-only switch instead of failing", async () => {
  const ctx = await setup();
  try {
    writeFileSync(join(ctx.p.dir, "saves", `${ctx.saveId}.json`), "{corrupt");
    const warn = console.warn; console.warn = () => {};
    let result;
    try { result = await switchTabletopV2Branch({ runId: ctx.runId, branchId: ctx.branchId }, ctx.deps); } finally { console.warn = warn; }
    assert.equal(result.status, "ok");
    const state = readJson(ctx.p.state);
    assert.equal(state.branchId, ctx.branchId);
    assert.equal(state.turnIndex, 7);
  } finally {
    rmSync(ctx.dataRoot, { recursive: true, force: true });
  }
});
