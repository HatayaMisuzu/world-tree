import test from "node:test";
import assert from "node:assert/strict";

import { createWtpack, validateWtpack } from "../../src/server/wtpack-service.js";

test("wtpack export builds manifest v1 checksums and strips runtime/private files", () => {
  const pack = createWtpack({
    appVersion: "0.4.2",
    manifest: {
      kind: "world",
      id: "demo",
      title: "Demo",
      author: "World Tree",
      license: "MIT",
      contentRating: "teen"
    },
    files: {
      "world.json": { name: "demo", displayName: "Demo" },
      "shared/worldbook.json": { entries: [] },
      "runtime/usage.jsonl": "secret usage",
      "userData/secrets.json": { key: "nope" }
    }
  });
  assert.equal(pack.format, "world-tree.wtpack");
  assert.equal(pack.manifest.specVersion, 1);
  assert.equal(pack.manifest.minEngine, "0.4.2");
  assert.equal(Boolean(pack.manifest.checksums["world.json"]), true);
  assert.equal("runtime/usage.jsonl" in pack.files, false);
  assert.equal("userData/secrets.json" in pack.files, false);
  assert.equal(validateWtpack(pack).ok, true);
});

test("wtpack import validation rejects traversal and checksum mismatch", () => {
  const pack = createWtpack({
    manifest: { kind: "world", id: "demo", title: "Demo", author: "A", license: "MIT", minEngine: "0.4.2", contentRating: "teen" },
    files: { "world.json": { name: "demo" } }
  });
  const badPath = { ...pack, files: { ...pack.files, "../evil.json": {} } };
  assert.equal(validateWtpack(badPath).code, "WTPACK_FILE_PATH_UNSAFE");
  const badChecksum = { ...pack, files: { "world.json": { name: "changed" } } };
  assert.equal(validateWtpack(badChecksum).code, "WTPACK_CHECKSUM_MISMATCH");
});
