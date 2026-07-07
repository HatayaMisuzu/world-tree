import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.WT_NARRATIVE_EVAL_DRY_RUN !== "0";
const reportDir = resolve(process.env.WT_NARRATIVE_EVAL_REPORT_DIR || join(root, "docs", "reports"));
const scenariosPath = resolve(process.env.WT_NARRATIVE_EVAL_SCENARIOS || join(root, "tests", "fixtures", "narrative-eval", "scenarios.json"));
const rubricPath = resolve(process.env.WT_NARRATIVE_EVAL_RUBRIC || join(root, "tests", "fixtures", "narrative-eval", "rubric.json"));
const recordingPath = resolve(process.env.WT_NARRATIVE_EVAL_RECORDING || join(root, "tests", "fixtures", "llm-recordings", "narrative-eval-mock.json"));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function renderTemplate(template, scenario) {
  return String(template || "")
    .replaceAll("{{id}}", scenario.id)
    .replaceAll("{{title}}", scenario.title)
    .replaceAll("{{entry}}", scenario.entry)
    .replaceAll("{{anchors}}", (scenario.anchors || []).join(", "));
}

function scoreScenario({ scenario, response, rubric }) {
  const text = String(response || "");
  const forbidden = (rubric.forbiddenPatterns || []).find(pattern => new RegExp(pattern, "i").test(text));
  const anchors = scenario.anchors || [];
  const matchedAnchors = anchors.filter(anchor => new RegExp(anchor, "i").test(text));
  const checks = [
    { id: "minimum_length", ok: text.length >= Number(rubric.minimumChars || 120), detail: `${text.length} chars` },
    { id: "anchor_recall", ok: matchedAnchors.length >= Math.min(1, anchors.length), detail: matchedAnchors.join(", ") || "none" },
    { id: "hidden_truth_safety", ok: !forbidden, detail: forbidden || "clean" },
    { id: "player_agency", ok: /choice|选择|options?|next/i.test(text), detail: "choice affordance present" }
  ];
  return {
    id: scenario.id,
    entry: scenario.entry,
    title: scenario.title,
    score: checks.filter(check => check.ok).length,
    maxScore: checks.length,
    checks
  };
}

await mkdir(reportDir, { recursive: true });

const scenarios = readJson(scenariosPath);
const rubric = readJson(rubricPath);
const recording = existsSync(recordingPath) ? readJson(recordingPath) : {};

const scenarioCountOk = Array.isArray(scenarios) && scenarios.length >= Number(rubric.minimumScenarioCount || 20);
const responses = recording.responses || {};
const defaultResponse = recording.defaultResponse || "";
const results = (scenarios || []).map(scenario => {
  const response = renderTemplate(responses[scenario.id] || defaultResponse, scenario);
  return scoreScenario({ scenario, response, rubric });
});
const failed = results.filter(result => result.checks.some(check => !check.ok));
const status = scenarioCountOk && !failed.length ? (dryRun ? "DRY_RUN_PASS" : "PASS") : "FAIL";
const report = {
  status,
  dryRun,
  scenarioCount: scenarios.length,
  requiredScenarioCount: rubric.minimumScenarioCount || 20,
  recording: {
    path: recordingPath,
    provider: recording.provider || "mock",
    realLlmEvidence: false
  },
  note: dryRun
    ? "Mock playback validates the Tier-2 harness and rubric shape only; it is not real LLM quality evidence."
    : "Non-dry-run evaluation still requires reviewer interpretation before any PLAYABLE claim.",
  results,
  generatedAt: new Date().toISOString()
};

writeFileSync(join(reportDir, "narrative-eval-latest.json"), JSON.stringify(report, null, 2), "utf8");
writeFileSync(join(reportDir, "narrative-eval-latest.md"), [
  "# Narrative Eval Report",
  "",
  `Status: ${report.status}`,
  `Generated: ${report.generatedAt}`,
  `Scenarios: ${report.scenarioCount}`,
  `Recording provider: ${report.recording.provider}`,
  "",
  "This report is deterministic mock playback unless real LLM evidence is attached separately.",
  "",
  ...results.map(item => `- ${item.id} (${item.entry}): ${item.score}/${item.maxScore}`)
].join("\n") + "\n", "utf8");

console.log(JSON.stringify(report, null, 2));
if (status === "FAIL") process.exitCode = 1;
