import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import {
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "../tests/integration/helpers/server-process.js";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch (localError) {
    const moduleDir = process.env.WORLD_TREE_PLAYWRIGHT_MODULE_DIR || "";
    if (!moduleDir) throw localError;
    return createRequire(join(moduleDir, "package.json"))("playwright");
  }
}

const { chromium } = loadPlaywright();

const reportDir = resolve(process.env.WT_BROWSER_MATRIX_REPORT_DIR || join("..", "world-tree-product-usable-closure-output"));
const progressPath = join(reportDir, "browser-smoke-progress.txt");
function markProgress(message) {
  writeFileSync(progressPath, `${new Date().toISOString()} ${message}\n`, { encoding: "utf8", flag: "a" });
}
const scriptkillFixture = JSON.parse(readFileSync(new URL("../tests/fixtures/single-player-scriptkill-v2/ready-package.json", import.meta.url), "utf8"));
const entries = [
  {
    id: "quick-setting",
    surface: "creation",
    label: "快速设定",
    title: /快速设定|Quick Setting/,
    input: "#quickStartText",
    action: '[data-action="quick-start-chat"]',
    expectedStatus: "PASS",
    note: "创作页可见，可输入设定并创建草稿。"
  },
  {
    id: "character",
    surface: "experiences",
    label: "人物卡",
    title: /人物卡|Character/,
    input: "#charCardText",
    action: '[data-action="character-start-chat"]',
    expectedStatus: "PASS",
    note: "体验页可见，可粘贴人物卡并开始对话。"
  },
  {
    id: "world-rpg",
    surface: "experiences",
    label: "世界书大世界",
    title: /世界书大世界|World RPG/,
    input: "#wrpgText",
    action: '[data-action="world-rpg-start"]',
    expectedStatus: "PASS",
    note: "体验页可见，可创建世界冒险；Worldbook V2 完整编辑器仍是部分完成。"
  },
  {
    id: "tabletop",
    surface: "experiences",
    label: "桌面叙事",
    title: /桌面叙事|Tabletop/,
    input: "#tabletopText",
    action: '[data-action="tabletop-start"]',
    apiProbe: "tabletop",
    expectedStatus: "PASS",
    note: "体验页可见，可创建普通 Tabletop 草稿；V2 产品 API 可 start/turn/save/branch/export。"
  },
  {
    id: "mystery-puzzle",
    surface: "experiences",
    label: "解谜调查",
    title: /解谜调查|Mystery Puzzle/,
    input: "#mysteryText",
    action: '[data-action="mystery-puzzle-start"]',
    apiProbe: "detective",
    expectedStatus: "PASS",
    note: "体验页可见，可创建调查草稿；V2 产品 API 可 import/start/investigate/interrogate/deduction/export。"
  },
  {
    id: "strategy-sim",
    surface: "experiences",
    label: "策略模拟",
    title: /策略模拟|Strategy Sim/,
    input: "#strategyText",
    action: '[data-action="strategy-sim-start"]',
    apiProbe: "strategy",
    expectedStatus: "PASS",
    note: "体验页可见，可创建策略草稿；V2 产品 API 可 seal/start/turn/save/export。"
  },
  {
    id: "murder-mystery",
    surface: "experiences",
    label: "单人剧本杀",
    title: /单人剧本杀|Murder Mystery/,
    input: "#murderText",
    action: '[data-action="murder-mystery-start"]',
    secondaryAction: '[data-action="single-player-scriptkill-v2-toggle-panel"]',
    apiProbe: "scriptkill",
    expectedStatus: "PASS",
    note: "体验页可见，V2 面板可触达；V2 产品 API 可 import/start/read/talk/search/vote/debrief/export。"
  },
  {
    id: "creation-forge",
    surface: "creation",
    label: "炼金台",
    title: /炼金台|Creation Forge/,
    action: '[data-action="library-alchemy"]',
    expectedStatus: "PASS",
    note: "创作页可见，可打开炼金台 G1 创作闭环。"
  }
];

function statusFor(checks, expectedStatus) {
  if (checks.some((item) => !item.ok)) return "NOT_READY";
  return expectedStatus;
}

