// scripts/audit-ux-coherence.mjs
// User-experience coherence audit for World Tree.
// This catches problems that simple API/string presence audits miss:
// - fake previews that do not call backend preview APIs
// - backend response fields not synced into UI state
// - V2 runtime aliases being counted as extra product features
// - misleading progress copy and health status mismatch

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readBrowserSource } from "./lib/browser-source.mjs";
import { readServerSource } from "./lib/server-source.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
let warnings = 0;
let passes = 0;

function read(rel) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf-8");
}

function pass(msg) { passes += 1; console.log(`  ✅ ${msg}`); }
function warn(msg) { warnings += 1; console.warn(`  ⚠️ ${msg}`); }
function fail(msg) { errors += 1; console.error(`  ❌ ${msg}`); }
function expect(condition, ok, bad) { condition ? pass(ok) : fail(bad); }

function functionBody(code, name) {
  const start = code.indexOf(`function ${name}`);
  const asyncStart = code.indexOf(`async function ${name}`);
  const idx = asyncStart >= 0 ? asyncStart : start;
  if (idx < 0) return "";
  const signatureEnd = code.indexOf(")", idx);
  const brace = code.indexOf("{", signatureEnd >= 0 ? signatureEnd : idx);
  if (brace < 0) return "";
  let depth = 0;
  for (let i = brace; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    if (code[i] === "}") depth -= 1;
    if (depth === 0) return code.slice(idx, i + 1);
  }
  return code.slice(idx);
}

console.log("\n🧭 UX Coherence Audit");

const js = readBrowserSource(ROOT);
const server = readServerSource(ROOT);
const v2RouteContent = [
  "src/server/v2-product-playable-routes.js",
  "src/server/tabletop-v2-routes.js",
  "src/server/detective-v2-routes.js",
  "src/server/single-player-scriptkill-v2-routes.js",
  "src/server/character-v2-routes.js"
].map(read).join("\n");
const tabletopService = read("src/server/tabletop-v2-service.js");
const pkg = read("package.json");
const stateDoc = read("docs/CURRENT_PROJECT_STATE.md");
const aliasFile = read("src/core/features/feature-alias-registry.js");

console.log("\n1. Feature alias registry");
expect(Boolean(aliasFile), "feature alias registry file exists", "src/core/features/feature-alias-registry.js missing");
expect(aliasFile.includes("CANONICAL_PRODUCT_FEATURES") && aliasFile.includes("assertCanonicalFeatureCount"), "alias registry exposes canonical feature API", "alias registry missing canonical API");
expect(aliasFile.includes("single-player-scriptkill-v2") && aliasFile.includes("murder-mystery"), "ScriptKill aliases resolve to murder-mystery", "ScriptKill aliases not mapped to murder-mystery");
expect(aliasFile.includes("detective-v2") && aliasFile.includes("mystery-puzzle"), "Detective V2 aliases resolve to mystery-puzzle", "Detective V2 aliases not mapped to mystery-puzzle");
expect(aliasFile.includes("tabletop-v2") && aliasFile.includes("tabletop"), "Tabletop V2 aliases resolve to tabletop", "Tabletop V2 aliases not mapped to tabletop");

try {
  const registryUrl = pathToFileURL(join(ROOT, "src/core/features/feature-alias-registry.js")).href;
  const registry = await import(registryUrl);
  registry.assertCanonicalFeatureCount(8);
  const ids = registry.CANONICAL_PRODUCT_FEATURES.map(f => f.id);
  expect(ids.length === 8, "exactly 8 canonical product features", `expected 8 canonical features, got ${ids.length}`);
  expect(registry.canonicalFeatureId("ScriptKill") === "murder-mystery", "ScriptKill runtime is not ninth feature", "ScriptKill runtime resolves incorrectly");
  expect(registry.canonicalFeatureId("detective-v2") === "mystery-puzzle", "Detective V2 runtime is not ninth feature", "Detective V2 runtime resolves incorrectly");
} catch (err) {
  fail(`feature alias registry import failed: ${err.message}`);
}

