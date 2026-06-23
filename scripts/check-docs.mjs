#!/usr/bin/env node
// docs:check — 文档完整性检查

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, "..");

const checks = [];
let failures = 0;

function check(name, path, predicate, message) {
  const full = resolve(BASE, path);
  const ok = predicate(full);
  checks.push({ name, path, ok, message });
  if (!ok) { failures++; console.error(`FAIL: ${name} (${path}) — ${message}`); }
  else console.log(`OK: ${name}`);
}

// Core docs
check("README", "README.md", p => existsSync(p), "missing");
check("CHANGELOG", "CHANGELOG.md", p => existsSync(p), "missing");
check("AI-GUIDE", "AI-GUIDE.md", p => existsSync(p), "missing");
check("docs/INDEX", "docs/INDEX.md", p => existsSync(p), "missing");
check("docs/PROJECT_OVERVIEW", "docs/PROJECT_OVERVIEW.md", p => existsSync(p), "missing");
check("docs/FEATURES", "docs/FEATURES.md", p => existsSync(p), "missing");
check("docs/ARCHITECTURE_V1", "docs/ARCHITECTURE_V1.md", p => existsSync(p), "missing");
check("docs/API_REFERENCE", "docs/API_REFERENCE.md", p => existsSync(p), "missing");
check("docs/SAVE_SYSTEM", "docs/SAVE_SYSTEM_AND_WORLD_PACK.md", p => existsSync(p), "missing");
check("docs/PROPOSAL", "docs/PROPOSAL_AND_REVIEW_SYSTEM.md", p => existsSync(p), "missing");
check("docs/SCRIPTS", "docs/SCRIPTS_AND_CHECKS.md", p => existsSync(p), "missing");
check("docs/AI_AGENT_GUIDE", "docs/AI_AGENT_OPERATING_GUIDE.md", p => existsSync(p), "missing");
check("docs/STATUS", "docs/DOCUMENTATION_STATUS.md", p => existsSync(p), "missing");

// Content checks
try {
  const readme = readFileSync(resolve(BASE, "README.md"), "utf-8");
  check("README mentions V1", "README.md", () => readme.includes("V1 完整闭环"), "README should mention V1 milestone");
  check("README mode table", "README.md", () => readme.includes("quick-setting") && readme.includes("creation-forge"), "README should list all modes");
} catch {}

try {
  const changelog = readFileSync(resolve(BASE, "CHANGELOG.md"), "utf-8");
  check("CHANGELOG no ignored AI", "CHANGELOG.md", () => !changelog.includes("AI 无需阅读") && !changelog.includes("AI无需阅读"), "CHANGELOG should not say AI should ignore it");
} catch {}

try {
  const aiguide = readFileSync(resolve(BASE, "AI-GUIDE.md"), "utf-8");
  check("AI-GUIDE updated", "AI-GUIDE.md", () => aiguide.includes("full-closure") || aiguide.includes("V1 完整闭环"), "AI-GUIDE should reflect V1 milestone");
} catch {}

console.log(`\n${checks.length} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
