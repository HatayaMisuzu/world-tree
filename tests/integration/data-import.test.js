import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareImportFiles, validateImportContent } from "../../src/server/data-import-service.js";

describe("data import service", () => {
  it("prepares valid json and jsonl files", async () => {
    const root = await mkdtemp(join(tmpdir(), "world-tree-import-"));
    try {
      const files = prepareImportFiles(root, {
        "world.json": JSON.stringify({ name: "demo" }),
        "runtime/chat.jsonl": `${JSON.stringify({ role: "user", content: "hi" })}\n`
      });
      assert.equal(files.length, 2);
      assert.ok(files.every((file) => file.targetPath.startsWith(root)));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects invalid json before write planning completes", async () => {
    const root = await mkdtemp(join(tmpdir(), "world-tree-import-"));
    try {
      assert.throws(
        () => prepareImportFiles(root, {
          "world.json": "{bad",
          "shared/worldbook.json": JSON.stringify({ entries: [] })
        }),
        /invalid JSON/
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports jsonl line number on invalid line", () => {
    assert.throws(
      () => validateImportContent("runtime/chat.jsonl", `${JSON.stringify({ ok: true })}\n{bad}`),
      /runtime\/chat\.jsonl:2/
    );
  });
});
