import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { readServerSource } from "../../scripts/lib/server-source.mjs";

test("Claude presets keep OpenRouter compatibility and expose native Anthropic adapter", () => {
  const server = readServerSource();
  assert.match(server, /claude-openrouter/);
  assert.match(server, /https:\/\/openrouter\.ai\/api\/v1/);
  assert.match(server, /anthropic\/claude-sonnet-4\.5/);
  assert.match(server, /https:\/\/api\.anthropic\.com\/v1/);
  assert.match(server, /provider: "anthropic"/);
});

test("release hygiene scripts and line ending policy are registered", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["release:verify"], "node scripts/release-verify.mjs");
  assert.equal(existsSync("scripts/release-verify.mjs"), true);
  assert.match(readFileSync(".gitattributes", "utf8"), /\*\.js text eol=lf/);
});

test("start.bat reads package version instead of hardcoding stale v2 version", () => {
  const start = readFileSync("start.bat", "utf8");
  assert.match(start, /package\.json/);
  assert.doesNotMatch(start, /v2\.3\.1/);
});

test("Hermes dead config is removed from active server diagnostics", () => {
  const server = readServerSource();
  const diagnostics = readFileSync("src/core/diagnostics.js", "utf8");
  assert.doesNotMatch(server, /hermesBaseUrl/);
  assert.doesNotMatch(diagnostics, /hermes-config|hermesBaseUrl/);
});
