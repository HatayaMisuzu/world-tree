import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

const dataDir = await createTempDataDir("world-tree-a11y-");
const server = await startWorldTreeServer({ dataDir });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const failures = [];

try {
  await page.goto(server.baseUrl, { waitUntil: "networkidle" });
  const views = new Map([
    ["workbench", "首页"], ["experiences", "体验"], ["library", "我的内容"], ["creation", "创作"], ["settings", "设置"]
  ]);
  for (const [view, expectedTitle] of views) {
    const control = page.locator(`#primaryNav [data-view="${view}"]`);
    if (await control.count()) {
      await control.click();
      await page.locator("#main").waitFor({ state: "visible" });
      await page.waitForFunction((expected) => document.querySelector("#viewTitle")?.textContent?.trim() === expected, expectedTitle);
    } else failures.push(`${view}: primary navigation control is missing`);
    const title = (await page.locator("#viewTitle").textContent())?.trim();
    if (title !== expectedTitle) failures.push(`${view}: expected view title ${expectedTitle}, found ${title}`);
    const h1Count = await page.locator("h1").count();
    if (h1Count !== 1) failures.push(`${view}: expected exactly one h1, found ${h1Count}: ${(await page.locator("h1").allTextContents()).join(" | ")}`);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const violation of result.violations.filter((item) => ["serious", "critical"].includes(item.impact))) {
      const targets = violation.nodes.slice(0, 5).flatMap((node) => node.target).join(", ");
      failures.push(`${view}: ${violation.id} (${violation.impact}) - ${violation.help}; targets: ${targets}`);
    }
  }

  const skipLink = page.locator(".skip-link");
  await skipLink.focus();
  if (!(await skipLink.isVisible())) failures.push("skip link is not visible when focused");
  await skipLink.press("Enter");
  if ((await page.evaluate(() => document.activeElement?.id)) !== "main") failures.push("skip link does not move focus to main content");
} finally {
  await browser.close();
  await server.stop();
  await removeTempDir(dataDir);
}

if (failures.length) {
  console.error("Accessibility audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Accessibility audit: PASS (5 primary views, axe serious/critical, headings, skip link)");
