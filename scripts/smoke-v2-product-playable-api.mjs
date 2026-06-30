import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";
import { writeJson } from "../src/server/fs-utils.js";

const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/single-player-scriptkill-v2/ready-package.json", import.meta.url), "utf8"));

function strategySpec() {
  return {
    specId: "smoke_spec",
    title: "Smoke Strategy",
    resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
    variables: [{ id: "secret_pressure", min: 0, max: 10, initial: 2, visibility: "secret" }],
    mechanisms: [{ id: "ration", triggerTags: ["ration"], effects: [{ targetId: "supply", targetType: "resource", delta: -1 }] }]
  };
}

async function run() {
  const dataDir = await createTempDataDir("wt-v2-product-api-smoke-");
  const evidenceDir = join("audit", `v2-product-playable-closure-${Date.now()}`);
  mkdirSync(evidenceDir, { recursive: true });
  const worldDir = join(dataDir, "engine", "worlds", "SmokeWorld");
  mkdirSync(join(worldDir, "shared"), { recursive: true });
  mkdirSync(join(worldDir, "runtime"), { recursive: true });
  await writeJson(join(worldDir, "shared", "worldbook.json"), { entries: [] });
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  const evidence = { status: "ok", mode: "local fallback only; Real LLM not claimed", flows: {} };
  try {
    let r = await api(server, "/api/worldbook-v2/save", { method: "POST", body: JSON.stringify({ moduleKey: "world:SmokeWorld", entries: [{ title: "Gate", keys: ["gate"], content: "Gate is visible.", visibility: "public" }] }) });
    assert.equal(r.body.status, "ok");
    r = await api(server, "/api/worldbook-v2/export", { method: "POST", body: JSON.stringify({ moduleKey: "world:SmokeWorld" }) });
    assert.equal(r.body.status, "ok");
    evidence.flows.worldbookV2 = { status: "ok", exportedEntries: r.body.export.entries.length };

    const sealed = await api(server, "/api/strategy-sim-v2/spec/seal", { method: "POST", body: JSON.stringify({ spec: strategySpec() }) });
    const start = await api(server, "/api/strategy-sim-v2/start", { method: "POST", body: JSON.stringify({ runId: "smoke_strategy", sealedSpec: sealed.body.spec }) });
    const turn = await api(server, "/api/strategy-sim-v2/turn", { method: "POST", body: JSON.stringify({ runId: "smoke_strategy", action: "ration" }) });
    assert.equal(turn.body.status, "ok");
    evidence.flows.strategySimV2 = { status: "ok", turn: turn.body.turn, hiddenSafe: !JSON.stringify(turn.body.publicView).includes("secret_pressure") };

    const ttStart = await api(server, "/api/tabletop-v2/start", { method: "POST", body: JSON.stringify({ module: { title: "Smoke Tabletop", sourceType: "quick_start" } }) });
    await api(server, "/api/tabletop-v2/turn", { method: "POST", body: JSON.stringify({ runId: ttStart.body.run.runId, playerIntent: "inspect" }) });
    const ttExport = await api(server, "/api/tabletop-v2/export-run", { method: "POST", body: JSON.stringify({ runId: ttStart.body.run.runId }) });
    assert.equal(ttExport.body.status, "ok");
    evidence.flows.tabletop = { status: "ok", runId: ttStart.body.run.runId };

    const detCase = await api(server, "/api/detective-v2/import-commit", { method: "POST", body: JSON.stringify({ text: JSON.stringify({ title: "Smoke Case", truthLedger: { culpritIds: ["x"], motive: "hidden", method: "hidden" }, locations: [{ locationId: "room", name: "Room", isStartingLocation: true }] }) }) });
    const detStart = await api(server, "/api/detective-v2/start", { method: "POST", body: JSON.stringify({ caseId: detCase.body.caseId }) });
    const detExport = await api(server, "/api/detective-v2/export-run", { method: "POST", body: JSON.stringify({ runId: detStart.body.run.runId }) });
    assert.equal(detExport.body.status, "ok");
    evidence.flows.detective = { status: "ok", runId: detStart.body.run.runId, hiddenSafe: !JSON.stringify(detExport.body.report.playerCase).includes("truthLedger") };

    const skImport = await api(server, "/api/single-player-scriptkill-v2/import-commit", { method: "POST", body: JSON.stringify({ package: fixture }) });
    const skStart = await api(server, "/api/single-player-scriptkill-v2/start", { method: "POST", body: JSON.stringify({ scriptId: skImport.body.scriptId, runId: "smoke_scriptkill", realPlayerRoleId: "role_writer" }) });
    const skExport = await api(server, "/api/single-player-scriptkill-v2/export-run", { method: "POST", body: JSON.stringify({ runId: skStart.body.runId }) });
    assert.equal(skExport.body.status, "ok");
    evidence.flows.scriptKill = { status: "ok", runId: skStart.body.runId, hiddenSafe: !JSON.stringify(skExport.body.export.playerRun).includes("DM手册") };
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
  const evidencePath = join(evidenceDir, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(`V2 product playable API smoke: PASS ${evidencePath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
