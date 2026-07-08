import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const reportDir = resolve(process.env.WT_CI_REPORT_DIR || join(root, "docs", "reports"));
const repo = process.env.WT_GITHUB_REPO || "HatayaMisuzu/world-tree";
const sha = process.env.WT_GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

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
const report = {
  status: failed.length === 0 && checks.length > 0 ? "PASS" : "FAIL",
  repo,
  sha,
  combinedStatus: {
    state: combinedStatus.state,
    totalCount: combinedStatus.total_count,
    note: "GitHub Actions check runs may not publish legacy combined statuses."
  },
  checks,
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
