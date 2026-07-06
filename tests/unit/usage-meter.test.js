import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { appendUsageRecord, readUsageSummary, summarizeUsageRecords } from "../../src/core/llm/usage-meter.js";

test("usage meter summarizes staged token usage and estimated cost", () => {
  const summary = summarizeUsageRecords([
    { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    { usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 } }
  ], { yuanPerMillionTokens: 100 });
  assert.equal(summary.promptTokens, 30);
  assert.equal(summary.completionTokens, 15);
  assert.equal(summary.totalTokens, 45);
  assert.equal(summary.estimatedCostCny, 0.0045);
});

test("usage meter appends and reads runtime usage jsonl", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wt-usage-"));
  try {
    const file = join(dir, "runtime", "usage.jsonl");
    await appendUsageRecord(file, { stages: [{ usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 } }] });
    await appendUsageRecord(file, { stages: [{ usage: { promptTokens: 4, completionTokens: 1, totalTokens: 5 } }] });
    const summary = await readUsageSummary(file);
    assert.equal(summary.turnCount, 2);
    assert.equal(summary.totalTokens, 10);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