function strategySpec() {
  return {
    specId: "browser_matrix_strategy",
    title: "Browser Matrix Strategy",
    resources: [{ id: "supply", label: "Supply", min: 0, max: 10, initial: 5, visibility: "public", maxDeltaPerTurn: 2 }],
    variables: [{ id: "secret_pressure", min: 0, max: 10, initial: 2, visibility: "secret" }],
    mechanisms: [{ id: "ration", triggerTags: ["ration"], effects: [{ targetId: "supply", targetType: "resource", delta: -1 }] }],
    probabilityRules: [{ id: "scout", triggerTags: ["scout"], baseChance: 0.5, visibility: "partial" }]
  };
}

async function postJson(page, path, body) {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {
      json = { status: "error", code: "INVALID_JSON_RESPONSE", bodyText: text.slice(0, 200) };
    }
    return { httpStatus: response.status, body: json };
  }, { path, body });
}

function okCheck(id, response, predicate = (body) => body?.status === "ok") {
  return {
    id,
    ok: response?.httpStatus === 200 && predicate(response.body),
    detail: `http=${response?.httpStatus}; status=${response?.body?.status || "missing"}; code=${response?.body?.code || ""}`
  };
}

async function probeTabletop(page) {
  const checks = [];
  const start = await postJson(page, "/api/tabletop-v2/start", { module: { title: "Browser Matrix Tabletop", sourceType: "quick_start" } });
  checks.push(okCheck("api_tabletop_start", start));
  const runId = start.body?.run?.runId || "";
  checks.push(okCheck("api_tabletop_turn", await postJson(page, "/api/tabletop-v2/turn", { runId, playerIntent: "I inspect the room." })));
  const save = await postJson(page, "/api/tabletop-v2/save", { runId, label: "browser matrix fork" });
  checks.push(okCheck("api_tabletop_save", save));
  const branch = await postJson(page, "/api/tabletop-v2/branch", { runId, saveId: save.body?.saveId, branchLabel: "alternate" });
  checks.push(okCheck("api_tabletop_branch", branch));
  checks.push(okCheck("api_tabletop_export", await postJson(page, "/api/tabletop-v2/export-run", { runId })));
  return checks;
}

async function probeDetective(page) {
  const checks = [];
  const text = JSON.stringify({
    title: "Browser Matrix Case",
    truthLedger: { culpritIds: ["suspect_a"], motive: "hidden", method: "hidden" },
    locations: [{ locationId: "room", name: "Room", isStartingLocation: true }],
    evidence: [{ evidenceId: "note", name: "Public Note", locationId: "room", summary: "A public clue.", hiddenMeaning: "SECRET_SOLUTION" }],
    characters: [{ characterId: "suspect_a", name: "Suspect A", isCulprit: true }],
    testimony: [{ testimonyId: "t1", characterId: "suspect_a", publicText: "I was nearby.", deceptionReason: "SECRET_LIE" }]
  });
  const imported = await postJson(page, "/api/detective-v2/import-commit", { text });
  checks.push(okCheck("api_detective_import", imported));
  const started = await postJson(page, "/api/detective-v2/start", { caseId: imported.body?.caseId });
  checks.push(okCheck("api_detective_start", started));
  const runId = started.body?.run?.runId || "";
  checks.push(okCheck("api_detective_investigate", await postJson(page, "/api/detective-v2/investigate", { runId, locationId: "room" })));
  checks.push(okCheck("api_detective_interrogate", await postJson(page, "/api/detective-v2/interrogate", { runId, characterId: "suspect_a", question: "Where were you?" })));
  const note = await postJson(page, "/api/detective-v2/notebook/extract", { runId, selection: { sourceType: "evidence", sourceId: "note" } });
  checks.push(okCheck("api_detective_notebook_extract", note));
  checks.push(okCheck("api_detective_deduction_submit", await postJson(page, "/api/detective-v2/deduction/submit", { runId, report: { culpritId: "suspect_a", method: "guess" } })));
  const exported = await postJson(page, "/api/detective-v2/export-run", { runId });
  checks.push(okCheck("api_detective_export_no_secret", exported, (body) => body?.status === "ok" && !JSON.stringify(body.report || {}).includes("SECRET_SOLUTION")));
  return checks;
}

