#!/usr/bin/env node
// World Tree Complete Project Audit
// Checks V2 entry closure, docs truth sources, AI guide, asset inventory, route inventory, and preflight gate.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf-8") : "";
const json = (p) => {
  try { return JSON.parse(read(p) || "{}"); } catch { return {}; }
};

const pkg = json("package.json");
const server = read("server.js");
const ui = read("world-tree-console.js");
const readme = read("README.md");
const changelog = read("CHANGELOG.md");
const aiGuide = read("AI-GUIDE.md");
const currentState = read("docs/CURRENT_PROJECT_STATE.md");
const docsIndex = read("docs/INDEX.md");
const features = read("docs/FEATURES.md");
const scriptsDoc = read("docs/SCRIPTS_AND_CHECKS.md");
const apiInventory = read("docs/API_ROUTE_INVENTORY.md");
const assetInventory = read("docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md");
const assetMatrix = read("docs/ASSET_STATUS_MATRIX.md");
const v2Status = read("docs/V2_ENTRY_COMPLETION_STATUS.md");

let pass = 0;
let fail = 0;
const failures = [];
function check(label, ok) {
  if (ok) pass++;
  else { fail++; failures.push(label); console.error(`FAIL: ${label}`); }
}
function includesAll(text, terms) { return terms.every(t => text.includes(t)); }
function excludesAll(text, terms) { return terms.every(t => !text.includes(t)); }

console.log("\n=== World Tree Complete Project Audit ===");

// 1. Canonical scripts
const scripts = pkg.scripts || {};
check("script test:tabletop-v2-full exists", !!scripts["test:tabletop-v2-full"]);
check("script test:detective-v2-full exists", !!scripts["test:detective-v2-full"]);
check("script test:character-v2-long-term exists", !!scripts["test:character-v2-long-term"]);
check("script test:single-player-scriptkill-v2 exists", !!scripts["test:single-player-scriptkill-v2"]);
check("script test:single-player-scriptkill-v2-audit exists", !!scripts["test:single-player-scriptkill-v2-audit"]);
check("script test:world-tree-v2-entries exists", !!scripts["test:world-tree-v2-entries"]);
check("script test:project-complete-audit exists", !!scripts["test:project-complete-audit"]);

const preflight = scripts.preflight || "";
for (const gate of [
  "test:world-tree-v2-entries",
  "test:single-player-scriptkill-v2",
  "test:single-player-scriptkill-v2-audit",
  "test:project-complete-audit"
]) {
  check(`preflight includes ${gate}`, preflight.includes(`npm run ${gate}`));
}

// 2. V2 files exist
for (const file of [
  "src/server/tabletop-v2-service.js",
  "src/server/detective-v2-service.js",
  "src/server/character-capsule-service.js",
  "src/server/character-v2-live-turn-service.js",
  "src/server/single-player-scriptkill-v2-service.js",
  "tests/unit/single-player-scriptkill-v2-service-e2e.test.js",
  "scripts/audit-single-player-scriptkill-v2-closure.mjs"
]) check(`file exists ${file}`, existsSync(join(root, file)));

// 3. Server routes for V2 entries
for (const route of [
  "/api/tabletop-v2/import-preview",
  "/api/tabletop-v2/import-commit",
  "/api/tabletop-v2/start",
  "/api/tabletop-v2/turn",
  "/api/tabletop-v2/export-run",
  "/api/detective-v2/import-preview",
  "/api/detective-v2/generate-preview",
  "/api/detective-v2/generate-commit",
  "/api/detective-v2/export-run",
  "/api/characters/v2/turn",
  "/api/characters/v2/candidates",
  "/api/characters/v2/export",
  "/api/single-player-scriptkill-v2/import-preview",
  "/api/single-player-scriptkill-v2/import-commit",
  "/api/single-player-scriptkill-v2/start",
  "/api/single-player-scriptkill-v2/advance-phase",
  "/api/single-player-scriptkill-v2/export-run"
]) check(`server route ${route}`, server.includes(route));

