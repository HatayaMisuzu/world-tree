import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(file, seed = {}) {
  const sandbox = { ...seed };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("character search filters existing cards without rerendering and restores the full list", () => {
  const cards = [
    { textContent: "Alice guide north", hidden: false, style: {}, dataset: {}, parentElement: null },
    { textContent: "Bob keeper harbor", hidden: false, style: {}, dataset: {}, parentElement: null }
  ];
  const empty = { hidden: true, textContent: "" };
  const runtime = load("browser/views/core-views.js", {
    AS: { characterQuery: "" },
    U: { qsa: selector => selector === "[data-character-id]" ? cards : [], qs: selector => selector === "[data-character-search-empty]" ? empty : null },
    C: {},
    document: {}
  });

  runtime.applyCharacterSearchFilter("alice");
  assert.equal(cards[0].hidden, false);
  assert.equal(cards[1].hidden, true);
  assert.equal(empty.hidden, true);
  runtime.applyCharacterSearchFilter("");
  assert.equal(cards[0].hidden, false);
  assert.equal(cards[1].hidden, false);
  assert.equal(runtime.AS.characterQuery, "");
});

test("model state keeps profile, key, connection, and diagnostics separate", async () => {
  let renderCount = 0;
  const runtime = load("browser/controllers/settings-controller.js", {
    AS: {
      profileConfigured: true,
      hasApiKey: false,
      llmConnected: false,
      llmDiagnostics: null,
      health: { llmProfileConfigured: true, llmHasApiKey: false },
      config: { llmBaseUrl: "mock://local", llmModel: "mock-model" },
      workflowStatus: null,
      workflowTypes: []
    },
    U: { qs: () => null },
    CFG: { version: "test" },
    render: () => { renderCount += 1; },
    API: {
      health: async () => ({ llmProfileConfigured: true, llmHasApiKey: false, dataWritable: true }),
      workflowStatus: async () => null,
      workflowTypes: async () => ({ types: [] }),
      connections: async ({ action }) => action === "delete" ? { items: [] } : { items: [{ id: "local", baseUrl: "mock://local", model: "mock-model", active: true, hasApiKey: false }] }
    },
    setTimeout,
    console
  });

  const state = runtime.getModelConnectionUiState();
  assert.equal(state.id, "saved");
  assert.equal(state.profileConfigured, true);
  assert.equal(state.hasApiKey, false);
  assert.equal(state.connected, false);
  assert.equal(runtime.WorldTreeConnectionState.deriveLlmUiStatus({ llmProfileConfigured: true, llmHasApiKey: false }, {}, false).hasApiKey, false);

  runtime.AS.llmDiagnostics = { status: "partial" };
  assert.equal(runtime.getModelConnectionUiState().id, "partial");
  assert.equal(runtime.getModelConnectionUiState().connected, false);
  runtime.AS.llmDiagnostics = { status: "error" };
  assert.equal(runtime.getModelConnectionUiState().id, "failed");
  assert.equal(runtime.getModelConnectionUiState().connected, false);

  runtime.AS.llmConnected = true;
  assert.equal(runtime.getModelConnectionUiState().id, "connected");
  await runtime.updateHealth();
  assert.equal(runtime.AS.llmConnected, true, "basic health refresh must not erase a successful explicit test");

  runtime.AS.llmConnected = true;
  await runtime.connectionAction("set-default-connection", "local");
  assert.equal(runtime.AS.llmConnected, false, "switching default returns to waiting-to-test");
  runtime.AS.profileConfigured = true;
  runtime.AS.hasApiKey = true;
  await runtime.connectionAction("delete-connection", "local");
  assert.equal(runtime.getModelConnectionUiState().id, "unconfigured", "deleting the last profile resets state");
  assert.equal(runtime.AS.hasApiKey, false);
  assert.ok(renderCount >= 2, "state transitions and health changes refresh the UI");
});

test("release and CI gates include browser regressions and independent coverage", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  assert.match(packageJson.scripts["verify:release"], /verify:coverage/);
  assert.match(packageJson.scripts["verify:browser"], /smoke:v0\.5-interaction-regressions/);
  assert.match(ci, /browser-quality:/);
  assert.match(ci, /coverage:/);
  assert.match(ci, /node-version: 22\.x/);
  assert.match(ci, /npm run verify:coverage/);
});
