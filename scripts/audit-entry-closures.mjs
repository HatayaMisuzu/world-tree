// Entry Closures Audit Script
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const serverContent = readFileSync(join(root, "server.js"), "utf-8");
const routeContents = [
  "src/server/v2-product-playable-routes.js",
  "src/server/tabletop-v2-routes.js",
  "src/server/detective-v2-routes.js",
  "src/server/character-v2-routes.js",
  "src/server/single-player-scriptkill-v2-routes.js"
].map((file) => readFileSync(join(root, file), "utf-8")).join("\n");
const uiContent = [
  readFileSync(join(root, "world-tree-console.js"), "utf-8"),
  readFileSync(join(root, "world-tree-client-core.js"), "utf-8")
].join("\n");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

const results = { tabletop: [], detective: [], character: [], isolation: [] };
let pass = 0, fail = 0;

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }

function hasRoute(method, path) {
  return serverContent.includes(`path === "${path}" && method === "${method}"`)
    || routeContents.includes(`path === "${path}" && method === "${method}"`);
}

function hasUiMethod(name) {
  return uiContent.includes(name + "(") || uiContent.includes(name + " (");
}

function hasScript(name) { return !!pkg.scripts?.[name]; }

function check(entry, label, fn) {
  const ok = fn();
  results[entry].push({ label, pass: ok });
  if (ok) pass++; else { fail++; console.log("FAIL: " + label); }
}

// Tabletop
const t = "tabletop";
const ttRoutes = [
  ["POST", "/api/tabletop-v2/import-preview"], ["POST", "/api/tabletop-v2/import-commit"],
  ["POST", "/api/tabletop-v2/start"], ["POST", "/api/tabletop-v2/turn"],
  ["POST", "/api/tabletop-v2/save"], ["POST", "/api/tabletop-v2/branch"],
  ["POST", "/api/tabletop-v2/restore-save"], ["POST", "/api/tabletop-v2/export-run"],
  ["GET", "/api/tabletop-v2/runs"], ["POST", "/api/tabletop-v2/load-run"],
  ["POST", "/api/tabletop-v2/switch-branch"],
];
ttRoutes.forEach(([m, p]) => check(t, `${m} ${p}`, () => hasRoute(m, p)));
check(t, "UI: tabletopV2ImportCommit", () => hasUiMethod("tabletopV2ImportCommit"));
check(t, "UI: tabletopV2ExportRun", () => hasUiMethod("tabletopV2ExportRun"));
check(t, "Test: test:tabletop-v2-full", () => hasScript("test:tabletop-v2-full"));

// Detective
const d = "detective";
[
  ["POST", "/api/detective-v2/import-preview"], ["POST", "/api/detective-v2/start"],
  ["POST", "/api/detective-v2/investigate"], ["POST", "/api/detective-v2/interrogate"],
  ["POST", "/api/detective-v2/deduction/submit"], ["POST", "/api/detective-v2/generate-preview"],
  ["POST", "/api/detective-v2/generate-commit"], ["POST", "/api/detective-v2/export-run"],
  ["POST", "/api/detective-v2/export-case-player-pack"],
].forEach(([m, p]) => check(d, `${m} ${p}`, () => hasRoute(m, p)));
check(d, "Test: test:detective-v2-full", () => hasScript("test:detective-v2-full"));

// Character
const c = "character";
[
  ["POST", "/api/characters/v2/turn"], ["GET", "/api/characters/v2/candidates"],
  ["POST", "/api/characters/v2/candidates/review"], ["POST", "/api/characters/v2/candidates/bulk-review"],
  ["POST", "/api/characters/v2/candidates/undo"], ["POST", "/api/characters/v2/export"],
].forEach(([m, p]) => check(c, `${m} ${p}`, () => hasRoute(m, p)));
check(c, "Test: test:character-v2-long-term", () => hasScript("test:character-v2-long-term"));

// Isolation
const i = "isolation";
const tSvc = existsSync(join(root, "src/server/tabletop-v2-service.js")) ? readFileSync(join(root, "src/server/tabletop-v2-service.js"), "utf-8") : "";
const dSvc = existsSync(join(root, "src/server/detective-v2-service.js")) ? readFileSync(join(root, "src/server/detective-v2-service.js"), "utf-8") : "";
const cSvc = existsSync(join(root, "src/server/character-v2-live-turn-service.js")) ? readFileSync(join(root, "src/server/character-v2-live-turn-service.js"), "utf-8") : "";
check(i, "Tabletop doesn't ref detective", () => !tSvc.includes("detective-v2-service"));
check(i, "Detective doesn't ref tabletop", () => !dSvc.includes("tabletop-v2-service"));
check(i, "Character doesn't ref tabletop", () => !cSvc.includes("tabletop-v2-service"));

console.log("\n=== Entry Closures Audit ===");
for (const [entry, items] of Object.entries(results)) {
  const p = items.filter(r => r.pass).length;
  console.log(`${entry}: ${p}/${items.length}`);
}
console.log(`Overall: ${pass}/${pass+fail} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
console.log("All checks PASSED.");
