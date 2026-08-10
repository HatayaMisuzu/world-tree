import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStrategySimV2ProductService, safeStrategyRunId } from "../../src/server/strategy-sim-v2-product-service.js";

function minimalSpec() {
  return {
    specId: "product_spec",
    title: "User Provided Strategy",
    resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
    variables: [{ id: "secret_pressure", label: "Secret Pressure", min: 0, max: 10, initial: 3, visibility: "secret" }],
    mechanisms: [{ id: "ration", label: "Ration", triggerTags: ["ration"], effects: [{ targetType: "resource", targetId: "supply", delta: -1, reason: "spent supply" }] }],
    probabilityRules: [{ id: "scout", label: "Scout", triggerTags: ["scout"], baseChance: 0.5, visibility: "partial" }],
    balanceProfile: { rngSeed: "product-seed", expectedRunLength: 5 }
  };
}

function makeService() {
  const root = mkdtempSync(join(tmpdir(), "wt-strategy-product-"));
  return { root, service: createStrategySimV2ProductService({ dataRoot: () => root }), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("validates and rejects user specs", async () => {
  const ctx = makeService();
  try {
    assert.equal((await ctx.service.validateSpec({ spec: minimalSpec() })).status, "ok");
    const invalid = await ctx.service.validateSpec({ spec: { ...minimalSpec(), mechanisms: [{ id: "bad", effects: [{ targetId: "missing" }] }] } });
    assert.equal(invalid.status, "error");
  } finally {
    ctx.cleanup();
  }
});

test("seals spec, starts run, persists state, turns, saves, loads, and exports", async () => {
  const ctx = makeService();
  try {
    const sealed = await ctx.service.sealSpec({ spec: minimalSpec() });
    assert.equal(sealed.status, "ok");
    assert.equal(sealed.spec.sealMetadata.sealed, true);

    const start = await ctx.service.startRun({ runId: "run_product", sealedSpec: sealed.spec });
    assert.equal(start.status, "ok");
    assert.equal(existsSync(join(ctx.root, "engine", "runs", "strategy-sim-v2", "run_product", "state.json")), true);

    const turn = await ctx.service.turn({ runId: "run_product", action: "ration and scout" });
    assert.equal(turn.status, "ok");
    assert.equal(turn.turn, 1);
    assert.equal(JSON.stringify(turn.publicView).includes("secret_pressure"), false);

    assert.equal((await ctx.service.saveRun({ runId: "run_product" })).status, "ok");
    const loaded = await ctx.service.loadRun({ runId: "run_product" });
    assert.equal(loaded.status, "ok");
    assert.equal(loaded.publicView.turn, 1);

    const exported = await ctx.service.exportRun({ runId: "run_product" });
    assert.equal(exported.status, "ok");
    assert.equal(JSON.stringify(exported.export).includes("secretState"), false);
  } finally {
    ctx.cleanup();
  }
});

test("rejects unsafe strategy run ids instead of sanitizing into paths", async () => {
  const ctx = makeService();
  try {
    const sealed = await ctx.service.sealSpec({ spec: minimalSpec() });
    assert.equal(sealed.status, "ok");

    for (const runId of ["", ".", "..", "../x", "x/../y", "a".repeat(82)]) {
      assert.equal(safeStrategyRunId(runId), "");
      const started = await ctx.service.startRun({ runId, sealedSpec: sealed.spec });
      assert.equal(started.status, "error");
      assert.equal(started.code, "INVALID_RUN_ID");
    }

    const valid = await ctx.service.startRun({ runId: "run.product-01", sealedSpec: sealed.spec });
    assert.equal(valid.status, "ok");
    assert.equal(existsSync(join(ctx.root, "engine", "runs", "strategy-sim-v2", "run.product-01", "state.json")), true);
  } finally {
    ctx.cleanup();
  }
});

test("supports multi-turn resume, ending, recoverable rejection, and restart without hidden-state leaks", async () => {
  const ctx = makeService();
  try {
    const sealed = await ctx.service.sealSpec({ spec: minimalSpec() });
    assert.equal(sealed.status, "ok");
    assert.equal((await ctx.service.startRun({ runId: "run_story", sealedSpec: sealed.spec })).status, "ok");

    for (let expectedTurn = 1; expectedTurn <= 5; expectedTurn += 1) {
      const result = await ctx.service.turn({ runId: "run_story", action: "ration and scout" });
      assert.equal(result.status, "ok");
      assert.equal(result.turn, expectedTurn);
      assert.equal(result.history.length, expectedTurn);
      const publicJson = JSON.stringify({ view: result.publicView, history: result.history });
      for (const forbidden of ["secret_pressure", "rngSeed", "finalChance", "rawRoll"]) assert.equal(publicJson.includes(forbidden), false);
    }

    const loaded = await ctx.service.loadRun({ runId: "run_story" });
    assert.equal(loaded.status, "ok");
    assert.equal(loaded.publicView.turn, 5);
    assert.equal(loaded.history.length, 5);
    assert.equal(loaded.ending.status, "defeat");

    const afterEnd = await ctx.service.turn({ runId: "run_story", action: "ration" });
    assert.deepEqual({ status: afterEnd.status, code: afterEnd.code, recoverable: afterEnd.recoverable }, { status: "error", code: "RUN_ENDED", recoverable: true });
    assert.equal((await ctx.service.loadRun({ runId: "run_story" })).publicView.turn, 5);

    const restarted = await ctx.service.restartRun({ runId: "run_story" });
    assert.equal(restarted.status, "ok");
    assert.notEqual(restarted.runId, "run_story");
    const listed = await ctx.service.listRuns();
    assert.equal(listed.runs.some((run) => run.runId === "run_story" && run.phase === "ended"), true);
    assert.equal(listed.runs.some((run) => run.runId === restarted.runId && run.turn === 0), true);
  } finally {
    ctx.cleanup();
  }
});
