import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { validateTruthDocuments } from "./lib/truth-status-model.mjs";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const activeFiles = [
  "README.md",
  "README.en.md",
  "docs/PREHUMAN_STABLE_BASELINE.md",
  "docs/PROJECT_TRUTH_SOURCE.md",
  "docs/CURRENT_PROJECT_STATE.md",
  "docs/RELEASE_READINESS.md",
  "docs/INDEX.md",
  "docs/STATUS_TERMINOLOGY.md",
  "docs/AGENT_STATUS_HANDOFF.md"
];

const errors = [];
const documents = {};
for (const file of activeFiles) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) errors.push(`missing active truth document: ${file}`);
  else documents[file] = readFileSync(absolute, "utf8");
}
errors.push(...validateTruthDocuments(documents, { version }).errors);

for (const file of ["docs/PROJECT_TRUTH_SOURCE.md", "docs/CURRENT_PROJECT_STATE.md", "docs/RELEASE_READINESS.md", "docs/INDEX.md"]) {
  const text = documents[file] || "";
  if (!/dynamic/i.test(text) || !/testedSha/.test(text)) errors.push(`${file}: exact-SHA evidence must be dynamic and keyed by testedSha`);
}

const historical = readFileSync(join(root, "docs/reports/productization-closure-report.md"), "utf8");
if (!/Status:\s*HISTORICAL/i.test(historical) || !/superseded by/i.test(historical)) errors.push("productization closure report must be historical and superseded");
if (pkg.scripts?.["truth:check"] !== "node scripts/check-truth-source-sync.mjs") errors.push("package truth:check script mismatch");
if (pkg.scripts?.["verify:prehuman"] !== "node scripts/verify-prehuman-baseline.mjs") errors.push("package verify:prehuman script missing");

if (errors.length) {
  console.error("truth-source sync check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`truth-source sync check passed for ${version}`);
