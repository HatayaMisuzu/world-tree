// tests/integration/workflow-server-api.test.js — WSD wiring: HTTP endpoint tests
import test from "node:test"; import assert from "node:assert/strict";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

test("GET /api/workflow/types returns active workflow list", async () => {
  const dataDir = await createTempDataDir("wt-wf-api-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const r = await api(server, "/api/workflow/types");
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.count >= 20);
    assert.ok(!r.body.types.some(t => t.key.includes("HIDDEN")));
  } finally { await server.stop(); await removeTempDir(dataDir); }
});

test("GET /api/workflow/status returns active flag", async () => {
  const dataDir = await createTempDataDir("wt-wf-api-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const r = await api(server, "/api/workflow/status");
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.workflowLayer, "active");
    assert.equal(r.body.preflightProtected, true);
  } finally { await server.stop(); await removeTempDir(dataDir); }
});

test("POST /api/workflow/run returns safe result", async () => {
  const dataDir = await createTempDataDir("wt-wf-api-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const r = await api(server, "/api/workflow/run", {
      method: "POST",
      body: JSON.stringify({ workflowType: "play.turn", modeId: "world-rpg", userInput: "hello" })
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(typeof r.body.visibleText, "string");
    assert.ok(!JSON.stringify(r.body).includes("hiddenTruth"));
  } finally { await server.stop(); await removeTempDir(dataDir); }
});

test("POST /api/workflow/run with invalid type returns safe error", async () => {
  const dataDir = await createTempDataDir("wt-wf-api-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const r = await api(server, "/api/workflow/run", {
      method: "POST",
      body: JSON.stringify({ workflowType: "invalid.type", modeId: "test", userInput: "test" })
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
  } finally { await server.stop(); await removeTempDir(dataDir); }
});
