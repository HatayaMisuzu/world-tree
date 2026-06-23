#!/usr/bin/env node
// check-legacy-status.mjs — 验证 legacy 文档和状态表存在且正确

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, "..");

let failures = 0;

function check(name, path, predicate, message) {
  const full = resolve(BASE, path);
  const ok = predicate(full);
  if (!ok) { failures++; console.error(`FAIL: ${name} (${path}) — ${message}`); }
  else console.log(`OK: ${name}`);
}

// Core legacy docs
check("Legacy audit exists", "docs/LEGACY_REDUNDANCY_AUDIT.md", p => existsSync(p), "missing");
check("Legacy upgrade plan exists", "docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md", p => existsSync(p), "missing");

// DOCUMENTATION_STATUS must mention legacy classifications
try {
  const statusDoc = readFileSync(resolve(BASE, "docs/DOCUMENTATION_STATUS.md"), "utf-8");
  check("DOCUMENTATION_STATUS has legacy section",
    "docs/DOCUMENTATION_STATUS.md",
    () => statusDoc.includes("active-compatibility") || statusDoc.includes("legacy-bridge"),
    "DOCUMENTATION_STATUS should include legacy status entries");
  check("DOCUMENTATION_STATUS has status enum",
    "docs/DOCUMENTATION_STATUS.md",
    () => statusDoc.includes("active-compatibility") && statusDoc.includes("archived-design") && statusDoc.includes("orphan-candidate"),
    "DOCUMENTATION_STATUS should define legacy status enum");
} catch (err) {
  failures++;
  console.error(`FAIL: DOCUMENTATION_STATUS read — ${err.message}`);
}

// AI-GUIDE must mention legacy handling
try {
  const aiGuide = readFileSync(resolve(BASE, "AI-GUIDE.md"), "utf-8");
  check("AI-GUIDE has legacy rules",
    "AI-GUIDE.md",
    () => aiGuide.includes("Legacy 文件处理规则") || aiGuide.includes("legacy 文件"),
    "AI-GUIDE should include legacy file handling rules");
} catch (err) {
  failures++;
  console.error(`FAIL: AI-GUIDE read — ${err.message}`);
}

// docs/INDEX must link legacy docs
try {
  const index = readFileSync(resolve(BASE, "docs/INDEX.md"), "utf-8");
  check("docs/INDEX links legacy audit",
    "docs/INDEX.md",
    () => index.includes("LEGACY_REDUNDANCY_AUDIT.md"),
    "docs/INDEX should link LEGACY_REDUNDANCY_AUDIT.md");
} catch (err) {
  failures++;
  console.error(`FAIL: docs/INDEX read — ${err.message}`);
}

// Engine bridge files must have compatibility comment
const bridgeFiles = [
  "src/core/engine/rpg.js",
  "src/core/engine/tabletop.js",
  "src/core/engine/sim.js",
  "src/core/engine/murder-mystery.js"
];
for (const f of bridgeFiles) {
  const full = resolve(BASE, f);
  if (!existsSync(full)) {
    failures++;
    console.error(`FAIL: bridge file missing — ${f}`);
    continue;
  }
  try {
    const content = readFileSync(full, "utf-8");
    check(`Bridge comment: ${f}`, f,
      () => content.includes("Legacy compatibility bridge") || content.includes("active-compatibility"),
      "bridge file should have compatibility header comment");
  } catch (err) {
    failures++;
    console.error(`FAIL: ${f} read — ${err.message}`);
  }
}

console.log(`\n${failures ? failures + " checks failed" : "All checks passed"}`);
process.exit(failures ? 1 : 0);
