import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(files) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  for (const file of files) vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("browser registry exposes exactly eight complete canonical entries", () => {
  const runtime = load(["browser/app/product-registry.js"]);
  assert.equal(runtime.WorldTreeProductRegistry.entries.length, 8);
  assert.equal(runtime.WorldTreeProductRegistry.assertComplete(), true);
  assert.deepEqual(Array.from(runtime.WorldTreeProductRegistry.entries, entry => entry.id), [
    "quick-setting", "character", "world-rpg", "tabletop", "mystery-puzzle", "strategy-sim", "murder-mystery", "creation-forge"
  ]);
});

test("browser store validates navigation and preserves project/model/save state", () => {
  const runtime = load(["browser/app/navigation.js", "browser/state/app-store.js"]);
  const store = runtime.WorldTreeAppStore.createStore();
  store.dispatch({ type: "navigation/view", view: "library" });
  store.dispatch({ type: "project/select", projectId: "world-a" });
  store.dispatch({ type: "model/status", status: "connected" });
  store.dispatch({ type: "save/status", status: "saved" });
  assert.equal(store.getState().view, "library");
  assert.equal(store.getState().activeProjectId, "world-a");
  assert.equal(store.getState().modelStatus, "connected");
  assert.equal(store.getState().saveStatus, "saved");
  store.dispatch({ type: "navigation/view", view: "not-a-view" });
  assert.equal(store.getState().view, "library");
});

test("browser feedback maps recoverable model/import/data errors to next steps", () => {
  const runtime = load(["browser/components/feedback.js"]);
  for (const code of ["LLM_NOT_CONFIGURED", "LLM_TIMEOUT", "LLM_ABORTED", "IMPORT_INVALID", "DATA_CORRUPT_RECOVERABLE", "DATA_CORRUPT_FATAL"]) {
    assert.ok(runtime.WorldTreeFeedback.messageFor(code).length > 12, code);
  }
  assert.equal(runtime.WorldTreeFeedback.toneFor("partial"), "warning");
});

test("console bootstrap and extracted modules stay below bounded line limits", () => {
  const mainLines = readFileSync("world-tree-console.js", "utf8").split(/\r?\n/).length;
  assert.ok(mainLines <= 600, `bootstrap is ${mainLines} lines`);
  for (const file of [
    "browser/components/product-components.js",
    "browser/views/core-views.js",
    "browser/views/creation-settings-views.js",
    "browser/views/product-ia-views.js",
    "browser/controllers/navigation-controller.js",
    "browser/controllers/entry-controller.js",
    "browser/controllers/play-controller.js",
    "browser/controllers/content-controller.js",
    "browser/controllers/settings-controller.js",
    "browser/controllers/character-v2-controller.js"
  ]) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
    assert.ok(lines <= 700, `${file} is ${lines} lines`);
  }
});
