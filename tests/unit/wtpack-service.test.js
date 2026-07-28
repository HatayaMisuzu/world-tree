import test from "node:test";
import assert from "node:assert/strict";

import { compareEngineVersions, createWtpack, validateWtpack } from "../../src/server/wtpack-service.js";

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

test("wtpack validation requires an exact normalized checksum key set", () => {
  const pack = createWtpack({
    manifest: { kind: "world", id: "demo", title: "Demo", author: "A", license: "MIT", minEngine: "0.4.2", contentRating: "teen" },
    files: { "world.json": { name: "demo" } }
  });
  assert.equal(validateWtpack({ ...pack, manifest: { ...pack.manifest, checksums: {} } }).code, "WTPACK_CHECKSUM_SET_MISMATCH");
  assert.equal(validateWtpack({ ...pack, files: { ...pack.files, "shared/extra.json": {} } }).code, "WTPACK_CHECKSUM_SET_MISMATCH");
  assert.equal(validateWtpack({ ...pack, manifest: { ...pack.manifest, checksums: { ...pack.manifest.checksums, "shared/extra.json": "0".repeat(64) } } }).code, "WTPACK_CHECKSUM_SET_MISMATCH");
  assert.equal(validateWtpack({ ...pack, manifest: { ...pack.manifest, checksums: { "world.json": "abc" } } }).code, "WTPACK_CHECKSUM_INVALID");
  assert.equal(validateWtpack({ ...pack, manifest: { ...pack.manifest, checksums: [] } }).code, "WTPACK_CHECKSUMS_INVALID");
});

test("wtpack validation rejects normalized key collisions", () => {
  const pack = createWtpack({
    manifest: { kind: "world", id: "demo", title: "Demo", author: "A", license: "MIT", minEngine: "0.4.2", contentRating: "teen" },
    files: { "world.json": { name: "demo" }, "shared/a.json": {} }
  });
  const collision = {
    ...pack,
    files: { ...pack.files, "shared\\a.json": {} }
  };
  assert.equal(validateWtpack(collision).code, "WTPACK_FILE_PATH_UNSAFE");
});

test("wtpack minEngine uses semantic version precedence including prereleases", () => {
  assert.equal(compareEngineVersions("0.5.0", "0.4.9").ok, true);
  assert.equal(compareEngineVersions("0.5.0", "0.5.0").ok, true);
  assert.equal(compareEngineVersions("0.4.9", "0.5.0").code, "WTPACK_ENGINE_TOO_OLD");
  assert.equal(compareEngineVersions("0.5.0-beta.2", "0.5.0-beta.1").ok, true);
  assert.equal(compareEngineVersions("0.5.0-beta.1", "0.5.0").code, "WTPACK_ENGINE_TOO_OLD");
  assert.equal(compareEngineVersions("not-a-version", "0.5.0").code, "WTPACK_ENGINE_VERSION_INVALID");
  assert.equal(compareEngineVersions("0.5.0", "latest").code, "WTPACK_ENGINE_VERSION_INVALID");
});

test("validateWtpack enforces the supplied current app version", () => {
  const pack = createWtpack({
    manifest: { kind: "world", id: "demo", title: "Demo", author: "A", license: "MIT", minEngine: "0.6.0", contentRating: "teen" },
    files: { "world.json": { name: "demo" } }
  });
  assert.equal(validateWtpack(pack, { appVersion: "0.5.0" }).code, "WTPACK_ENGINE_TOO_OLD");
  assert.equal(validateWtpack(pack, { appVersion: "0.6.0" }).ok, true);
  assert.equal(validateWtpack(pack, { appVersion: "0.7.0" }).ok, true);
});
