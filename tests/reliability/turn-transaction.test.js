import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendJsonlBatch, readJsonSync, writeJson } from "../../src/server/fs-utils.js";
import { createTurnTransaction, recoverTurnTransactionsUnderRoot } from "../../src/server/transactions/turn-transaction.js";

async function withTempRoot(fn) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-turn-tx-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readJsonl(path) {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function crashAt(target) {
  return async (stage) => {
    if (stage !== target) return;
    const error = new Error(`simulated crash at ${stage}`);
    error.simulateCrash = true;
    throw error;
  };
}

function paths(root) {
  return {
    journal: join(root, "runtime", "transactions", "turn.json"),
    state: join(root, "runtime", "state.json"),
    chat: join(root, "runtime", "chat.jsonl"),
    memory: join(root, "runtime", "memory.jsonl"),
    world: join(root, "world.json"),
    frame: join(root, "runtime", "status", "turn-frames", "turn-1.json")
  };
}

async function seed(root) {
  const file = paths(root);
  await writeJson(file.state, { turnCount: 0 });
  await appendJsonlBatch(file.chat, [{ id: "seed" }]);
  await writeJson(file.world, { turnCount: 0 });
  return file;
}

function operations(file) {
  return [
    { type: "json", path: file.state, data: { turnCount: 1 }, label: "state" },
    { type: "jsonl", path: file.chat, records: [{ id: "user-1" }, { id: "assistant-1" }], label: "chat" },
    { type: "jsonl", path: file.memory, records: [{ id: "memory-1" }], label: "memory" },
    { type: "json", path: file.world, data: { turnCount: 1 }, label: "world-metadata" },
    { type: "json", path: file.frame, data: { turnId: "turn-1" }, label: "turn-frame" }
  ];
}

for (const stage of ["after-journal", "after-state", "after-chat", "after-world-metadata"]) {
  test(`turn transaction recovery rolls back an interrupted core turn at ${stage}`, async () => {
    await withTempRoot(async (root) => {
      const file = await seed(root);
      const transaction = createTurnTransaction({ journalPath: file.journal, faultInjector: crashAt(stage) });
      await assert.rejects(() => transaction.transact({ id: `tx-${stage}`, operations: operations(file) }), /simulated crash/);
      assert.equal(existsSync(file.journal), true);

      const recovery = await createTurnTransaction({ journalPath: file.journal }).recover();
      assert.equal(recovery.action, "rollback");
      assert.deepEqual(readJsonSync(file.state, null), { turnCount: 0 });
      assert.deepEqual(await readJsonl(file.chat), [{ id: "seed" }]);
      assert.deepEqual(readJsonSync(file.world, null), { turnCount: 0 });
      assert.equal(existsSync(file.memory), false);
      assert.equal(existsSync(file.frame), false);
      assert.deepEqual(await createTurnTransaction({ journalPath: file.journal }).recover(), { recovered: false });
    });
  });
}

test("turn transaction recovery only cleans a committed journal and never duplicates append records", async () => {
  await withTempRoot(async (root) => {
    const file = await seed(root);
    const transaction = createTurnTransaction({ journalPath: file.journal, faultInjector: crashAt("after-commit-marker") });
    await assert.rejects(() => transaction.transact({ id: "tx-committed", operations: operations(file) }), /simulated crash/);

    const recovery = await createTurnTransaction({ journalPath: file.journal }).recover();
    assert.equal(recovery.action, "cleanup");
    assert.deepEqual(readJsonSync(file.state, null), { turnCount: 1 });
    assert.deepEqual((await readJsonl(file.chat)).map((record) => record.id), ["seed", "user-1", "assistant-1"]);
    assert.deepEqual(await readJsonl(file.memory), [{ id: "memory-1" }]);
    assert.deepEqual(readJsonSync(file.world, null), { turnCount: 1 });
    assert.deepEqual(readJsonSync(file.frame, null), { turnId: "turn-1" });
    assert.deepEqual(await createTurnTransaction({ journalPath: file.journal }).recover(), { recovered: false });
  });
});

test("independent world transaction journals can commit in parallel", async () => {
  await withTempRoot(async (root) => {
    const roots = [join(root, "world-a"), join(root, "world-b")];
    const files = await Promise.all(roots.map(seed));
    await Promise.all(files.map((file, index) => createTurnTransaction({ journalPath: file.journal }).transact({
      id: `parallel-${index}`,
      operations: operations(file)
    })));
    for (const file of files) {
      assert.deepEqual(readJsonSync(file.state, null), { turnCount: 1 });
      assert.deepEqual((await readJsonl(file.chat)).map((record) => record.id), ["seed", "user-1", "assistant-1"]);
    }
  });
});

test("startup recovery scan finds and rolls back world journals", async () => {
  await withTempRoot(async (root) => {
    const worldRoot = join(root, "engine", "worlds", "demo");
    const file = await seed(worldRoot);
    const transaction = createTurnTransaction({ journalPath: file.journal, faultInjector: crashAt("after-chat") });
    await assert.rejects(() => transaction.transact({ id: "startup-recovery", operations: operations(file) }), /simulated crash/);

    const scan = await recoverTurnTransactionsUnderRoot(join(root, "engine"));
    assert.equal(scan.recoveries.length, 1);
    assert.equal(scan.recoveries[0].action, "rollback");
    assert.deepEqual(readJsonSync(file.state, null), { turnCount: 0 });
    assert.deepEqual(await readJsonl(file.chat), [{ id: "seed" }]);
  });
});
