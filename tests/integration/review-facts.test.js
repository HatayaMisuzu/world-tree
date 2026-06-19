import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

test("review facts API adopts pending JSONL records with snapshot and log", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });

  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST",
      body: JSON.stringify({ name: "review_fact_world", displayName: "Review Fact World" })
    });
    assert.equal(create.body.status, "ok");

    const runtimeDir = join(dataDir, "engine", "worlds", "review_fact_world", "runtime");
    const item = {
      id: "review-fact-1",
      status: "pending",
      source: "test",
      targetType: "worldbook",
      operation: "upsert",
      confidence: 0.9,
      entity: "Mirror Gate",
      after: { title: "Mirror Gate", keys: ["Mirror Gate"], content: "A gate that opens only during rain." },
      sourceSnippet: "The Mirror Gate wakes in rain."
    };
    await appendFile(join(runtimeDir, "pending.jsonl"), `${JSON.stringify(item)}\n`, "utf-8");

    const list = await api(server, "/api/review/pending?moduleKey=review_fact_world");
    assert.equal(list.body.status, "ok");
    assert.equal(list.body.pending.length, 1);

    const adopt = await api(server, "/api/review/adopt", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "review_fact_world", id: "review-fact-1" })
    });
    assert.equal(adopt.body.status, "ok");
    assert.equal(adopt.body.apply.applied, true);

    const worldbook = JSON.parse(readFileSync(join(dataDir, "engine", "worlds", "review_fact_world", "shared", "worldbook.json"), "utf-8"));
    assert.equal(worldbook.entries[0].title, "Mirror Gate");
    assert.equal(existsSync(join(runtimeDir, "review-log.jsonl")), true);
    assert.match(readFileSync(join(runtimeDir, "review-log.jsonl"), "utf-8"), /review-fact-1/);
    assert.equal(existsSync(join(runtimeDir, "snapshots")), true);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
