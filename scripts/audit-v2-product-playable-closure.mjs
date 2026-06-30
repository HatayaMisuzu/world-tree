import { existsSync, readFileSync } from "node:fs";

const failures = [];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = pkg.scripts || {};
for (const name of [
  "test:worldbook-v2-product",
  "test:strategy-sim-v2-product",
  "test:v2-product-playable",
  "test:llm-prompts",
  "audit:architecture-debt",
  "audit:v2-product-playable",
  "smoke:v2-product-playable-api",
  "smoke:v2-product-shell-browser"
]) {
  if (!scripts[name]) failures.push(`missing package script ${name}`);
}

for (const file of [
  "docs/reports/v2-product-playable-closure-report.md",
  "docs/reports/v2-product-playable-closure-matrix.md",
  "docs/reports/llm-prompt-inventory.md",
  "docs/reports/llm-prompt-audit-report.md",
  "docs/reports/architecture-debt-reduction-report.md"
]) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const joinedReports = [
  "docs/reports/v2-product-playable-closure-report.md",
  "docs/reports/v2-product-playable-closure-matrix.md",
  "docs/PROJECT_TRUTH_SOURCE.md",
  "docs/CURRENT_PROJECT_STATE.md",
  "README.md"
].filter(existsSync).map((file) => readFileSync(file, "utf8")).join("\n");

for (const entry of ["Worldbook V2", "Strategy Sim V2", "Tabletop", "Detective", "ScriptKill"]) {
  if (!joinedReports.includes(entry)) failures.push(`missing status row for ${entry}`);
}
const overclaimPatterns = [
  /^Productization Closure:\s*PASS\b/im,
  /^v1\.0\.0\s*(ready)?:\s*(YES|PASS|READY)\b/im,
  /^Full product-wide V2:\s*(COMPLETE|PASS)\b/im,
  /^Full product-wide playable closure:\s*(COMPLETE|PASS)\b/im
];
for (const pattern of overclaimPatterns) {
  if (pattern.test(joinedReports)) failures.push(`overclaim detected: ${pattern}`);
}
if (!/Bundled first-run content\s*(\||:)\s*DEFERRED/i.test(joinedReports)) failures.push("missing bundled first-run deferred status");
if (!joinedReports.includes("audit/v2-product-playable-closure-")) failures.push("missing smoke evidence path pattern");
if (!/Browser\/UI loop status/i.test(joinedReports)) failures.push("missing Browser/UI loop status boundary");
if (/\|\s*(?:SELECTED\s+)?(?:USER-PROVIDED\/STRUCTURAL\s+|USER-PROVIDED\s+\w+\s+|STRUCTURAL\s+)?PRODUCT LOOP PASS\b/i.test(joinedReports)) {
  failures.push("ambiguous PRODUCT LOOP PASS status detected");
}

if (failures.length) {
  console.error("V2 product playable closure audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("V2 product playable closure audit: PASS");
