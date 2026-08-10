import { appendFileSync, writeFileSync } from "node:fs";
import { buildCiEvidence, ciEvidenceArtifactName, readGithubEvent } from "./lib/ci-evidence.mjs";

const jobs = {
  check: process.env.CHECK_RESULT || "",
  browserQuality: process.env.BROWSER_RESULT || "",
  coverage: process.env.COVERAGE_RESULT || "",
  reliability: process.env.RELIABILITY_RESULT || "",
  windowsLauncher: process.env.WINDOWS_RESULT || ""
};
const commands = [
  "npm run check", "npm test", "npm run test:unit", "npm run test:integration",
  "npm run verify:coverage", "npm run test:reliability", "npm run soak:persistence-local",
  "npm run verify:browser", "./scripts/windows-launcher-smoke.ps1"
];
const event = readGithubEvent(process.env.GITHUB_EVENT_PATH);
const evidence = buildCiEvidence({ env: process.env, event, jobs, commands });
const artifactName = ciEvidenceArtifactName(evidence);

writeFileSync("ci-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifactName=${artifactName}\n`, "utf8");
console.log(JSON.stringify({ artifactName, evidence }, null, 2));
