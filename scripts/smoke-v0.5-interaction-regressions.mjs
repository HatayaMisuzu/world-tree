import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import { createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require("playwright"); } catch (error) {
    const moduleDir = process.env.WORLD_TREE_PLAYWRIGHT_MODULE_DIR || "";
    if (!moduleDir) throw error;
    return createRequire(join(moduleDir, "package.json"))("playwright");
  }
}

const { chromium } = loadPlaywright();
const reportDir = resolve(process.env.WT_INTERACTION_REGRESSION_DIR || join("..", "world-tree-v0.5-interaction-regressions"));
const dataDir = await createTempDataDir("wt-v05-interactions-");
const charactersDir = join(dataDir, "engine", "characters");
for (const [id, name, description, tags] of [
  ["alice", "Alice", "A careful guide for the northern road.", ["guide", "north"]],
  ["bob", "Bob", "A patient keeper of the harbor archive.", ["keeper", "harbor"]]
]) {
  const dir = join(charactersDir, id, "runtime");
  await mkdir(dir, { recursive: true });
  await writeFile(join(charactersDir, id, "card.json"), JSON.stringify({ name, description, tags, format: "native" }, null, 2), "utf8");
  await writeFile(join(dir, "chat.jsonl"), "", "utf8");
}

const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
const browser = await chromium.launch({ headless: true });
const assertions = [];
const consoleErrors = [];
const record = (id, ok, detail) => {
  assertions.push({ id, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${id}: ${detail}`);
};

try {
  await mkdir(reportDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(error.message));
  await page.goto(server.baseUrl, { waitUntil: "networkidle" });

  await page.locator('#primaryNav [data-view="library"]').click();
  await page.locator('[data-library-tab="characters"]').click();
  await page.locator("#characterSearch").waitFor();
  const allCards = page.locator("[data-character-id]");
  record("character_cards_loaded", await allCards.count() === 2, `count=${await allCards.count()}`);
  const search = page.locator("#characterSearch");
  await search.fill("alice");
  const focused = await page.evaluate(() => document.activeElement?.id);
  const visibleAfterFilter = await page.locator("[data-character-id]:visible").count();
  record("character_search_keeps_focus", focused === "characterSearch", `active=${focused}`);
  record("character_search_filters_locally", visibleAfterFilter === 1 && await allCards.filter({ hasText: "Alice" }).isVisible(), `visible=${visibleAfterFilter}`);
  await search.fill("no-such-character");
  record("character_search_empty_state", await page.locator("[data-character-search-empty]").isVisible(), "empty state visible");
  await search.fill("");
  record("character_search_clear_restores", await page.locator("[data-character-id]:visible").count() === 2, "all cards visible after clear");

  await page.locator('#primaryNav [data-view="settings"]').click();
  await page.locator(".settings-readiness").waitFor();
  await page.locator("#connTemplate").selectOption("mock");
  await page.locator("#connLabel").fill("Local regression model");
  await page.locator("#connBaseUrl").fill("mock://local");
  await page.locator("#connModel").fill("mock-model");
  await page.locator("#connKey").fill("");
  await page.locator('[data-action="save-connection"]').click();
  await page.locator(".settings-readiness strong.status-attention").first().waitFor();
  record("model_saved_state", await page.locator(".settings-readiness strong.status-attention").first().count() === 1, "saved credentials wait for an explicit test");
  const keyStatus = page.locator("[data-model-api-key-status]");
  record("local_provider_key_not_saved", (await keyStatus.textContent()).trim() === "未保存密钥", `status=${await keyStatus.textContent()}`);
  await page.locator('[data-action="test-connection"]').first().click();
  await page.locator(".settings-readiness strong.status-good").first().waitFor();
  record("model_connected_state", await page.locator(".settings-readiness strong.status-good").first().count() === 1, "successful connection test becomes connected");
  await page.evaluate(() => updateHealth());
  record("model_connected_survives_health_refresh", (await page.locator(".settings-readiness strong").first().textContent()).trim() === "已连接", "health refresh preserves the authoritative test result");

  await page.locator('#primaryNav [data-view="experiences"]').click();
  await page.locator("#tabletopText").fill("A quiet tavern beside a foggy road.");
  await page.locator('[data-action="tabletop-start"]').click();
  await page.locator(".experience-workspace").waitFor();
  await page.locator("details.mode-play-panel").evaluate(node => { node.open = true; });
  await page.locator("#tabletopV2ImportText").fill('{"title":"Regression Tabletop","sourceType":"quick_start","playerBrief":{"premise":"A foggy road."}}');
  await page.locator('[data-action="tabletop-v2-start"]').click();
  const tabletopSave = page.locator('[data-action="tabletop-v2-save"]');
  await tabletopSave.waitFor({ state: "attached" });
  await tabletopSave.evaluate(button => { const details = button.closest("details"); if (details) details.open = true; });
  await tabletopSave.waitFor();
  await page.locator("#chatInput").fill("I inspect the tavern window.");
  await page.locator('[data-action="chat-send"]').click();
  await page.locator('[data-action="chat-send"]').waitFor({ timeout: 15000 });
  record("tabletop_turn_render_cleanup", await page.locator('[data-action="chat-stop"]').count() === 0 && await page.locator("#saveStatus.pending").count() === 0, "send button restored and save status is not pending");
  record("tabletop_turn_visible", await page.locator('.chat-message[data-message-kind="assistant"]').count() >= 1, "completed tabletop narrative is visible");

  record("browser_console_clean", consoleErrors.length === 0, `${consoleErrors.length} console errors`);
  const result = { status: "PASS", generatedAt: new Date().toISOString(), assertions, consoleErrors, keyRecorded: false };
  await writeFile(join(reportDir, "interaction-regressions.json"), JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { status: "FAIL", generatedAt: new Date().toISOString(), assertions, consoleErrors, error: error.message, keyRecorded: false };
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "interaction-regressions.json"), JSON.stringify(result, null, 2), "utf8");
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.stop();
  await removeTempDir(dataDir);
}
