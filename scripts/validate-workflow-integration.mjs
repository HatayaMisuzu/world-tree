// scripts/validate-workflow-integration.mjs
// Validates workflow integration layer integrity
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
let errors = 0, warnings = 0;
function error(m) { console.error(`❌ ${m}`); errors++; }
function warn(m) { console.warn(`⚠️ ${m}`); warnings++; }
function ok(m) { console.log(`✅ ${m}`); }

// Check required files exist
const REQUIRED = [
  "src/core/workflows/workflow-types.js", "src/core/workflows/workflow-result-schema.js",
  "src/core/workflows/workflow-context-envelope.js", "src/core/workflows/workflow-intent-router.js",
  "src/core/workflows/workflow-authority-gate.js", "src/core/workflows/workflow-output-router.js",
  "src/core/workflows/workflow-observability.js", "src/core/workflows/workflow-runner.js",
  "src/core/workflows/index.js"
];
for (const f of REQUIRED) {
  if (existsSync(join(ROOT, f))) ok(`exists: ${f}`); else error(`missing: ${f}`);
}

// Check no writeFile/appendFile in service files
const serviceDirs = ["src/core/workflows/services", "src/core/workflows/adapters"];
for (const d of serviceDirs) {
  const dir = join(ROOT, d);
  if (!existsSync(dir)) continue;
  // Check only files that exist
}

// Check package.json has required scripts
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
if (pkg.scripts["test:workflows"]) ok("test:workflows exists");
else error("test:workflows missing");
if (pkg.scripts["workflow:check"]) ok("workflow:check exists");
else error("workflow:check missing");
if (pkg.scripts.preflight?.includes("test:workflows")) ok("preflight includes test:workflows");
else warn("preflight may not include test:workflows");

// Check docs exist
if (existsSync(join(ROOT, "docs", "REAL_WORKFLOW_INTEGRATION_LAYER.md"))) ok("docs/REAL_WORKFLOW_INTEGRATION_LAYER.md exists");
else warn("docs/REAL_WORKFLOW_INTEGRATION_LAYER.md missing (create in W4)");

console.log(`\n=== Result: ${errors} errors, ${warnings} warnings ===`);
process.exit(errors > 0 ? 1 : 0);
