import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  prepareImportFiles,
  validateImportFileKey,
  validateImportContent
} from "../../src/server/data-import-service.js";

async function withTempRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-import-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("validateImportFileKey accepts simple relative json/jsonl keys", () => {
  assert.equal(validateImportFileKey("world.json"), "world.json");
  assert.equal(validateImportFileKey("shared/worldbook.json"), "shared/worldbook.json");
  assert.equal(validateImportFileKey("runtime/chat.jsonl"), "runtime/chat.jsonl");
  assert.equal(validateImportFileKey("shared\\worldbook.json"), "shared/worldbook.json");
});

test("validateImportFileKey rejects traversal and ambiguous path segments", () => {
  const badKeys = [
    "",
    ".",
    "./world.json",
    "../world.json",
    "%2e%2e/world.json",
    "%252e%252e/world.json",
    "shared/../world.json",
    "shared/./worldbook.json",
    "shared//worldbook.json",
    "/tmp/world.json",
    "C:/tmp/world.json",
    "C:\\tmp\\world.json",
    "C:tmp/world.json",
    "\\\\server\\share\\world.json",
    "world\0.json",
    "shared/worldbook.txt"
  ];

  for (const key of badKeys) {
    assert.throws(
      () => validateImportFileKey(key),
      /import file path|unsafe import file path|absolute import file path|unsupported import file extension/
    );
  }
});

test("prepareImportFiles rejects unsafe file keys before writing targets are prepared", async () => {
  await withTempRoot(async (root) => {
    assert.throws(() => prepareImportFiles(root, {
      "world.json": JSON.stringify({ name: "ok" }),
      "../evil.json": JSON.stringify({ name: "bad" })
    }), /unsafe import file path|absolute import file path/);
  });
});

test("validateImportContent rejects invalid json and jsonl with line number", () => {
  assert.throws(
    () => validateImportContent("world.json", "{ bad"),
    /invalid JSON/
  );

  assert.throws(
    () => validateImportContent("runtime/chat.jsonl", '{"ok":true}\n{ bad }\n'),
    /runtime\/chat\.jsonl:2: invalid JSONL line/
  );
});

test("prepareImportFiles accepts valid json/jsonl content", async () => {
  await withTempRoot(async (root) => {
    const prepared = prepareImportFiles(root, {
      "world.json": JSON.stringify({ name: "demo" }),
      "runtime/chat.jsonl": '{"role":"user","content":"hello"}\n'
    });

    assert.equal(prepared.length, 2);
    assert.equal(prepared[0].clean, "world.json");
    assert.equal(prepared[1].clean, "runtime/chat.jsonl");
  });
});
