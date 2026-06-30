import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { writeJson } from "../../src/server/fs-utils.js";

const scriptkillFixture = JSON.parse(readFileSync(new URL("../fixtures/single-player-scriptkill-v2/ready-package.json", import.meta.url), "utf8"));

function strategySpec() {
  return {
    specId: "roundtrip_spec",
    title: "Roundtrip Strategy",
    resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
    variables: [{ id: "secret_pressure", min: 0, max: 10, initial: 2, visibility: "secret" }],
    mechanisms: [{ id: "ration", triggerTags: ["ration"], effects: [{ targetId: "supply", targetType: "resource", delta: -1 }] }],
    probabilityRules: [{ id: "scout", triggerTags: ["scout"], baseChance: 0.5, visibility: "partial" }]
  };
}

test("V2 product playable API roundtrip covers five target entries", async () => {
  const dataDir = await createTempDataDir("wt-v2-product-roundtrip-");
  const worldDir = join(dataDir, "engine", "worlds", "RoundtripWorld");
  mkdirSync(join(worldDir, "shared"), { recursive: true });
  mkdirSync(join(worldDir, "runtime"), { recursive: true });
  await writeJson(join(worldDir, "shared", "worldbook.json"), { entries: [] });
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  try {
    const wbSave = await api(server, "/api/worldbook-v2/save", { method: "POST", body: JSON.stringify({ moduleKey: "world:RoundtripWorld", entries: [{ title: "Gate", keys: ["gate"], content: "Gate is visible.", visibility: "public" }] }) });
    assert.equal(wbSave.body.status, "ok");
    const wbPreview = await api(server, "/api/worldbook-v2/inject-preview", { method: "POST", body: JSON.stringify({ moduleKey: "world:RoundtripWorld", userInput: "gate" }) });
    assert.equal(wbPreview.body.status, "ok");
    const wbExport = await api(server, "/api/worldbook-v2/export", { method: "POST", body: JSON.stringify({ moduleKey: "world:RoundtripWorld" }) });
    assert.equal(wbExport.body.status, "ok");

    const sealed = await api(server, "/api/strategy-sim-v2/spec/seal", { method: "POST", body: JSON.stringify({ spec: strategySpec() }) });
    assert.equal(sealed.body.status, "ok");
    const strategyStart = await api(server, "/api/strategy-sim-v2/start", { method: "POST", body: JSON.stringify({ runId: "strategy_roundtrip", sealedSpec: sealed.body.spec }) });
    assert.equal(strategyStart.body.status, "ok");
    const strategyTurn = await api(server, "/api/strategy-sim-v2/turn", { method: "POST", body: JSON.stringify({ runId: "strategy_roundtrip", action: "ration and scout" }) });
    assert.equal(strategyTurn.body.status, "ok");
    assert.equal(JSON.stringify(strategyTurn.body.publicView).includes("secret_pressure"), false);

    const tabletopStart = await api(server, "/api/tabletop-v2/start", { method: "POST", body: JSON.stringify({ module: { title: "API Tabletop", sourceType: "quick_start" } }) });
    assert.equal(tabletopStart.body.status, "ok");
    const tabletopTurn = await api(server, "/api/tabletop-v2/turn", { method: "POST", body: JSON.stringify({ runId: tabletopStart.body.run.runId, playerIntent: "I inspect the room." }) });
    assert.equal(tabletopTurn.body.status, "ok");
    assert.equal((await api(server, "/api/tabletop-v2/save", { method: "POST", body: JSON.stringify({ runId: tabletopStart.body.run.runId }) })).body.status, "ok");
    assert.equal((await api(server, "/api/tabletop-v2/load-run", { method: "POST", body: JSON.stringify({ runId: tabletopStart.body.run.runId }) })).body.status, "ok");
    assert.equal((await api(server, "/api/tabletop-v2/export-run", { method: "POST", body: JSON.stringify({ runId: tabletopStart.body.run.runId }) })).body.status, "ok");

    const detectiveCase = await api(server, "/api/detective-v2/import-commit", { method: "POST", body: JSON.stringify({ text: JSON.stringify({ title: "API Case", truthLedger: { culpritIds: ["x"], motive: "hidden", method: "hidden" }, locations: [{ locationId: "room", name: "Room", isStartingLocation: true }] }) }) });
    assert.equal(detectiveCase.body.status, "ok");
    const detectiveStart = await api(server, "/api/detective-v2/start", { method: "POST", body: JSON.stringify({ caseId: detectiveCase.body.caseId }) });
    assert.equal(detectiveStart.body.status, "ok");
    assert.equal((await api(server, "/api/detective-v2/investigate", { method: "POST", body: JSON.stringify({ runId: detectiveStart.body.run.runId, locationId: "room" }) })).body.status, "ok");
    assert.equal((await api(server, "/api/detective-v2/export-run", { method: "POST", body: JSON.stringify({ runId: detectiveStart.body.run.runId }) })).body.status, "ok");

    const skImport = await api(server, "/api/single-player-scriptkill-v2/import-commit", { method: "POST", body: JSON.stringify({ package: scriptkillFixture }) });
    assert.equal(skImport.body.status, "ok");
    const skStart = await api(server, "/api/single-player-scriptkill-v2/start", { method: "POST", body: JSON.stringify({ scriptId: skImport.body.scriptId, runId: "sk_roundtrip", realPlayerRoleId: "role_writer" }) });
    assert.equal(skStart.body.status, "ok");
    assert.equal((await api(server, "/api/single-player-scriptkill-v2/read-role-act", { method: "POST", body: JSON.stringify({ runId: skStart.body.runId }) })).body.status, "ok");
    await api(server, "/api/single-player-scriptkill-v2/advance-phase", { method: "POST", body: JSON.stringify({ runId: skStart.body.runId, nextPhaseId: "phase_public" }) });
    assert.equal((await api(server, "/api/single-player-scriptkill-v2/public-talk", { method: "POST", body: JSON.stringify({ runId: skStart.body.runId, text: "I give my timeline." }) })).body.status, "ok");
    assert.equal((await api(server, "/api/single-player-scriptkill-v2/export-run", { method: "POST", body: JSON.stringify({ runId: skStart.body.runId }) })).body.status, "ok");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
