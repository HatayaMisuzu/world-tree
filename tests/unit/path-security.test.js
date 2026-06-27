import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  assertPathInsideRoot,
  decodeMaybeEncodedPath,
  isUnsafePathSegment,
  pathWithinRoot,
  resolveInsideRoot
} from "../../src/server/path-security.js";
import { pathWithinRoot as corePathWithinRoot } from "../../src/core/system/path-boundary.js";

async function withTempRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-path-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("decodeMaybeEncodedPath decodes traversal once or more without throwing on bad escapes", () => {
  assert.equal(decodeMaybeEncodedPath("%2e%2e/world.json"), "../world.json");
  assert.equal(decodeMaybeEncodedPath("%252e%252e/world.json"), "../world.json");
  assert.equal(decodeMaybeEncodedPath("%E0%A4%A"), "%E0%A4%A");
});

test("isUnsafePathSegment rejects empty, traversal, null byte, drive and overlong segments", () => {
  assert.equal(isUnsafePathSegment(""), true);
  assert.equal(isUnsafePathSegment("."), true);
  assert.equal(isUnsafePathSegment(".."), true);
  assert.equal(isUnsafePathSegment("bad\0name"), true);
  assert.equal(isUnsafePathSegment("C:"), true);
  assert.equal(isUnsafePathSegment("C:tmp"), true);
  assert.equal(isUnsafePathSegment("bad:name"), true);
  assert.equal(isUnsafePathSegment("a".repeat(256)), true);
  assert.equal(isUnsafePathSegment("worldbook.json"), false);
});

test("resolveInsideRoot accepts safe mixed separators and keeps targets inside root", async () => {
  await withTempRoot(async (root) => {
    const target = resolveInsideRoot(root, "shared\\worldbook.json");
    assert.ok(target);
    assert.equal(relative(root, target).replace(/\\/g, "/"), "shared/worldbook.json");
    assert.equal(pathWithinRoot(root, target), true);
  });
});

test("server pathWithinRoot re-exports the shared core path boundary helper", () => {
  assert.equal(pathWithinRoot, corePathWithinRoot);
});

test("resolveInsideRoot rejects unsafe path forms", async () => {
  await withTempRoot(async (root) => {
    const badPaths = [
      "",
      ".",
      "./world.json",
      "../world.json",
      "shared/../world.json",
      "shared//worldbook.json",
      "%2e%2e/world.json",
      "world\0.json",
      "/tmp/world.json",
      "C:/tmp/world.json",
      "C:\\tmp\\world.json",
      "C:tmp/world.json",
      "\\\\server\\share\\world.json",
      "//server/share/world.json",
      "a".repeat(4097)
    ];

    for (const value of badPaths) {
      assert.equal(resolveInsideRoot(root, value), null, value);
    }
  });
});

test("assertPathInsideRoot throws coded errors for unsafe input", async () => {
  await withTempRoot(async (root) => {
    assert.throws(
      () => assertPathInsideRoot(root, "../world.json", "import path"),
      (err) => err?.code === "PATH_UNSAFE" && err?.label === "import path"
    );
  });
});
