import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

function runNode(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: ".",
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result;
}

test("narrative eval dry run covers 20 scenarios with mock playback", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "wt-narrative-eval-"));
  try {
    runNode(["scripts/narrative-eval.mjs", "--dry-run"], { WT_NARRATIVE_EVAL_REPORT_DIR: reportDir });
    const report = JSON.parse(await readFile(join(reportDir, "narrative-eval-latest.json"), "utf8"));
    assert.equal(report.status, "DRY_RUN_PASS");
    assert.equal(report.scenarioCount, 20);
    assert.equal(report.recording.provider, "mock");
    assert.equal(report.recording.realLlmEvidence, false);
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("self-report emits anonymized counts without prompt text", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "wt-self-report-data-"));
  const reportDir = await mkdtemp(join(tmpdir(), "wt-self-report-out-"));
  try {
    const runtime = join(dataDir, "engine", "worlds", "world-a", "runtime");
    await mkdir(runtime, { recursive: true });
    await writeFile(join(runtime, "chat.jsonl"), [
      JSON.stringify({ role: "user", content: "secret player text" }),
      JSON.stringify({ role: "assistant", content: "secret assistant text" })
    ].join("\n") + "\n", "utf8");
    await writeFile(join(runtime, "usage.jsonl"), JSON.stringify({
      provider: "mock",
      model: "mock-model",
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 }
    }) + "\n", "utf8");
    runNode(["scripts/self-report.mjs"], { WT_SELF_REPORT_DATA_DIR: dataDir, WT_SELF_REPORT_DIR: reportDir });
    const text = await readFile(join(reportDir, "self-report-latest.json"), "utf8");
    const report = JSON.parse(text);
    assert.equal(report.status, "PASS");
    assert.equal(report.anonymized, true);
    assert.equal(report.chat.records, 2);
    assert.equal(report.usage.totalTokens, 25);
    assert.equal(text.includes("secret player text"), false);
    assert.equal(text.includes("secret assistant text"), false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("governance docs encode PLAYABLE human signoff and release gates", () => {
  const terminology = readFileSync("docs/STATUS_TERMINOLOGY.md", "utf8");
  const release = readFileSync("docs/RELEASE_READINESS.md", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const workflow = readFileSync(".github/workflows/first-play-smoke.yml", "utf8");
  assert.match(terminology, /HUMAN_SIGNED/);
  assert.match(terminology, /Tier-1 real LLM smoke PASS/);
  assert.match(release, /screen recording/i);
  assert.match(release, /npm pack/i);
  assert.match(release, /human playtest/i);
  assert.match(readme, /60 秒上手/);
  assert.match(readme, /PROJECT_TRUTH_SOURCE/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /matrix:/);
  assert.match(workflow, /WT_SMOKE_PROVIDER_ID/);
});
