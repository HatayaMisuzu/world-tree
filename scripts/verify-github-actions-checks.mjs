import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateExactCiEvidence } from "./lib/ci-evidence-validation.mjs";

const root = resolve(".");
const reportDir = resolve(process.env.WT_CI_REPORT_DIR || join(root, "docs", "reports"));
const repo = process.env.WT_GITHUB_REPO || "HatayaMisuzu/world-tree";
const sha = process.env.WT_GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const testedSha = process.env.WT_GITHUB_TESTED_SHA || sha;
const testSubject = process.env.WT_GITHUB_TEST_SUBJECT || "COMMIT";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function ghJson(args) {
  return JSON.parse(gh(args));
}

mkdirSync(reportDir, { recursive: true });

const combinedStatus = ghJson(["api", `repos/${repo}/commits/${sha}/status`]);
const checkRuns = ghJson(["api", `repos/${repo}/commits/${sha}/check-runs`]);
const checks = (checkRuns.check_runs || []).map((run) => ({
  name: run.name,
  status: run.status,
  conclusion: run.conclusion,
  startedAt: run.started_at,
  completedAt: run.completed_at,
  url: run.html_url
}));
const failed = checks.filter((run) => run.status !== "completed" || run.conclusion !== "success");
const evidenceCheck = (checkRuns.check_runs || []).find((run) => run.name === "exact-sha-evidence" && run.status === "completed" && run.conclusion === "success");
let evidence = null;
let evidenceValidation = { ok: false, errors: ["exact-sha-evidence check is missing"] };
let artifactName = "";
let workflowRunId = "";
if (evidenceCheck) {
  workflowRunId = String(evidenceCheck.details_url || "").match(/\/actions\/runs\/(\d+)/)?.[1] || "";
  if (workflowRunId) {
    const artifacts = ghJson(["api", `repos/${repo}/actions/runs/${workflowRunId}/artifacts`]).artifacts || [];
    const expectedPrefix = `world-tree-ci-evidence-tested-${testedSha}`;
    const artifact = artifacts.find((item) => item.name === expectedPrefix || item.name.startsWith(`${expectedPrefix}-head-`));
    if (artifact) {
      artifactName = artifact.name;
      const dir = mkdtempSync(join(tmpdir(), "world-tree-ci-evidence-"));
      try {
        gh(["run", "download", workflowRunId, "--repo", repo, "--name", artifactName, "--dir", dir]);
        evidence = JSON.parse(readFileSync(join(dir, "ci-evidence.json"), "utf8"));
        evidenceValidation = validateExactCiEvidence(evidence, { testedSha, headSha: sha, testSubject });
      } catch (error) {
        evidenceValidation = { ok: false, errors: [error.message || String(error)] };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } else {
      evidenceValidation = { ok: false, errors: [`artifact ${expectedPrefix} not found in workflow run ${workflowRunId}`] };
    }
  }
}
const report = {
  status: failed.length === 0 && checks.length > 0 && evidenceValidation.ok ? "PASS" : "FAIL",
  repo,
  sha,
  combinedStatus: {
    state: combinedStatus.state,
    totalCount: combinedStatus.total_count,
    note: "GitHub Actions check runs may not publish legacy combined statuses."
  },
  checks,
  exactEvidence: { workflowRunId, artifactName, testedSha, testSubject, validation: evidenceValidation, evidence },
  generatedAt: new Date().toISOString()
};

writeFileSync(join(reportDir, "github-actions-checks-latest.json"), JSON.stringify(report, null, 2), "utf8");
writeFileSync(join(reportDir, "github-actions-checks-latest.md"), [
  "# GitHub Actions Checks Latest",
  "",
  `Generated: ${report.generatedAt}`,
  `Repo: ${report.repo}`,
  `SHA: ${report.sha}`,
  "",
  `Status: ${report.status}`,
  "",
  "## Combined Status API",
  "",
  `- state: ${report.combinedStatus.state}`,
  `- total_count: ${report.combinedStatus.totalCount}`,
  `- note: ${report.combinedStatus.note}`,
  "",
  "## Check Runs",
  "",
  "| Name | Status | Conclusion | Completed | URL |",
  "|---|---|---|---|---|",
  ...report.checks.map((run) => `| ${run.name} | ${run.status} | ${run.conclusion || ""} | ${run.completedAt || ""} | ${run.url || ""} |`)
].join("\n") + "\n", "utf8");

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
