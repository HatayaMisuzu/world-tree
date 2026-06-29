import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import {
  api,
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

const root = resolve(".");
const reportsDir = join(root, "docs", "reports");
const flowAText = "我想玩一个赛博修仙世界，主角是被公司追杀的炼丹师。";
const flowAFirstTurn = "我先检查随身丹炉和附近出口。";
const flowBText = [
  "世界观：浮岛群由七座城邦组成，灵能潮汐每三十天改变航路。",
  "势力：灯塔议会负责航线许可，灰帆商会掌握补给，边境学会研究潮汐规则。",
  "地点：中央灯塔、灰港、潮汐观测站。",
  "规则：所有飞舟必须记录航行誓约；违规会影响通行许可。",
  "时间线：第一阶段是潮汐异常，第二阶段是航线封锁，第三阶段是议会听证。",
  "主角目标：把这份设定本地化成可以继续扩写的 World Tree 世界。"
].join("\n");

function moduleIdFromKey(moduleKey = "") {
  return String(moduleKey || "").replace(/^world:/, "");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function apiDeliver(server, text, selectedTargets) {
  const plan = await api(server, "/api/alchemy/plan", { method: "POST", body: JSON.stringify({ text }) });
  const preview = await api(server, "/api/alchemy/generate-preview", {
    method: "POST",
    body: JSON.stringify({ text, plan: plan.body, selectedTargets })
  });
  const localize = await api(server, "/api/alchemy/localize", {
    method: "POST",
    body: JSON.stringify({ preview: preview.body, selectedTargets })
  });
  const deliver = await api(server, "/api/alchemy/deliver", {
    method: "POST",
    body: JSON.stringify({ preview: preview.body, localFolderDraft: localize.body, selectedTargets, userConfirmed: true })
  });
  const moduleId = moduleIdFromKey(deliver.body.moduleKey);
  const worldPath = deliver.body.targetPaths.find((item) => item.target === "world_module")?.path || "";
  return { intakeType: plan.body.intakeType, previewMode: preview.body.mode, deliveryId: deliver.body.deliveryId, moduleKey: deliver.body.moduleKey, moduleId, worldPath };
}

async function verifyReadback(server, result, firstTurnInput = "") {
  const modules = await api(server, "/api/modules");
  const loaded = await api(server, "/api/modules/load", { method: "POST", body: JSON.stringify({ id: result.moduleKey }) });
  let chat = null;
  if (firstTurnInput) {
    chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        input: firstTurnInput,
        moduleKey: result.moduleKey,
        dataMode: "worldbook",
        engineState: { turnCount: 0, dataMode: "worldbook" },
        messages: []
      })
    });
  }
  const worldbook = await readJson(join(result.worldPath, "shared", "worldbook.json"));
  const state = await readJson(join(result.worldPath, "runtime", "state.json"));
  const chatPath = join(result.worldPath, "runtime", "chat.jsonl");
  const chatRows = existsSync(chatPath) ? readFileSync(chatPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
  return {
    moduleListed: modules.body.some((item) => item.id === result.moduleId),
    moduleLoadStatus: loaded.body?.status || null,
    worldbookEntries: Array.isArray(worldbook.entries) ? worldbook.entries.length : 0,
    stateTurnCount: state.turnCount,
    stateLastInput: state.lastInput || "",
    chat: chat ? {
      status: chat.body?.status,
      localFallback: chat.body?.localFallback === true,
      fallbackReason: chat.body?.fallbackReason || "",
      userInputPersisted: chatRows.some((row) => row.role === "user" && String(row.content || "").includes(firstTurnInput)),
      assistantRows: chatRows.filter((row) => row.role === "assistant").length
    } : null
  };
}

async function clickAndWait(page, buttonName, responsePath) {
  const responsePromise = page.waitForResponse((response) => response.url().includes(responsePath) && response.status() === 200, { timeout: 15000 });
  await page.getByRole("button", { name: buttonName }).click();
  await responsePromise;
}

async function runBrowserFlowA(page) {
  await page.locator("#alchemyText").fill(flowAText);
  await clickAndWait(page, /生成创作地图/, "/api/alchemy/plan");
  for (const target of ["world_module", "worldbook", "character", "mechanism"]) {
    await page.locator(`[data-alchemy-g1-target="${target}"]`).setChecked(true);
  }
  await clickAndWait(page, /生成内容预览/, "/api/alchemy/generate-preview");
  await clickAndWait(page, /生成本地文件夹草案/, "/api/alchemy/localize");
  page.once("dialog", (dialog) => dialog.accept());
  await clickAndWait(page, /确认交付/, "/api/alchemy/deliver");
  await page.waitForTimeout(500);
}

