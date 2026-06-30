import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { branchTabletopV2Run, exportTabletopV2Run, handleTabletopV2Turn, loadTabletopV2Run, restoreTabletopV2Save, saveTabletopV2Run, startTabletopV2Run } from "../../src/server/tabletop-v2-service.js";

test("tabletop minimal start/turn/save/load/export keeps GM notes hidden", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-tabletop-product-"));
  try {
    const deps = { dataRoot };
    const start = await startTabletopV2Run({ module: { title: "Structural Tabletop", sourceType: "quick_start" } }, deps);
    assert.equal(start.status, "ok");
    const turn = await handleTabletopV2Turn({ runId: start.run.runId, playerIntent: "I inspect the room." }, deps);
    assert.equal(turn.status, "ok");
    const save = await saveTabletopV2Run({ runId: start.run.runId, label: "after action" }, deps);
    assert.equal(save.status, "ok");
    const loaded = await loadTabletopV2Run({ runId: start.run.runId }, deps);
    assert.equal(loaded.status, "ok");
    const exported = await exportTabletopV2Run({ runId: start.run.runId }, deps);
    assert.equal(exported.status, "ok");
    assert.equal(JSON.stringify({ turn, loaded, exported }).includes("gmBook"), false);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("tabletop branch and restore keep run isolation", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-tabletop-branch-product-"));
  try {
    const deps = { dataRoot };
    const start = await startTabletopV2Run({ module: { title: "Branch Tabletop", sourceType: "quick_start" } }, deps);
    const save = await saveTabletopV2Run({ runId: start.run.runId, label: "fork point" }, deps);
    const branch = await branchTabletopV2Run({ runId: start.run.runId, saveId: save.saveId, branchLabel: "alternate" }, deps);
    assert.equal(branch.status, "ok");
    const restored = await restoreTabletopV2Save({ runId: start.run.runId, saveId: save.saveId }, deps);
    assert.equal(restored.status, "ok");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
