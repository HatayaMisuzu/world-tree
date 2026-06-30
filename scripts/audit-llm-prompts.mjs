import { existsSync, readFileSync } from "node:fs";
import { auditLlmEntryPromptCoverage } from "../src/core/prompts/llm-entry-audit.js";

const requiredFiles = [
  "docs/reports/llm-prompt-inventory.md",
  "docs/reports/llm-prompt-audit-report.md",
  "src/core/prompts/prompt-safety-clauses.js",
  "tests/unit/llm-prompt-audit.test.js"
];

const failures = [];
for (const file of requiredFiles) if (!existsSync(file)) failures.push(`missing ${file}`);

const adapter = readFileSync("src/adapters/llm.js", "utf8");
for (const token of ["joinPromptSafetyClauses", "scrubPromptForPrivacy", "jsonOnly", "hiddenTruth", "proposalCanonBoundary", "productPublicView"]) {
  if (!adapter.includes(token)) failures.push(`llm adapter missing ${token}`);
}

const report = existsSync("docs/reports/llm-prompt-audit-report.md") ? readFileSync("docs/reports/llm-prompt-audit-report.md", "utf8") : "";
for (const token of ["JSON-only", "hidden truth", "Detective", "ScriptKill", "Strategy Sim", "Worldbook", "local paths", "canon", "OOC", "generic chat", "prompt injection", "full-function entry"]) {
  if (!new RegExp(token, "i").test(report)) failures.push(`prompt audit report missing ${token}`);
}

const entryAudit = auditLlmEntryPromptCoverage();
if (!entryAudit.ok) failures.push(...entryAudit.failures.map((failure) => `entry prompt audit: ${failure}`));

if (failures.length) {
  console.error("LLM prompt audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("LLM prompt audit: PASS");
