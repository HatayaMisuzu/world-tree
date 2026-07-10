import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import { createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require("playwright"); } catch (localError) {
    const moduleDir = process.env.WORLD_TREE_PLAYWRIGHT_MODULE_DIR || "";
    if (!moduleDir) throw localError;
    return createRequire(join(moduleDir, "package.json"))("playwright");
  }
}

const { chromium } = loadPlaywright();
const reportDir = resolve(process.env.WT_VISUAL_QA_DIR || join("..", "world-tree-v0.5-visual-qa"));

async function capture(page, name) {
  await page.screenshot({ path: join(reportDir, `${name}.png`), fullPage: true });
}

async function inspectViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(80);
  return page.evaluate(() => ({
    width: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: document.body.scrollWidth > window.innerWidth + 1,
    mainVisible: Boolean(document.querySelector("#main")?.getBoundingClientRect().height),
    primaryLabels: [...document.querySelectorAll("#primaryNav strong")].map(node => node.textContent.trim()),
    mobileLabels: [...document.querySelectorAll("#mobileNav button span:last-child")].map(node => node.textContent.trim()),
    visibleHeading: document.querySelector("#main h1")?.textContent?.trim() || ""
  }));
}

async function run() {
  mkdirSync(reportDir, { recursive: true });
  const dataDir = await createTempDataDir("wt-visual-qa-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => consoleErrors.push(error.message));
    await page.goto(server.baseUrl, { waitUntil: "networkidle" });
    await page.locator(".product-home").waitFor();
    await capture(page, "home-desktop-1440");

    await page.locator('[data-view="experiences"]').first().click();
    await page.getByText("选择一种体验").waitFor();
    await capture(page, "experiences-desktop-1440");

    await page.locator('[data-view="creation"]').first().click();
    await page.getByText("把灵感变成可继续的世界").waitFor();
    await capture(page, "creation-desktop-1440");

    await page.locator('[data-view="library"]').first().click();
    await page.getByText("我的内容", { exact: true }).first().waitFor();
    await capture(page, "library-desktop-1440");

    await page.locator('[data-view="settings"]').first().click();
    await page.locator(".settings-readiness").waitFor();
    await capture(page, "settings-desktop-1440");

    await page.locator('[data-view="workbench"]').first().click();
    const viewports = [];
    for (const [width, height] of [[1440, 1000], [1024, 800], [768, 900], [390, 844]]) {
      viewports.push(await inspectViewport(page, width, height));
    }
    await capture(page, "home-mobile-390");

    const result = {
      generatedAt: new Date().toISOString(),
      status: consoleErrors.length === 0 && viewports.every(item => item.mainVisible && !item.horizontalOverflow) ? "PASS" : "FAIL",
      viewports,
      consoleErrors,
      expectedNavigation: ["首页", "体验", "我的内容", "创作", "设置"]
    };
    writeFileSync(join(reportDir, "visual-qa.json"), JSON.stringify(result, null, 2), "utf8");
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASS") process.exitCode = 1;
  } finally {
    await browser.close();
    await server.stop();
    await removeTempDir(dataDir);
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
