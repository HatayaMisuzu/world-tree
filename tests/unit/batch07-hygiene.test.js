import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createRouteRegistry } from "../../src/server/routes/registry.js";

test("SECURITY policy documents local plaintext secret storage and OS permission hardening", () => {
  const text = readFileSync("SECURITY.md", "utf8");
  assert.match(text, /userData\/secrets\.json/);
  assert.match(text, /plaintext/i);
  assert.match(text, /icacls/);
  assert.match(text, /chmod 600|0o600/);
  assert.match(text, /Do not sync|不要同步|请勿同步/i);
});

test("ui-labels exposes public-facing terminology replacements", async () => {
  delete globalThis.WT_UI_LABELS;
  await import("../../ui-labels.js");
  assert.equal(globalThis.WT_UI_LABELS.label("experimental"), "抢先体验");
  assert.equal(globalThis.WT_UI_LABELS.label("thinSlice"), "基础版");
  assert.equal(globalThis.WT_UI_LABELS.label("missing", "fallback"), "fallback");
});

test("release manifest and verifier keep ui-labels in the package", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const releaseVerify = readFileSync("scripts/release-verify.mjs", "utf8");
  const startSh = readFileSync("start.sh", "utf8");

  assert.ok(pkg.files.includes("ui-labels.js"));
  assert.match(releaseVerify, /ui-labels\.js missing from npm pack/);
  assert.match(startSh, /package\.json/);
  assert.doesNotMatch(startSh, /v2\.3\.1/);
});

test("route registry rejects duplicate routes and resolves method/path handlers", () => {
  const handler = () => ({ status: "ok" });
  const registry = createRouteRegistry([{ method: "get", path: "/api/demo", domain: "misc", handler }]);
  assert.equal(registry.resolve("GET", "/api/demo").handler, handler);
  assert.deepEqual(registry.list(), [{ method: "GET", path: "/api/demo", domain: "misc" }]);
  assert.throws(() => registry.register({ method: "GET", path: "/api/demo", handler }), /duplicate route/);
});
