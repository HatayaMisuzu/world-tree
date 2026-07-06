import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadClientCore() {
  const fetchCalls = [];
  const context = {
    window: {},
    document: {
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    fetch: async (url, opts = {}) => {
      fetchCalls.push({ url, opts });
      return {
        ok: true,
        json: async () => ({ status: "ok", url }),
        text: async () => ""
      };
    },
    Date,
    JSON,
    Number,
    String,
    Array,
    encodeURIComponent
  };
  vm.createContext(context);
  vm.runInContext(readFileSync("world-tree-client-core.js", "utf8"), context, {
    filename: "world-tree-client-core.js"
  });
  return { core: context.window.WorldTreeClientCore, fetchCalls };
}

test("client core exposes utility helpers and API wrapper", async () => {
  const { core, fetchCalls } = loadClientCore();
  assert.ok(core);
  assert.equal(core.U.esc("<x>"), "&lt;x&gt;");

  await core.API.get("/api/health");
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/api/health");
  assert.equal(fetchCalls[0].opts.method, "GET");
});

test("client core preserves major API method names", () => {
  const { core } = loadClientCore();
  for (const method of [
    "loadModules",
    "createModule",
    "loadExamples",
    "loadConfig",
    "saveConfig",
    "chatRetry",
    "alchemyPlan",
    "worldbookV2Load",
    "strategySimV2Start",
    "tabletopV2Start",
    "detectiveV2Start",
    "singlePlayerScriptKillV2Start"
  ]) {
    assert.equal(typeof core.API[method], "function", `${method} should exist`);
  }
});
