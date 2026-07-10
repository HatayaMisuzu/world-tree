import { once } from "node:events";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

import { api, createTempDataDir, randomPort, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require("playwright"); } catch (localError) {
    const moduleDir = process.env.WORLD_TREE_PLAYWRIGHT_MODULE_DIR || "";
    if (!moduleDir) throw localError;
    return createRequire(join(moduleDir, "package.json"))("playwright");
  }
}

async function startFakeLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    req.on("data", chunk => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      const serialized = JSON.stringify(parsed);
      if (parsed.stream) {
        const parts = serialized.includes("停止测试")
          ? ["【叙事】\n雾铃塔的钟声刚刚响起，", "这段内容不应在停止后抵达。"]
          : ["【叙事】\n雾铃塔的钟声沿着云桥亮起，", "米拉指向第七锚塔的压力记录。", "旧锚链齿轮在掌心微微发热。", "\n【状态建议】\nscene: 云桥"];
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
        const send = index => {
          if (res.destroyed) return;
          if (index >= parts.length) { res.end("data: [DONE]\n\n"); return; }
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: parts[index] } }] })}\n\n`);
          setTimeout(() => send(index + 1), serialized.includes("停止测试") ? 1400 : 12);
        };
        send(0);
        return;
      }
      const wantsJson = parsed.response_format?.type === "json_object";
      const content = wantsJson
        ? JSON.stringify({ intent: "action", emotionalSubtext: "继续调查", engagementDelta: 1, tensionDelta: 0, fatigueDelta: 0, curiosityDelta: 1, pacingSuggestion: "hold", pressureSuggestion: "low", eventIntensitySuggestion: "light", sceneGoal: "调查第七锚塔", suggestedMustInclude: ["雾铃塔"], suggestedMustNotInclude: [], emotionalTarget: { increase: ["curiosity"], decrease: [] } })
        : "【叙事】\n雾铃塔的钟声沿着云桥亮起，米拉指向第七锚塔的压力记录。";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } }));
    });
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return { baseUrl: `http://127.0.0.1:${port}/v1`, async stop() { server.close(); await once(server, "close"); } };
}

