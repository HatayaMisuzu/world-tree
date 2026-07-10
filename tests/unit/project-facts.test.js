import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAYABLE_STATUS,
  parsePackJson,
  parseTapTestCount,
  validateProjectFacts
} from "../../scripts/lib/project-facts.mjs";

test("project facts parse final TAP count and npm pack metadata", () => {
  assert.equal(parseTapTestCount("# tests 12\n# pass 12\n"), 12);
  assert.deepEqual(parsePackJson(JSON.stringify([{ size: 10, unpackedSize: 20, files: [{ path: "a" }, { path: "b" }] }])), {
    packageFiles: 2,
    packageBytes: 20,
    packedBytes: 10
  });
});

test("project facts reject stale head, counts, package metadata, and playable claims", () => {
  const valid = {
    schemaVersion: 1,
    version: "0.5.0-product-experience-rebuild.1",
    head: "a".repeat(40),
    generatedAt: new Date().toISOString(),
    unitTests: 1,
    integrationTests: 1,
    packageFiles: 1,
    packageBytes: 1,
    packedBytes: 1,
    canonicalEntries: 8,
    playableStatus: PLAYABLE_STATUS
  };
  assert.deepEqual(validateProjectFacts(valid, { head: valid.head }), []);
  assert.match(validateProjectFacts({ ...valid, head: "stale", unitTests: 0, packageFiles: 0, playableStatus: "PASS" }).join("\n"), /head|unitTests|packageFiles|playableStatus/);
});
