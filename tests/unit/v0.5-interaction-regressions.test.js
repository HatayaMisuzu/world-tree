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

test("model connection state distinguishes saved, connected, partial, and authoritative health", () => {
  const runtime = load("browser/controllers/settings-controller.js", {
    AS: { hasApiKey: true, llmConnected: false, llmDiagnostics: null, health: { llmConfigured: true } }
  });
  const saved = runtime.WorldTreeConnectionState.deriveLlmUiStatus({ llmConfigured: true }, {}, true);
  assert.equal(saved.connected, false);
  assert.equal(saved.llmConfigured, true);
  assert.equal(saved.authoritativeConnection, false);
  assert.equal(runtime.WorldTreeConnectionState.deriveLlmUiStatus({ llm: { configured: true, status: "connected" } }, {}, true).authoritativeConnection, true);
  assert.equal(runtime.getModelConnectionUiState().id, "saved");
  runtime.AS.llmDiagnostics = { status: "partial" };
  assert.equal(runtime.getModelConnectionUiState().id, "partial");
  runtime.AS.llmDiagnostics = { status: "error" };
  assert.equal(runtime.getModelConnectionUiState().id, "failed");
  runtime.AS.llmConnected = true;
  assert.equal(runtime.getModelConnectionUiState().id, "connected");
});

test("release scripts expose the interaction regression gate", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(packageJson.scripts["verify:release"], /verify:coverage/);
  assert.match(packageJson.scripts["verify:browser"], /smoke:v0\.5-interaction-regressions/);
  assert.match(readFileSync(".github/workflows/ci.yml", "utf8"), /browser-quality:/);
});