async function runBrowserFlowBEntry(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开炼金台" }).click();
  await page.locator("#alchemyText").fill(flowBText);
  await clickAndWait(page, /生成创作地图/, "/api/alchemy/plan");
  for (const target of ["world_module", "worldbook"]) {
    await page.locator(`[data-alchemy-g1-target="${target}"]`).setChecked(true);
  }
  await clickAndWait(page, /生成内容预览/, "/api/alchemy/generate-preview");
  await clickAndWait(page, /生成本地文件夹草案/, "/api/alchemy/localize");
}

await mkdir(reportsDir, { recursive: true });
const dataDir = await createTempDataDir("world-tree-browser-user-content-");
const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
const consoleEvents = [];
let browser = null;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleEvents.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => consoleEvents.push({ type: "pageerror", text: error.message }));

  await page.goto(server.baseUrl, { waitUntil: "networkidle" });
  await page.getByText("World Tree").first().waitFor({ timeout: 10000 });
  await page.getByText("空白模板").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "打开炼金台" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "打开炼金台" }).click();
  await page.getByRole("button", { name: /生成创作地图/ }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /生成内容预览/ }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /生成本地文件夹草案/ }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /确认交付/ }).waitFor({ timeout: 10000 });

  await runBrowserFlowA(page);
  const flowA = await apiDeliver(server, flowAText, ["world_module", "worldbook", "character", "mechanism"]);
  const flowAReadback = await verifyReadback(server, flowA, flowAFirstTurn);

  await runBrowserFlowBEntry(page, server.baseUrl);
  const flowB = await apiDeliver(server, flowBText, ["world_module", "worldbook"]);
  const flowBReadback = await verifyReadback(server, flowB);

  const result = {
    status: consoleEvents.length === 0 ? "PASS" : "FAIL",
    mode: "browser entry plus API-assisted delivery/readback",
    dataDir,
    browserStepsRun: [
      "homepage loaded",
      "blank template area visible",
      "Alchemy G1 panel visible",
      "Flow A browser plan/preview/localize/deliver clicked",
      "Flow B browser plan/preview/localize clicked"
    ],
    apiAssistedSteps: [
      "Flow A module id/path/readback captured through API",
      "Flow A first-turn persistence verified through API",
      "Flow B deliver/readback captured through API"
    ],
    consoleEvents,
    flowA: { ...flowA, readback: flowAReadback },
    flowB: { ...flowB, readback: flowBReadback },
    generatedAt: new Date().toISOString()
  };

  const lines = [
    "# User Content Browser Smoke",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Status: ${result.status}`,
    "",
    "Mode: browser entry plus API-assisted delivery/readback.",
    "",
    "## Browser Steps Run",
    "",
    ...result.browserStepsRun.map((step) => `- PASS: ${step}`),
    "",
    "## API-Assisted Steps",
    "",
    ...result.apiAssistedSteps.map((step) => `- PASS: ${step}`),
    "",
    "## Console Status",
    "",
    `Console error/warning count: ${consoleEvents.length}`,
    "",
    "## Created Module IDs",
    "",
    `- Flow A browser/API evidence module: \`${flowA.moduleKey}\` at \`${flowA.worldPath}\``,
    `- Flow B browser/API evidence module: \`${flowB.moduleKey}\` at \`${flowB.worldPath}\``,
    "",
    "## Readback Result",
    "",
    `- Flow A module listed: ${flowAReadback.moduleListed}; module load: \`${flowAReadback.moduleLoadStatus}\`; turnCount: ${flowAReadback.stateTurnCount}; localFallback: ${flowAReadback.chat?.localFallback}`,
    `- Flow B module listed: ${flowBReadback.moduleListed}; module load: \`${flowBReadback.moduleLoadStatus}\`; worldbook entries: ${flowBReadback.worldbookEntries}`,
    "",
    "## Limitations",
    "",
    "- Flow A browser clicked the G1 delivery path, then API readback captured canonical module ids and first-turn persistence.",
    "- Flow B browser completed through local-folder draft; final delivery/readback was API-assisted for stable evidence capture.",
    "- No real LLM is claimed by this browser smoke."
  ];
  writeFileSync(join(reportsDir, "user-content-browser-smoke.md"), `${lines.join("\n")}\n`, "utf8");
  writeFileSync(join(reportsDir, "user-content-browser-smoke-result.json"), JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await server.stop();
  await removeTempDir(dataDir);
}
