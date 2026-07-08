import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

async function run() {
  const dataDir = await createTempDataDir("wt-v2-product-browser-smoke-");
  const evidenceDir = resolve(process.env.WT_BROWSER_MATRIX_REPORT_DIR || join("..", "world-tree-product-usable-closure-output"), `v2-product-shell-browser-${Date.now()}`);
  mkdirSync(evidenceDir, { recursive: true });
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  const browser = await chromium.launch();
  const evidence = {
    status: "ok",
    browser: "chromium",
    scope: "shell load and browser-context API access only; not product entry UI closure",
    flows: { uiShell: "partial", apiFromBrowserContext: "partial" }
  };
  try {
    const page = await browser.newPage();
    const consoleEvents = [];
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type())) consoleEvents.push({ type: msg.type(), text: msg.text() });
    });
    await page.goto(server.baseUrl, { waitUntil: "domcontentloaded" });
    await assert.doesNotReject(() => page.getByText("World Tree").first().waitFor({ timeout: 5000 }));
    const health = await page.evaluate(async () => (await fetch("/api/health")).json());
    assert.equal(health.status, "ok");
    evidence.consoleEvents = consoleEvents;
    evidence.flows.uiShell = "PASS";
    evidence.flows.apiFromBrowserContext = "PASS";
  } finally {
    await browser.close();
    await server.stop();
    await removeTempDir(dataDir);
  }
  const evidencePath = join(evidenceDir, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(`V2 product shell browser smoke: PASS ${evidencePath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
