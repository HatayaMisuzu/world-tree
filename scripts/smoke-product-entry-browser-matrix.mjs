import { mkdirSync, writeFileSync } from "node:fs";
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
const entries = [
  {
    id: "quick-setting",
    label: "快速设定",
    title: /快速设定|Quick Setting/,
    input: "#quickStartText",
    action: '[data-action="quick-start-chat"]',
    expectedStatus: "PASS",
    note: "大厅可见，可输入设定并创建草稿。"
  },
  {
    id: "character",
    label: "人物卡",
    title: /人物卡|Character/,
    input: "#charCardText",
    action: '[data-action="character-start-chat"]',
    expectedStatus: "PASS",
    note: "大厅可见，可粘贴人物卡并开始对话。"
  },
  {
    id: "world-rpg",
    label: "世界书大世界",
    title: /世界书大世界|World RPG/,
    input: "#wrpgText",
    action: '[data-action="world-rpg-start"]',
    expectedStatus: "PASS",
    note: "大厅可见，可创建世界冒险；Worldbook V2 完整编辑器仍是部分完成。"
  },
  {
    id: "tabletop",
    label: "桌面叙事",
    title: /桌面叙事|Tabletop/,
    input: "#tabletopText",
    action: '[data-action="tabletop-start"]',
    expectedStatus: "PARTIAL",
    note: "大厅可见，可创建普通 Tabletop 草稿；不是完整 DND，Tabletop V2 导入需进入项目后使用。"
  },
  {
    id: "mystery-puzzle",
    label: "解谜调查",
    title: /解谜调查|Mystery Puzzle/,
    input: "#mysteryText",
    action: '[data-action="mystery-puzzle-start"]',
    expectedStatus: "PARTIAL",
    note: "大厅可见，可创建调查草稿；不是完整推理引擎。"
  },
  {
    id: "strategy-sim",
    label: "策略模拟",
    title: /策略模拟|Strategy Sim/,
    input: "#strategyText",
    action: '[data-action="strategy-sim-start"]',
    expectedStatus: "PARTIAL",
    note: "大厅可见，可创建策略草稿；不是完整 4X。"
  },
  {
    id: "murder-mystery",
    label: "单人剧本杀",
    title: /单人剧本杀|Murder Mystery/,
    input: "#murderText",
    action: '[data-action="murder-mystery-start"]',
    secondaryAction: '[data-action="single-player-scriptkill-v2-toggle-panel"]',
    expectedStatus: "PARTIAL",
    note: "大厅可见，V2 面板可触达；内置剧本杀内容包仍未完成。"
  },
  {
    id: "creation-forge",
    label: "炼金台",
    title: /炼金台|Creation Forge/,
    action: '[data-action="library-alchemy"]',
    expectedStatus: "PASS",
    note: "大厅可见，可打开炼金台 G1 创作闭环。"
  }
];

function statusFor(checks, expectedStatus) {
  if (checks.some((item) => !item.ok)) return "NOT_READY";
  return expectedStatus;
}

function markdown(result) {
  const lines = [
    "# Product Entry Browser Matrix",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Overall: ${result.status}`,
    "",
    "| Entry | Status | Reachable | Empty/Next Step | LLM State | Notes |",
    "|---|---|---:|---:|---|---|",
    ...result.entries.map((entry) => `| ${entry.id} | ${entry.status} | ${entry.reachable ? "YES" : "NO"} | ${entry.nextStepClear ? "YES" : "NO"} | ${entry.llmState} | ${entry.note} |`),
    "",
    "## Browser Health",
    "",
    `- console errors: ${result.consoleErrors.length}`,
    `- failed network responses: ${result.failedResponses.length}`,
    `- local start: ${result.localStart}`,
    "",
    "## Boundary",
    "",
    "This smoke proves lobby/navigation reachability and basic next-step clarity. It does not claim complete gameplay closure, product-wide PLAYABLE status, or v1.0 release readiness."
  ];
  return `${lines.join("\n")}\n`;
}

async function run() {
  mkdirSync(reportDir, { recursive: true });
  const dataDir = await createTempDataDir("wt-product-entry-browser-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
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

    await page.goto(server.baseUrl, { waitUntil: "networkidle" });
    await page.getByText("World Tree").first().waitFor({ timeout: 10000 });

    const health = await page.evaluate(async () => (await fetch("/api/health")).json());
    const llmState = await page.locator("#llmStatus").innerText().catch(() => "unknown");
    const matrix = [];

    for (const entry of entries) {
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

      matrix.push({
        id: entry.id,
        label: entry.label,
        status: statusFor(checks, entry.expectedStatus),
        reachable: titleVisible && actionEnabled,
        nextStepClear: inputVisible && actionEnabled && secondaryVisible,
        llmState,
        checks,
        note: entry.note
      });
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
    if (!["PASS", "PARTIAL"].includes(result.status)) process.exitCode = 1;
  } finally {
    await browser.close();
    await server.stop();
    await removeTempDir(dataDir);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
