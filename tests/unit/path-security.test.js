import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  assertPathInsideRoot,
  decodeMaybeEncodedPath,
  isUnsafePathSegment,
  pathWithinRoot,
  resolveInsideRoot
} from "../../src/server/path-security.js";

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

test("resolveInsideRoot rejects an existing symlink or junction that escapes root", async (t) => {
  await withTempRoot(async (root) => {
    const outside = await mkdtemp(join(tmpdir(), "world-tree-path-outside-"));
    try {
      await writeFile(join(outside, "secret.json"), "{}");
      const link = join(root, "shared");
      try {
        await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
          t.skip(`symlink/junction unavailable: ${error.code}`);
          return;
        }
        throw error;
      }
      assert.equal(resolveInsideRoot(root, "shared/secret.json"), null);
      assert.equal(resolveInsideRoot(root, "shared/not-created.json"), null);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test("resolveInsideRoot allows normal paths and symlinks that remain inside root", async (t) => {
  await withTempRoot(async (root) => {
    await mkdir(join(root, "actual"));
    await writeFile(join(root, "actual", "safe.json"), "{}");
    assert.ok(resolveInsideRoot(root, "actual/new.json"));
    try {
      await symlink(join(root, "actual"), join(root, "shared"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
        t.skip(`symlink/junction unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.ok(resolveInsideRoot(root, "shared/safe.json"));
  });
});

// ── H2 (audit 2026-08-21): root directory may not exist yet ──

test("H2: import into a not-yet-created world root succeeds while traversal is still rejected", async () => {
  const { prepareImportFiles } = await import("../../src/server/data-import-service.js");
  const { realPathWithinRoot } = await import("../../src/server/path-security.js");
  await withTempRoot(async (base) => {
    const root = join(base, "worlds", "brand-new-world"); // does not exist
    const prepared = prepareImportFiles(root, { "world.json": "{}", "runtime/chat.jsonl": "{\"a\":1}\n" });
    assert.deepEqual(prepared.map((item) => relative(root, item.targetPath).replace(/\\/g, "/")), ["world.json", "runtime/chat.jsonl"]);
    assert.equal(resolveInsideRoot(root, "runtime/state.json"), join(root, "runtime", "state.json"));

    for (const bad of ["../escape.json", "../../worlds/other/world.json", "%2e%2e/escape.json", "a/../../escape.json", "/etc/passwd.json", "C:/x.json"]) {
      assert.throws(() => prepareImportFiles(root, { [bad]: "{}" }), (err) => err.code === "IMPORT_FILE_KEY_INVALID", bad);
      assert.equal(resolveInsideRoot(root, bad), null, bad);
    }
    // Direct realpath check must not admit siblings of a missing root via its existing ancestor.
    assert.equal(realPathWithinRoot(root, join(base, "worlds", "other", "world.json")), false);
    assert.equal(realPathWithinRoot(root, join(root, "world.json")), true);
  });
});

test("H2: missing root under a symlinked ancestor cannot reach outside through the symlink", async () => {
  await withTempRoot(async (base) => {
    const outside = join(base, "outside");
    await mkdir(outside, { recursive: true });
    const inside = join(base, "inside");
    await mkdir(inside, { recursive: true });
    await symlink(outside, join(inside, "link"), "dir");
    const root = join(inside, "new-world"); // missing
    assert.equal(resolveInsideRoot(root, "link/x.json"), join(root, "link", "x.json")); // lexical, under missing root: fine
    assert.equal(resolveInsideRoot(inside, "link/x.json"), null); // existing root, symlink escape rejected
  });
});