async function probeStrategy(page) {
  const checks = [];
  const sealed = await postJson(page, "/api/strategy-sim-v2/spec/seal", { spec: strategySpec() });
  checks.push(okCheck("api_strategy_seal", sealed));
  const started = await postJson(page, "/api/strategy-sim-v2/start", { runId: "browser_matrix_strategy", sealedSpec: sealed.body?.spec });
  checks.push(okCheck("api_strategy_start", started));
  const turn = await postJson(page, "/api/strategy-sim-v2/turn", { runId: "browser_matrix_strategy", action: "ration and scout" });
  checks.push(okCheck("api_strategy_turn_no_secret", turn, (body) => body?.status === "ok" && !JSON.stringify(body.publicView || {}).includes("secret_pressure")));
  checks.push(okCheck("api_strategy_save", await postJson(page, "/api/strategy-sim-v2/save", { runId: "browser_matrix_strategy" })));
  checks.push(okCheck("api_strategy_export", await postJson(page, "/api/strategy-sim-v2/export-run", { runId: "browser_matrix_strategy" })));
  return checks;
}

async function probeScriptkill(page) {
  const checks = [];
  const imported = await postJson(page, "/api/single-player-scriptkill-v2/import-commit", { package: scriptkillFixture });
  checks.push(okCheck("api_scriptkill_import", imported));
  const started = await postJson(page, "/api/single-player-scriptkill-v2/start", { scriptId: imported.body?.scriptId, runId: "browser_matrix_scriptkill", realPlayerRoleId: "role_writer" });
  checks.push(okCheck("api_scriptkill_start", started));
  const runId = started.body?.runId || "";
  checks.push(okCheck("api_scriptkill_read_role", await postJson(page, "/api/single-player-scriptkill-v2/read-role-act", { runId })));
  await postJson(page, "/api/single-player-scriptkill-v2/advance-phase", { runId, nextPhaseId: "phase_public" });
  checks.push(okCheck("api_scriptkill_public_talk", await postJson(page, "/api/single-player-scriptkill-v2/public-talk", { runId, text: "I give my timeline." })));
  await postJson(page, "/api/single-player-scriptkill-v2/advance-phase", { runId, nextPhaseId: "phase_search" });
  checks.push(okCheck("api_scriptkill_search", await postJson(page, "/api/single-player-scriptkill-v2/search", { runId, clueId: "clue_watch", keepPrivate: true })));
  await postJson(page, "/api/single-player-scriptkill-v2/advance-phase", { runId, nextPhaseId: "phase_vote" });
  checks.push(okCheck("api_scriptkill_vote", await postJson(page, "/api/single-player-scriptkill-v2/vote", { runId, targetRoleId: "role_doctor" })));
  await postJson(page, "/api/single-player-scriptkill-v2/advance-phase", { runId, nextPhaseId: "phase_debrief" });
  checks.push(okCheck("api_scriptkill_debrief", await postJson(page, "/api/single-player-scriptkill-v2/debrief", { runId })));
  const exported = await postJson(page, "/api/single-player-scriptkill-v2/export-run", { runId });
  checks.push(okCheck("api_scriptkill_export_player_view", exported, (body) => {
    const playerRun = body?.export?.playerRun || {};
    const text = JSON.stringify(playerRun);
    return body?.status === "ok" &&
      playerRun.dmBook === undefined &&
      playerRun.fullTruth === undefined &&
      !/culpritRoleId|dmMeaning|debriefScript/.test(text);
  }));
  return checks;
}

async function runApiProbe(page, probe) {
  if (probe === "tabletop") return probeTabletop(page);
  if (probe === "detective") return probeDetective(page);
  if (probe === "strategy") return probeStrategy(page);
  if (probe === "scriptkill") return probeScriptkill(page);
  return [];
}

