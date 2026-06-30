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
    balanceProfile: { rngSeed: "product-seed" }
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
