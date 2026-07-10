import test from "node:test";
import assert from "node:assert/strict";

import {
  findSecrets,
  forbiddenTrackedPath,
  normalizeTrackedPath
} from "../../scripts/lib/safe-snapshot.mjs";

test("safe snapshot normalizes Windows paths and blocks local data", () => {
  assert.equal(normalizeTrackedPath("userData\\secrets.json"), "userData/secrets.json");
  for (const path of ["userData/config.json", "node_modules/a.js", ".playwright-cli/state.json", "coverage/raw.json", "logs/app.log", "secrets.json"]) {
    assert.ok(forbiddenTrackedPath(path), path);
  }
  assert.equal(forbiddenTrackedPath("src/core/world-engine.js"), "");
});

test("safe snapshot detects likely credentials without flagging placeholders", () => {
  assert.deepEqual(findSecrets("apiKey: example-key"), []);
  assert.deepEqual(findSecrets("apiKey: prefix-super-secret-tail"), []);
  assert.deepEqual(findSecrets("sk-1234567890abcdefghijkl"), []);
  assert.ok(findSecrets("api_key = '" + "z9Y8x7W6v5U4t3S2r1Q0p9O8n7M6" + "'").includes("generic_secret"));
  assert.ok(findSecrets("sk-" + "z9Y8x7W6v5U4t3S2r1Q0p9O8n7M6").includes("openai_key"));
  assert.ok(findSecrets("-----BEGIN " + "PRIVATE KEY-----").includes("private_key"));
});