function record(assertions, id, ok, detail) {
  assertions.push({ id, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${id}: ${detail}`);
}

const { chromium } = loadPlaywright();
const reportDir = resolve(process.env.WT_GOLDEN_PATH_DIR || join("..", "world-tree-v0.5-golden-path"));
const dataDir = await createTempDataDir("wt-golden-path-");
const fakeLlm = await startFakeLlm();
const worldTree = await startWorldTreeServer({ dataDir });
const browser = await chromium.launch({ headless: true });
const assertions = [];
const consoleErrors = [];

try {
  await mkdir(reportDir, { recursive: true });
  await api(worldTree, "/api/connections", {
    method: "POST",
    body: JSON.stringify({ action: "upsert", setDefault: true, profile: { id: "golden-path", label: "Golden path", baseUrl: fakeLlm.baseUrl, model: "fake-model", apiKey: "fake-key" } })
  });
  const installed = await api(worldTree, "/api/examples/install", { method: "POST", body: JSON.stringify({ id: "demo-world-cloud-steam-city" }) });
  const moduleKey = installed.body?.module?.id || "";
  record(assertions, "example_installed", installed.body?.status === "ok" && Boolean(moduleKey), `module=${moduleKey}`);

  const moduleId = moduleKey.replace(/^world:/, "");
  const proposalDir = join(dataDir, "engine", "worlds", moduleId, "branches", "main", "runtime");
  await mkdir(proposalDir, { recursive: true });
  await appendFile(join(proposalDir, "world-proposals.jsonl"), `${JSON.stringify({ id: "golden-weather", title: "让云桥迎来短暂晴光", summary: "天气变化等待玩家确认", targetFile: "shared/world_state.json", patch: { merge: { weather: "clear" } }, status: "pending", impactLevel: "minor", reversible: true, requiresSecondConfirm: false })}\n`, "utf8");

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(worldTree.baseUrl, { waitUntil: "networkidle" });
  await page.locator(`button[data-module-id="${moduleKey}"][data-action="load-module-from-list"]`).first().click();
  await page.locator(".experience-workspace").waitFor();

  const actions = ["我检查旧锚链齿轮。", "我询问米拉压力记录。", "我决定前往第七锚塔。"];
  for (let index = 0; index < actions.length; index += 1) {
    await page.locator("#chatInput").fill(actions[index]);
    await page.locator('[data-action="chat-send"]').click();
    await page.locator('[data-action="chat-send"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(expected => document.querySelectorAll('.chat-message[data-message-kind="assistant"]').length >= expected, index + 1);
  }
  record(assertions, "three_streamed_turns", await page.locator('.chat-message[data-message-kind="assistant"]').count() === 3, "three completed world responses visible");
  record(assertions, "automatic_save_visible", (await page.locator("#saveStatus").innerText()).includes("已保存"), "top bar confirms persisted state");
  const historyBeforeHome = await api(worldTree, `/api/modules/${encodeURIComponent(moduleKey)}/history?limit=80`);
  const persistedBeforeHome = historyBeforeHome.body?.messages || [];
  record(assertions, "three_turns_persisted", persistedBeforeHome.filter(message => message.role === "assistant").length >= 3, `roles=${persistedBeforeHome.map(message => message.role).join(",")}`);

  const kernelPanel = page.locator("[data-kernel-panel]");
  await kernelPanel.evaluate(node => { node.open = true; });
  record(assertions, "proposal_visible", await page.locator('[data-proposal-id="golden-weather"]').count() === 1, "pending world change is reviewable in context");
  await page.locator('[data-proposal-id="golden-weather"] [data-action="kernel-approve-proposal"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-proposal-id="golden-weather"]'));
  record(assertions, "proposal_confirmed", true, "proposal left pending view after explicit confirmation");

  await page.locator('#primaryNav [data-view="workbench"]').click();
  await page.locator(".product-home").waitFor();
  record(assertions, "returned_home", true, "global Home returns to decision page");
  await page.locator(`button[data-module-id="${moduleKey}"][data-action="load-module-from-list"]`).first().click();
  await page.locator(".experience-workspace").waitFor();
  const restoredResponses = await page.locator('.chat-message[data-message-kind="assistant"]').count();
  record(assertions, "continued_with_history", restoredResponses >= 3, `${restoredResponses} completed responses restored from server history`);

  await page.locator('[data-action="export-worldpack"]').click();
  await page.locator('[data-action="download-worldpack"]').waitFor();
  record(assertions, "worldpack_prepared", true, "export is ready for explicit download");

  const abortInput = "停止测试：只保留当前片段";
  await page.locator("#chatInput").fill(abortInput);
  await page.locator('[data-action="chat-send"]').click();
  await page.getByText("雾铃塔的钟声刚刚响起").waitFor({ timeout: 10000 });
  await page.locator('[data-action="chat-stop"]').click();
  await page.getByText("已中止 · 未保存").waitFor();
  record(assertions, "partial_stream_labeled", await page.getByText("仅在当前页面保留").isVisible(), "partial fragment boundary is explicit");
  await page.locator('[data-action="retry-partial"]').click();
  record(assertions, "partial_retry_restores_input", await page.locator("#chatInput").inputValue() === abortInput, "original action restored without duplicate auto-send");

  const history = await api(worldTree, `/api/modules/${encodeURIComponent(moduleKey)}/history?limit=80`);
  const persistedText = JSON.stringify(history.body?.messages || []);
  record(assertions, "partial_not_persisted_as_done", !persistedText.includes("只保留当前片段") && !persistedText.includes("钟声刚刚响起"), "aborted turn absent from completed server history");
  record(assertions, "no_browser_errors", consoleErrors.length === 0, `${consoleErrors.length} console errors`);

  await page.screenshot({ path: join(reportDir, "experience-golden-path.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ overflow: document.body.scrollWidth > window.innerWidth + 1, composerVisible: Boolean(document.querySelector("#chatInput")?.getBoundingClientRect().height), navItems: document.querySelectorAll("#mobileNav button").length }));
  record(assertions, "mobile_workspace", !mobile.overflow && mobile.composerVisible && mobile.navItems === 5, JSON.stringify(mobile));
  await page.waitForTimeout(3400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(reportDir, "experience-golden-mobile.png"), fullPage: false });
  const result = { status: "PASS", generatedAt: new Date().toISOString(), moduleKey, assertions, consoleErrors, keyRecorded: false };
  await writeFile(join(reportDir, "experience-golden-path.json"), JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { status: "FAIL", generatedAt: new Date().toISOString(), assertions, consoleErrors, error: error.message, keyRecorded: false };
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "experience-golden-path.json"), JSON.stringify(result, null, 2), "utf8");
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  await worldTree.stop();
  await fakeLlm.stop();
  await removeTempDir(dataDir);
}