// 4. UI boundary and methods
check("UI has no new top-level ScriptKill nav", !/nav:\s*\[[\s\S]{0,700}(ScriptKill|单人剧本杀)/.test(ui));
check("UI has singlePlayerScriptKillV2 state", ui.includes("singlePlayerScriptKillV2:"));
check("UI has Single Player ScriptKill V2 panel", ui.includes("renderSinglePlayerScriptKillV2Panel") && ui.includes("data-single-player-scriptkill-v2-panel"));
check("UI handles Single Player ScriptKill V2 actions", ui.includes("handleSinglePlayerScriptKillV2Action") && ui.includes("single-player-scriptkill-v2-"));
check("UI advance-phase passes nextPhaseId", /singlePlayerScriptKillV2AdvancePhase\(\{[\s\S]{0,160}nextPhaseId/.test(ui));
check("UI ScriptKill panel is gated or collapsible", ui.includes("shouldShowSinglePlayerScriptKillV2Panel") || ui.includes("panelOpen") && ui.includes("single-player-scriptkill-v2-toggle-panel"));

// 5. Specific Single Player ScriptKill closure
const skService = read("src/server/single-player-scriptkill-v2-service.js");
check("ScriptKill V2 service declares existing entry", skService.includes("existing “单人剧本杀” entry V2") || skService.includes("Not a new product entry"));
check("ScriptKill V2 persists result.state as runState", skService.includes("normalizeRunMutationResult") && skService.includes("runState: result.state"));
check("ScriptKill V2 namespace isolation", skService.includes("engine") && skService.includes("single-player-scriptkill-v2"));
check("ScriptKill V2 service does not import other V2 runtimes", !skService.includes("tabletop-v2-service") && !skService.includes("detective-v2-service") && !skService.includes("character-v2-live"));

// 6. Docs truth-source freshness — regex-based, not exact string
const stalePatterns = [
  { name: "Main head 5cb48da", re: /Main head.*5cb48da/is, files: ["CURRENT_PROJECT_STATE", "docs/INDEX"] },
  { name: "Full V2 Not implemented", re: /Full V2.*Not implemented/is, files: ["CURRENT_PROJECT_STATE", "docs/INDEX"] },
  { name: "TRUSTED_PRE_V2_CLOSURE_SEALED", re: /TRUSTED_PRE_V2_CLOSURE_SEALED/, files: ["CURRENT_PROJECT_STATE"] },
  { name: "Preflight 19 sub-commands", re: /Preflight.*19 sub-commands/is, files: ["CURRENT_PROJECT_STATE"] },
  { name: "Character Capsule V2 未实现", re: /Character Capsule V2.*未实现/, files: ["docs/INDEX"] },
  { name: "Pre-V2 Closure Blocker Repair in README/AI-GUIDE", re: /Pre-V2 Closure Blocker Repair/, files: ["README", "AI-GUIDE"] },
];

const docMap = {
  "CURRENT_PROJECT_STATE": currentState,
  "docs/INDEX": docsIndex,
  "README": readme,
  "AI-GUIDE": aiGuide,
};

for (const pattern of stalePatterns) {
  for (const file of pattern.files) {
    const text = docMap[file] || "";
    const hit = pattern.re.test(text);
    check(`${file}: no stale "${pattern.name}"`, !hit);
  }
}

// Strong checks for CURRENT_PROJECT_STATE and INDEX — no hash-specific checks
check("CURRENT_PROJECT_STATE: Trusted Baseline is v0.4.2-v2-engineering-foundation-truth.0", currentState.includes("v0.4.2-v2-engineering-foundation-truth.0"));
check("CURRENT_PROJECT_STATE: no stale Main head field", !currentState.includes("Main head"));
check("CURRENT_PROJECT_STATE: has Current branch", currentState.includes("Current branch"));
check("CURRENT_PROJECT_STATE: has Latest audited commit", currentState.includes("Latest audited commit"));
check("CURRENT_PROJECT_STATE: has Remote CI", currentState.includes("Remote CI"));
check("CURRENT_PROJECT_STATE: Latest audited commit looks like a hash", /Latest audited commit.*[0-9a-f]{7,40}/i.test(currentState));
check("CURRENT_PROJECT_STATE: Remote CI is UNKNOWN", /Remote CI.*UNKNOWN/i.test(currentState));
check("CURRENT_PROJECT_STATE: Status is V2_ENTRY_CLOSURE_SEALED_PENDING_REMOTE_CI", currentState.includes("V2_ENTRY_CLOSURE_SEALED_PENDING_REMOTE_CI"));
check("docs/INDEX: Trusted Baseline is v0.4.2-v2-engineering-foundation-truth.0", docsIndex.includes("v0.4.2-v2-engineering-foundation-truth.0"));
check("docs/INDEX: no stale Main head field", !docsIndex.includes("Main head"));
check("docs/INDEX: has Current branch", docsIndex.includes("Current branch"));
check("docs/INDEX: has Latest audited commit", docsIndex.includes("Latest audited commit"));
check("docs/INDEX: has Remote CI", docsIndex.includes("Remote CI"));
check("docs/INDEX: Latest audited commit looks like a hash", /Latest audited commit.*[0-9a-f]{7,40}/i.test(docsIndex));
check("docs/INDEX: Remote CI is UNKNOWN", /Remote CI.*UNKNOWN/i.test(docsIndex));
check("docs/INDEX: Character Capsule V2 not marked 未实现", !/Character Capsule V2.*未实现/.test(docsIndex));

// Malformed HTML checks
check("world-tree-console.js: no malformed <button <select", !/<button[^>]*<select/.test(ui));
check("world-tree-console.js: no <button><option pattern", !/<button[^>]*>\s*<option/.test(ui));
check("world-tree-console.js: no <button> containing phases.map", !/<button[^>]*>\$\{phases\.map/.test(ui));

check("V2 status doc exists", existsSync(join(root, "docs/V2_ENTRY_COMPLETION_STATUS.md")));
check("V2 status doc covers all four V2 entries", includesAll(v2Status, ["Tabletop V2", "Detective V2", "Character V2", "Single Player ScriptKill V2"]));
check("CURRENT_PROJECT_STATE names current V2 entry closure", currentState.includes("V2 Entry Closure") && currentState.includes("Latest audited commit"));
check("docs/INDEX links V2 status doc", docsIndex.includes("V2_ENTRY_COMPLETION_STATUS.md"));
check("README reflects V2 entry closure", readme.includes("V2 Entry Closure") && includesAll(readme, ["Tabletop V2", "Detective V2", "Character V2", "单人剧本杀 V2"]));
check("AI-GUIDE documents Single Player ScriptKill V2 boundary", includesAll(aiGuide, ["single-player-scriptkill", "陌生", "DM", "fullTruth"]));
check("AI-GUIDE includes V2 entry closure test commands", includesAll(aiGuide, [
  "test:world-tree-v2-entries",
  "test:single-player-scriptkill-v2",
  "test:single-player-scriptkill-v2-audit",
  "test:project-complete-audit"
]));
check("SCRIPTS doc mentions V2 gates", includesAll(scriptsDoc, ["test:world-tree-v2-entries", "test:single-player-scriptkill-v2", "test:project-complete-audit"]));
check("API route inventory includes V2 route groups", includesAll(apiInventory, ["/api/tabletop-v2", "/api/detective-v2", "/api/characters/v2", "/api/single-player-scriptkill-v2"]));
check("Asset inventory includes V2 entries", includesAll(assetInventory, ["ENTRY-TT-V2", "ENTRY-DET-V2", "ENTRY-CHAR-V2", "ENTRY-SPSK-V2"]));
check("Asset matrix includes V2 entry assets", includesAll(assetMatrix, ["Tabletop V2", "Detective V2", "Character V2", "Single Player ScriptKill V2"]));

// 7. Privacy/local-first default
check("GitHub update check is opt-in", server.includes("WORLD_TREE_ENABLE_UPDATE_CHECK") && !server.includes("WORLD_TREE_DISABLE_UPDATE_CHECK !== \"1\""));

console.log(`\nProject complete audit: ${pass}/${pass + fail} pass`);
if (fail > 0) {
  console.error("\nFailures:");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}
console.log("All complete project checks passed.");
