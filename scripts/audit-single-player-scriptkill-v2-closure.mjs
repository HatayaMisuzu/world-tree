// Single Player ScriptKill V2 Closure Audit
// Checks V2 deepening of existing 单人剧本杀 entry and module boundary.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => existsSync(join(root, p)) ? readFileSync(join(root, p), "utf-8") : "";
const pkg = JSON.parse(read("package.json") || "{}");
const ui = read("world-tree-console.js");
const server = read("server.js");
const service = read("src/server/single-player-scriptkill-v2-service.js");
const packageCore = read("src/core/single-player-scriptkill/single-player-scriptkill-package.js");
const importer = read("src/core/single-player-scriptkill/single-player-scriptkill-importer.js");
const runtime = read("src/core/single-player-scriptkill/single-player-scriptkill-solo-runtime.js");
const boundary = read("src/core/modules/scriptplay/scriptplay-knowledge-boundary.js");
const phase = read("src/core/modules/scriptplay/scriptplay-phase-engine.js");

let pass = 0, fail = 0;
function check(label, ok) { if (ok) pass++; else { fail++; console.error(`FAIL: ${label}`); } }

check("script test:single-player-scriptkill-v2 exists", !!pkg.scripts?.["test:single-player-scriptkill-v2"]);
check("entry visible wording 单人剧本杀 exists or required in UI/service", ui.includes("单人剧本杀") || service.includes("单人剧本杀") || packageCore.includes("单人剧本杀"));
check("no new top-level nav item named ScriptKill", !/nav:\s*\[[\s\S]{0,500}ScriptKill/.test(ui));
check("service persists under single-player-scriptkill-v2 namespace", service.includes("engine") && service.includes("single-player-scriptkill-v2"));
check("service does not import tabletop/detective/character runtime", !service.includes("tabletop-v2-service") && !service.includes("detective-v2-service") && !service.includes("character-v2-live"));

for (const route of [
  "/api/single-player-scriptkill-v2/import-preview",
  "/api/single-player-scriptkill-v2/import-commit",
  "/api/single-player-scriptkill-v2/start",
  "/api/single-player-scriptkill-v2/public-talk",
  "/api/single-player-scriptkill-v2/private-chat",
  "/api/single-player-scriptkill-v2/search",
  "/api/single-player-scriptkill-v2/vote",
  "/api/single-player-scriptkill-v2/debrief"
]) check(`server route ${route}`, server.includes(route));

for (const method of [
  "singlePlayerScriptKillV2ImportPreview",
  "singlePlayerScriptKillV2ImportCommit",
  "singlePlayerScriptKillV2Start",
  "singlePlayerScriptKillV2PublicTalk",
  "singlePlayerScriptKillV2PrivateChat",
  "singlePlayerScriptKillV2Search",
  "singlePlayerScriptKillV2Vote",
  "singlePlayerScriptKillV2Debrief"
]) check(`UI API ${method}`, ui.includes(`${method}(`));

check("package core has ownership gate", packageCore.includes("userConfirmedLegalAccess"));
check("importer does not fake ready for text", importer.includes("needs_mapping") && importer.includes("不能假装完整可玩"));
check("runtime uses phase engine", runtime.includes("getCurrentScriptPhase") && runtime.includes("canPerformPhaseAction"));
check("boundary is module-layer reusable", boundary.includes("Reusable Scriptplay Knowledge Boundary"));
check("phase engine is module-layer reusable", phase.includes("Reusable Scriptplay Phase Engine"));
check("simulated player role/player split", read("src/core/single-player-scriptkill/single-player-scriptkill-simulated-player.js").includes("Simulated Player != role itself"));

for (const file of [
  "tests/unit/single-player-scriptkill-v2-package.test.js",
  "tests/unit/single-player-scriptkill-v2-importer.test.js",
  "tests/unit/single-player-scriptkill-v2-runtime.test.js",
  "tests/unit/single-player-scriptkill-v2-knowledge-boundary.test.js"
]) check(`test exists ${file}`, existsSync(join(root, file)));

console.log(`Single Player ScriptKill V2 closure audit: ${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
console.log("All Single Player ScriptKill V2 checks passed.");
