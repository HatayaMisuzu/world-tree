import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { randomPort } from "./helpers/server-process.js";

async function runScript(env) {
  const child = spawn(process.execPath, ["scripts/smoke-first-play.mjs"], {
    cwd: ".",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", chunk => { stderr += chunk.toString("utf8"); });
  const [code] = await once(child, "exit");
  return { code, stdout, stderr };
}

async function startFakeLlm() {
  const port = randomPort();
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString("utf8"); });
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        const wantsJson = parsed.response_format?.type === "json_object";
        const content = wantsJson
          ? JSON.stringify({
              intent: "action",
              emotionalSubtext: "玩家正在追查雾铃塔与旧锚链齿轮的关系",
              engagementDelta: 1,
              tensionDelta: 0,
              fatigueDelta: 0,
              curiosityDelta: 1,
              pacingSuggestion: "hold",
              pressureSuggestion: "low",
              eventIntensitySuggestion: "light",
              sceneGoal: "推进云上蒸汽城调查",
              suggestedMustInclude: ["雾铃塔"],
              suggestedMustNotInclude: [],
              emotionalTarget: { increase: ["curiosity"], decrease: [] }
            })
          : "【叙事】\n雾铃塔的第七声仍在黄铜港上空回荡，旧锚链齿轮在你掌心泛起微热。米拉压低声音解释，第七锚塔的压力记录被人改过，但她能带你穿过锅炉廊查看原始阀门。远处巡云船的汽笛提醒你，云墙正在靠近，下一步选择会决定你先追查工会、港务局，还是匿名委托本身。\n【状态】\nscene: 黄铜港";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    async stop() {
      server.close();
      await once(server, "close");
    }
  };
}

test("smoke:first-play reports BLOCKED_BY_CREDENTIALS without key", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "wt-first-play-blocked-"));
  try {
    const result = await runScript({
      WT_SMOKE_REPORT_DIR: reportDir,
      WT_SMOKE_BASE_URL: "",
      WT_SMOKE_MODEL: "",
      WT_SMOKE_KEY: ""
    });
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(await readFile(join(reportDir, "first-play-smoke-latest.json"), "utf8"));
    assert.equal(report.status, "BLOCKED_BY_CREDENTIALS");
  } finally {
    await rm(reportDir, { recursive: true, force: true });
  }
});

test("smoke:first-play can run three turns against a local fake LLM", async () => {
  const reportDir = await mkdtemp(join(tmpdir(), "wt-first-play-fake-"));
  const fake = await startFakeLlm();
  try {
    const result = await runScript({
      WT_SMOKE_REPORT_DIR: reportDir,
      WT_SMOKE_BASE_URL: fake.baseUrl,
      WT_SMOKE_MODEL: "fake-model",
      WT_SMOKE_KEY: "fake-key"
    });
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(await readFile(join(reportDir, "first-play-smoke-latest.json"), "utf8"));
    assert.equal(report.status, "PASS");
    assert.equal(report.turns.length, 3);
    assert.equal(report.assertions.some(item => item.id === "chat_jsonl_six_records" && item.ok), true);
  } finally {
    await fake.stop();
    await rm(reportDir, { recursive: true, force: true });
  }
});
