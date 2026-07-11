import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readJsonSync, writeJson } from "../../src/server/fs-utils.js";
import { createJsonFileTransaction } from "../../src/server/transactions/json-file-transaction.js";

async function withRoot(run) {
  const root = await mkdtemp(join(tmpdir(), "world-tree-transaction-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("multi-file transaction recovers a failure after the first target write", async () => {
  await withRoot(async (root) => {
    const first = join(root, "config.json");
    const second = join(root, "connections.json");
    const journal = join(root, ".transactions", "connection-state.json");
    await writeJson(first, { version: "old" });
    await writeJson(second, { version: "old" });

    const failing = createJsonFileTransaction({
      journalPath: journal,
      faultInjector(stage, { index }) {
        if (stage === "after-target-write" && index === 0) throw new Error("injected failure");
      }
    });
    await assert.rejects(() => failing.transact({ entries: [
      { path: first, data: { version: "new" } },
      { path: second, data: { version: "new" } }
    ] }), /injected failure/);
    assert.equal(existsSync(journal), true);
    assert.equal(readJsonSync(first, {}).version, "new");
    assert.equal(readJsonSync(second, {}).version, "old");

    const restarted = createJsonFileTransaction({ journalPath: journal });
    const recovery = await restarted.recover();
    assert.equal(recovery.recovered, true);
    assert.equal(typeof recovery.transactionId, "string");
    assert.equal(readJsonSync(first, {}).version, "new");
    assert.equal(readJsonSync(second, {}).version, "new");
    assert.equal(existsSync(journal), false);
  });
});

test("transaction builder serializes concurrent read-modify-write plans", async () => {
  await withRoot(async (root) => {
    const first = join(root, "config.json");
    const second = join(root, "connections.json");
    const tx = createJsonFileTransaction({ journalPath: join(root, ".transactions", "state.json") });
    await writeJson(first, { count: 0 });
    await writeJson(second, { count: 0 });

    await Promise.all(Array.from({ length: 50 }, () => tx.transact(() => {
      const next = readJsonSync(first, { count: 0 }).count + 1;
      return { entries: [
        { path: first, data: { count: next } },
        { path: second, data: { count: next } }
      ] };
    })));
    assert.equal(readJsonSync(first, {}).count, 50);
    assert.equal(readJsonSync(second, {}).count, 50);
  });
});

for (const failedIndex of [0, 1, 2]) {
  test(`three-file transaction recovers after injected failure at target ${failedIndex + 1}`, async () => {
    await withRoot(async (root) => {
      const targets = ["config.json", "secrets.json", "connections.json"].map((name) => join(root, name));
      const journal = join(root, ".transactions", "connection-state.json");
      await Promise.all(targets.map((path) => writeJson(path, { version: "old" })));
      const failing = createJsonFileTransaction({
        journalPath: journal,
        faultInjector(stage, { index }) {
          if (stage === "after-target-write" && index === failedIndex) throw new Error(`fail-${failedIndex}`);
        }
      });
      await assert.rejects(() => failing.transact({
        entries: targets.map((path) => ({ path, data: { version: "new" } }))
      }), new RegExp(`fail-${failedIndex}`));

      await createJsonFileTransaction({ journalPath: journal }).recover();
      assert.deepEqual(targets.map((path) => readJsonSync(path, {}).version), ["new", "new", "new"]);
      assert.equal(existsSync(journal), false);
    });
  });
}
