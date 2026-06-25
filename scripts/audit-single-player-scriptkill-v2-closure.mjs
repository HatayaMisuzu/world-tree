// Single Player ScriptKill V2 Final Closure Audit
// Checks existing 单人剧本杀 entry V2 deepening, module boundary, service persistence, and UI minimum operation surface.

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
const runtimeState = read("src/core/single-player-scriptkill/single-player-scriptkill-runtime-state.js");
const simulatedPlayer = read("src/core/single-player-scriptkill/single-player-scriptkill-simulated-player.js");
const boundary = read("src/core/modules/scriptplay/scriptplay-knowledge-boundary.js");
const phase = read("src/core/modules/scriptplay/scriptplay-phase-engine.js");
const spoiler = read("src/core/modules/scriptplay/scriptplay-spoiler-guard.js");
const serviceE2e = read("tests/unit/single-player-scriptkill-v2-service-e2e.test.js");

let pass = 0, fail = 0;
function check(label, ok) {
  if (ok) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

check("script test:single-player-scriptkill-v2 exists", !!pkg.scripts?.["test:single-player-scriptkill-v2"]);
check("script test:single-player-scriptkill-v2 includes service e2e", /single-player-scriptkill-v2-service-e2e\.test\.js/.test(pkg.scripts?.["test:single-player-scriptkill-v2"] || ""));
check("script test:single-player-scriptkill-v2-audit exists", !!pkg.scripts?.["test:single-player-scriptkill-v2-audit"]);

check("entry visible wording 单人剧本杀 exists", ui.includes("单人剧本杀") || service.includes("单人剧本杀") || packageCore.includes("单人剧本杀"));
check("no new top-level nav item named ScriptKill", !/nav:\s*\[[\s\S]{0,500}ScriptKill/.test(ui));
check("no new top-level nav item named 单人剧本杀", !/nav:\s*\[[\s\S]{0,500}单人剧本杀/.test(ui));

check("service persists under single-player-scriptkill-v2 namespace", service.includes("engine") && service.includes("single-player-scriptkill-v2"));
check("service declares existing entry not new product entry", service.includes("existing “单人剧本杀” entry V2") || service.includes("Not a new product entry"));
check("service does not import tabletop/detective/character runtime", !service.includes("tabletop-v2-service") && !service.includes("detective-v2-service") && !service.includes("character-v2-live"));

for (const route of [
  "/api/single-player-scriptkill-v2/import-preview",
  "/api/single-player-scriptkill-v2/import-commit",
  "/api/single-player-scriptkill-v2/start",
  "/api/single-player-scriptkill-v2/read-role-act",
  "/api/single-player-scriptkill-v2/public-talk",
  "/api/single-player-scriptkill-v2/private-chat",
  "/api/single-player-scriptkill-v2/search",
  "/api/single-player-scriptkill-v2/reveal-clue",
  "/api/single-player-scriptkill-v2/advance-phase",
  "/api/single-player-scriptkill-v2/vote",
  "/api/single-player-scriptkill-v2/debrief",
  "/api/single-player-scriptkill-v2/export-run",
  "/api/single-player-scriptkill-v2/runs",
  "/api/single-player-scriptkill-v2/load-run",
]) check(`server route ${route}`, server.includes(route));

for (const method of [
  "singlePlayerScriptKillV2ImportPreview",
  "singlePlayerScriptKillV2ImportCommit",
  "singlePlayerScriptKillV2Start",
  "singlePlayerScriptKillV2ReadRoleAct",
  "singlePlayerScriptKillV2PublicTalk",
  "singlePlayerScriptKillV2PrivateChat",
  "singlePlayerScriptKillV2Search",
  "singlePlayerScriptKillV2RevealClue",
  "singlePlayerScriptKillV2AdvancePhase",
  "singlePlayerScriptKillV2Vote",
  "singlePlayerScriptKillV2Debrief",
  "singlePlayerScriptKillV2ExportRun",
  "singlePlayerScriptKillV2Runs",
  "singlePlayerScriptKillV2LoadRun",
]) check(`UI API ${method}`, ui.includes(`${method}(`));

check("UI has singlePlayerScriptKillV2 state", ui.includes("singlePlayerScriptKillV2:"));
check("UI has single player scriptkill panel or data marker", ui.includes("renderSinglePlayerScriptKillV2Panel") || ui.includes("data-single-player-scriptkill-v2-panel"));
check("UI dispatcher handles single-player-scriptkill-v2 actions", ui.includes("single-player-scriptkill-v2-") && ui.includes("handleSinglePlayerScriptKillV2Action"));

check("package core has ownership gate", packageCore.includes("userConfirmedLegalAccess"));
check("package core hides dmBook/fullTruth in player view", packageCore.includes("dmBook: undefined") && packageCore.includes("fullTruth: undefined"));
check("importer does not fake ready for text", importer.includes("needs_mapping") && importer.includes("不能假装完整可玩"));
check("runtime uses phase engine", runtime.includes("getCurrentScriptPhase") && runtime.includes("canPerformPhaseAction"));
check("runtime state hides simulated player real names", runtimeState.includes("playerDisplayName: undefined") && runtimeState.includes("relationshipToRealUser: \"stranger\""));

check("advance phase result is normalized for persistence", service.includes("normalizeRunMutationResult") && service.includes("result.state") && service.includes("runState: result.state"));
check("withRunMutating writes normalized result.runState", /normalizeRunMutationResult\(rawResult\)/.test(service) && /writeJson\(runFile, result\.runState\)/.test(service));
check("service e2e verifies persisted phase", serviceE2e.includes("advance-phase must persist run-state.json") && serviceE2e.includes("readRunFile"));
check("service e2e covers debrief and export", serviceE2e.includes("debriefSinglePlayerScriptKillV2") && serviceE2e.includes("exportRunSinglePlayerScriptKillV2"));

check("boundary is module-layer reusable", boundary.includes("Reusable Scriptplay Knowledge Boundary"));
check("phase engine is module-layer reusable", phase.includes("Reusable Scriptplay Phase Engine"));
check("spoiler guard is module-layer reusable", spoiler.includes("Reusable Scriptplay Spoiler Guard"));
check("simulated player role/player split", simulatedPlayer.includes("Simulated Player != role itself") && simulatedPlayer.includes("stranger trying to play assigned role"));

for (const file of [
  "tests/unit/single-player-scriptkill-v2-package.test.js",
  "tests/unit/single-player-scriptkill-v2-importer.test.js",
  "tests/unit/single-player-scriptkill-v2-runtime.test.js",
  "tests/unit/single-player-scriptkill-v2-knowledge-boundary.test.js",
  "tests/unit/single-player-scriptkill-v2-service-e2e.test.js",
]) check(`test exists ${file}`, existsSync(join(root, file)));

console.log(`Single Player ScriptKill V2 final closure audit: ${pass}/${pass + fail} pass`);
if (fail > 0) process.exit(1);
console.log("All Single Player ScriptKill V2 final closure checks passed.");
