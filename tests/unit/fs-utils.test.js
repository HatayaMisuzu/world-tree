import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendJsonl,
  appendJsonlBatch,
  calcDirectorySizeLimited,
  ensureDir,
  readJson,
  readJsonSync,
  readJsonlTail,
  updateJson,
  writeJson
} from "../../src/server/fs-utils.js";

async function withTempRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-fs-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("fs utils read and write JSON with fallback behavior", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "nested", "data.json");
    await writeJson(file, { ok: true });

    assert.deepEqual(readJson(file, null), { ok: true });
    assert.deepEqual(readJsonSync(file, null), { ok: true });
    assert.deepEqual(readJson(join(root, "missing.json"), { fallback: true }), { fallback: true });
  });
});

test("readJsonlTail returns only the requested tail records", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "chat.jsonl");
    for (let i = 0; i < 500; i += 1) {
      await appendJsonl(file, { i });
    }

    const tail = await readJsonlTail(file, 80);
    assert.equal(tail.length, 80);
    assert.equal(tail[0].i, 420);
    assert.equal(tail.at(-1).i, 499);
  });
});

test("readJsonlTail skips a truncated or corrupt final record", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "truncated.jsonl");
    await writeFile(file, '{"turn":1}\n{"turn":2}\n{"turn":');
    assert.deepEqual(await readJsonlTail(file, 10), [{ turn: 1 }, { turn: 2 }]);
  });
});

test("calcDirectorySizeLimited reports truncation when entry budget is low", async () => {
  await withTempRoot(async (root) => {
    ensureDir(join(root, "many"));
    for (let i = 0; i < 20; i += 1) {
      await writeFile(join(root, "many", `${i}.txt`), "x");
    }

    const info = await calcDirectorySizeLimited(root, { maxEntries: 5, maxMs: 1000 });
    assert.equal(info.truncated, true);
    assert.ok(info.entries <= 5);

    const dirStat = await stat(join(root, "many"));
    assert.equal(dirStat.isDirectory(), true);
  });
});

test("writeJson serializes 200 concurrent writes without errors or tmp residue", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "data.json");
    await Promise.all(Array.from({ length: 200 }, (_, i) => writeJson(file, { ok: true, i })));
    const result = readJsonSync(file, null);
    assert.deepEqual(result, { ok: true, i: 199 });
    const { readdirSync } = await import("node:fs");
    const tmpFiles = readdirSync(root).filter(f => f.endsWith(".tmp"));
    assert.equal(tmpFiles.length, 0, `残留 tmp 文件: ${tmpFiles.join(", ")}`);
  });
});

test("updateJson locks the complete concurrent read-modify-write cycle", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "counter.json");
    await Promise.all(Array.from({ length: 250 }, () => updateJson(file, { count: 0 }, (current) => ({
      count: current.count + 1
    }))));
    assert.deepEqual(readJsonSync(file, null), { count: 250 });
  });
});

test("writeJson cleans its tmp file when rename fails", async () => {
  await withTempRoot(async (root) => {
    const directoryTarget = join(root, "cannot-replace-directory");
    await mkdir(directoryTarget);
    await assert.rejects(() => writeJson(directoryTarget, { ok: false }));
    const residue = (await readdir(root)).filter(name => name.endsWith(".tmp"));
    assert.deepEqual(residue, []);
  });
});

test("appendJsonl serializes concurrent writes and keeps every line parseable", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "concurrent.jsonl");
    await Promise.all(Array.from({ length: 300 }, (_, index) => appendJsonl(file, { index })));
    const records = await readJsonlTail(file, 500);
    assert.equal(records.length, 300);
    assert.deepEqual(records.map((record) => record.index), Array.from({ length: 300 }, (_, index) => index));
  });
});

test("appendJsonlBatch keeps related records adjacent under concurrency", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "batches.jsonl");
    await Promise.all(Array.from({ length: 100 }, (_, batch) => appendJsonlBatch(file, [
      { batch, sequence: 1 },
      { batch, sequence: 2 }
    ])));
    const records = await readJsonlTail(file, 500);
    assert.equal(records.length, 200);
    for (let index = 0; index < records.length; index += 2) {
      assert.equal(records[index].batch, records[index + 1].batch);
      assert.deepEqual([records[index].sequence, records[index + 1].sequence], [1, 2]);
    }
  });
});

test("appendJsonlBatch rolls back a failed write without leaving a partial line", async () => {
  await withTempRoot(async (root) => {
    const file = join(root, "rollback.jsonl");
    await appendJsonl(file, { stable: true });
    await assert.rejects(() => appendJsonlBatch(file, [{ unstable: 1 }, { unstable: 2 }], {
      faultInjector(stage) {
        if (stage === "after-write") throw new Error("injected append failure");
      }
    }), /injected append failure/);
    assert.deepEqual(await readJsonlTail(file, 10), [{ stable: true }]);
  });
});