function markdown(result) {
  const lines = [
    "# Product Entry Browser Matrix",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: ${result.status}`,
    "",
    "| Entry | Status | Reachable | Empty/Next Step | API Product Loop | LLM State | Notes |",
    "|---|---|---:|---:|---:|---|---|",
    ...result.entries.map((entry) => `| ${entry.id} | ${entry.status} | ${entry.reachable ? "YES" : "NO"} | ${entry.nextStepClear ? "YES" : "NO"} | ${entry.apiProductLoop} | ${entry.llmState} | ${entry.note} |`),
    "",
    "## Browser Health",
    "",
    `- console errors: ${result.consoleErrors.length}`,
    `- failed network responses: ${result.failedResponses.length}`,
    `- local start: ${result.localStart}`,
    "",
    "## Boundary",
    "",
    "This smoke proves product-surface/navigation reachability, basic next-step clarity, and selected API product loops for V2 entries. It does not claim human-signed PLAYABLE status or v1.0 release readiness."
  ];
  return `${lines.join("\n")}\n`;
}

async function run() {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(progressPath, "", "utf8");
  markProgress("starting server");
  const dataDir = await createTempDataDir("wt-product-entry-browser-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  markProgress("starting browser");
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const failedResponses = [];

  try {
    const page = await browser.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) failedResponses.push({ status, url: response.url().replace(server.baseUrl, "") });
    });

    markProgress("opening application");
    await page.goto(server.baseUrl, { waitUntil: "networkidle" });
    await page.getByText("World Tree").first().waitFor({ timeout: 10000 });
    markProgress("application ready");

    const health = await page.evaluate(async () => (await fetch("/api/health")).json());
    const llmState = await page.locator("#llmStatus").innerText().catch(() => "unknown");
    const matrix = [];

    for (const entry of entries) {
      console.log(`[browser-matrix] checking ${entry.id} on ${entry.surface}`);
      markProgress(`checking ${entry.id}`);
      await page.locator(`[data-view="${entry.surface}"]`).first().click();
      await page.locator("#main").waitFor({ state: "visible" });
      const titleVisible = await page.getByText(entry.title).first().isVisible().catch(() => false);
      const inputVisible = entry.input ? await page.locator(entry.input).isVisible().catch(() => false) : true;
      const actionEnabled = await page.locator(entry.action).first().isEnabled().catch(() => false);
      const secondaryVisible = entry.secondaryAction ? await page.locator(entry.secondaryAction).first().isVisible().catch(() => false) : true;
      const checks = [
        { id: "title_visible", ok: titleVisible },
        { id: "input_visible", ok: inputVisible },
        { id: "action_enabled", ok: actionEnabled },
        { id: "secondary_visible", ok: secondaryVisible }
      ];
      const apiChecks = await runApiProbe(page, entry.apiProbe);
      checks.push(...apiChecks);

      matrix.push({
        id: entry.id,
        label: entry.label,
        status: statusFor(checks, entry.expectedStatus),
        reachable: titleVisible && actionEnabled,
        nextStepClear: inputVisible && actionEnabled && secondaryVisible,
        apiProductLoop: entry.apiProbe ? (apiChecks.length > 0 && apiChecks.every((item) => item.ok) ? "PASS" : "FAIL") : "N/A",
        llmState,
        checks,
        note: entry.note
      });
      console.log(`[browser-matrix] completed ${entry.id}`);
      markProgress(`completed ${entry.id}`);
    }

    await page.locator('[data-action="library-alchemy"]').first().click();
    await page.getByText(/炼金台 G1|创作闭环/).first().waitFor({ timeout: 10000 });
    const alchemyOpened = await page.getByText(/生成创作地图/).first().isVisible().catch(() => false);
    const forge = matrix.find((entry) => entry.id === "creation-forge");
    forge.checks.push({ id: "alchemy_panel_opened", ok: alchemyOpened });
    forge.reachable = forge.reachable && alchemyOpened;
    forge.nextStepClear = forge.nextStepClear && alchemyOpened;
    forge.status = statusFor(forge.checks, forge.status === "NOT_READY" ? "NOT_READY" : "PASS");

    const hardFailures = failedResponses.filter((item) => !item.url.startsWith("/api/config") && !item.url.startsWith("/api/modules"));
    const result = {
      generatedAt: new Date().toISOString(),
      status: matrix.every((entry) => entry.status !== "NOT_READY") && consoleErrors.length === 0 && hardFailures.length === 0 ? "PASS" : "PARTIAL",
      localStart: health.status === "ok" ? "PASS" : "FAIL",
      entries: matrix,
      consoleErrors,
      failedResponses: hardFailures,
      keyRecorded: false
    };

    writeFileSync(join(reportDir, "browser-smoke-matrix.json"), JSON.stringify(result, null, 2), "utf8");
    writeFileSync(join(reportDir, "browser-smoke-matrix.md"), markdown(result), "utf8");
    console.log(JSON.stringify({
      status: result.status,
      entries: result.entries.map((entry) => ({ id: entry.id, status: entry.status })),
      consoleErrors: result.consoleErrors.length,
      failedResponses: result.failedResponses.length
    }, null, 2));
    if (result.status !== "PASS") process.exitCode = 1;
  } finally {
    markProgress("closing browser");
    await browser.close();
    markProgress("stopping server");
    await server.stop();
    markProgress("removing temporary data");
    await removeTempDir(dataDir);
    markProgress("complete");
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