console.log("\n2. Tabletop V2 preview / commit coherence");
const tabletopPreview = functionBody(js, "previewTabletopV2Import");
const tabletopStart = functionBody(js, "startTabletopV2FromUI");
const tabletopCommit = functionBody(js, "commitTabletopV2Import");
expect(tabletopPreview.includes("API.tabletopV2ImportPreview"), "Tabletop V2 preview calls backend preview API", "Tabletop V2 preview still uses local/fake preview instead of backend API");
expect(!/AS\.tabletopV2\.importPreview\s*=\s*\{\s*title:\s*["']文本导入/.test(tabletopPreview), "Tabletop V2 fake text preview removed", "Tabletop V2 still creates fake text preview in frontend");
expect(tabletopStart.includes("moduleDraft"), "Tabletop V2 start consumes backend moduleDraft when available", "Tabletop V2 start does not consume backend moduleDraft");
expect(tabletopCommit.includes("API.tabletopV2ImportCommit"), "Tabletop V2 commit calls backend commit API", "Tabletop V2 commit missing backend commit call");
expect(tabletopCommit.includes("moduleDraft"), "Tabletop V2 commit consumes backend moduleDraft when available", "Tabletop V2 commit does not consume backend moduleDraft");
expect(tabletopService.includes("moduleDraft") && tabletopService.includes("createAdventureModuleDraftFromExternalText"), "Tabletop V2 preview returns backend moduleDraft", "Tabletop V2 backend preview does not return a moduleDraft");

console.log("\n3. Tabletop V2 response state sync");
const tabletopTurn = functionBody(js, "sendTabletopV2Turn");
const tabletopStateNormalizer = functionBody(js, "normalizeTabletopV2PublicState");
expect(tabletopStart.includes("normalizeTabletopV2PublicState") && tabletopTurn.includes("normalizeTabletopV2PublicState"), "Tabletop V2 UI normalizes backend public state", "Tabletop V2 UI does not normalize backend public state");
expect(tabletopStateNormalizer.includes("state.clocks") && tabletopStateNormalizer.includes("state.diceLogPublic"), "Tabletop V2 UI accepts backend clocks/diceLogPublic aliases", "Tabletop V2 UI does not accept backend clocks/diceLogPublic aliases");
for (const field of ["lastNarrative", "currentScene", "publicClocks", "resources", "inventory", "questLog", "visibleNpcs", "diceLog", "lastRuling", "endingAvailable"]) {
  expect(tabletopTurn.includes(`AS.tabletopV2.${field}`) || tabletopTurn.includes(field), `Tabletop V2 turn syncs ${field}`, `Tabletop V2 turn does not sync ${field}`);
}

console.log("\n4. Health / LLM status truthfulness");
const updateHealth = functionBody(js, "updateHealth");
expect(updateHealth.includes("llmConfigured"), "updateHealth handles default /api/health llmConfigured shape", "updateHealth ignores default health llmConfigured shape");
expect(updateHealth.includes("AS.health?.llm?.status") || updateHealth.includes("health.llm"), "updateHealth still supports full llm.status shape", "updateHealth no longer supports full health llm.status shape");
expect(updateHealth.includes("dataWritable") || updateHealth.includes("writable"), "updateHealth handles data writable status", "updateHealth ignores data writable status");

console.log("\n5. Progress copy truthfulness");
expect(js.includes("progressProfile") || js.includes("getProgressStages") || js.includes("setProgressProfile"), "dynamic progress profile exists", "progress copy is still globally fixed");
const progressLiteral = js.includes("Guardian 正在审核") && js.includes("导演正在分析你的行动");
if (progressLiteral && !(js.includes("chat-default") || js.includes("progressProfile"))) {
  fail("global progress copy still hardcodes Director/Guardian without profile gating");
} else {
  pass("Director/Guardian progress copy is gated or replaced");
}

console.log("\n6. Current project state truth-source wording");
expect(stateDoc.includes("UX_ENTRY_COHERENCE") || stateDoc.includes("UX Coherence") || stateDoc.includes("Browser QA"), "CURRENT_PROJECT_STATE mentions UX/browser QA limitations", "CURRENT_PROJECT_STATE lacks UX/browser QA truth source wording");
expect(stateDoc.includes("LLM_ROUTING") || stateDoc.includes("Prompt") || stateDoc.includes("LLM"), "CURRENT_PROJECT_STATE mentions LLM/prompt routing state", "CURRENT_PROJECT_STATE lacks LLM/prompt routing state wording");
const promptRuntimeBoundaryIsExplicit =
  stateDoc.includes("| Prompt Orchestration Layer v1 | COMPLETE | Prompt infrastructure |") &&
  stateDoc.includes("local prompt contract coverage") &&
  stateDoc.includes("product-wide Real LLM closure remains incomplete");
if (/Prompt Orchestration Layer v1 \| COMPLETE/.test(stateDoc) && !promptRuntimeBoundaryIsExplicit) {
  warn("Prompt layer still says COMPLETE; ensure docs distinguish prompt-block tests from runtime LLM routing");
}

console.log("\n7. Audit wiring");
expect(pkg.includes("ux:check"), "package.json has ux:check", "package.json missing ux:check script");
expect(pkg.includes("test:feature-alias"), "package.json has test:feature-alias", "package.json missing test:feature-alias script");
expect(pkg.includes("audit-ux-coherence.mjs"), "ux audit script wired in package.json", "audit-ux-coherence.mjs not wired in package.json");

console.log("\n8. V2 runtime service route aliases are not product-count aliases");
const routeSource = `${server}\n${v2RouteContent}`;
expect(routeSource.includes("/api/single-player-scriptkill-v2") && aliasFile.includes("single-player-scriptkill-v2"), "single-player ScriptKill service route has canonical alias", "single-player ScriptKill route missing canonical alias coverage");
expect(routeSource.includes("/api/detective-v2") && aliasFile.includes("detective-v2"), "Detective V2 service route has canonical alias", "Detective V2 route missing canonical alias coverage");
expect(routeSource.includes("/api/tabletop-v2") && aliasFile.includes("tabletop-v2"), "Tabletop V2 service route has canonical alias", "Tabletop V2 route missing canonical alias coverage");

console.log("\n9. User-facing feature count guard");
const featureCountMentionsNine = /9\s*个模式|九个功能|第九个功能|9\s*features/i.test(js + "\n" + stateDoc);
expect(!featureCountMentionsNine, "no user-facing ninth-feature wording detected", "found wording that implies a ninth product feature");

console.log(`\n${"=".repeat(60)}`);
console.log(`UX coherence audit: ${passes} pass / ${warnings} warnings / ${errors} errors`);
if (errors > 0) process.exit(1);
