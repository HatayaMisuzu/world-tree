import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "../tests/integration/helpers/server-process.js";
import { summarizeUsageRecords } from "../src/core/llm/usage-meter.js";

const root = resolve(".");
const reportDir = resolve(process.env.WT_SMOKE_REPORT_DIR || join(root, "docs", "reports"));
const markdownReportPath = join(reportDir, "first-play-smoke-latest.md");
const jsonReportPath = join(reportDir, "first-play-smoke-latest.json");
const demoId = process.env.WT_SMOKE_EXAMPLE_ID || "demo-world-cloud-steam-city";
const firstTerm = "雾铃塔";
const actions = [
  "我站在黄铜港的雾风里，先检查匿名委托附带的旧锚链齿轮，再询问附近有没有人听见雾铃塔第七次敲响。",
  "我去找米拉·阀匠，请她带我看第七锚塔最近的压力记录，并留意她是否隐瞒了什么。",
  "我回顾雾铃塔、旧锚链齿轮和第七锚塔压力记录之间的联系，然后决定下一步调查方向。"
];

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function moduleIdFromKey(moduleKey = "") {
  return String(moduleKey || "").replace(/^world:/, "");
}

function writeReport(result) {
  const lines = [
    "# First Play Real LLM Smoke",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Status: ${result.status}`,
    "",
    "## Provider",
    "",
    `- baseUrl: \`${result.provider?.baseUrl || "not configured"}\``,
    `- model: \`${result.provider?.model || "not configured"}\``,
    "- key: not recorded",
    "",
    "## Demo",
    "",
    `- exampleId: \`${result.exampleId || demoId}\``,
    `- moduleKey: \`${result.moduleKey || ""}\``,
    "",
    "## Assertions",
    "",
    ...(result.assertions || []).map(item => `- ${item.ok ? "PASS" : "FAIL"} ${item.id}: ${item.detail}`),
    "",
    "## Turns",
    "",
    ...(result.turns || []).map(turn => `- Turn ${turn.turn}: status=${turn.status}; narrativeChars=${turn.narrativeChars}; persistedTurnId=${turn.persistedTurnId || ""}`),
    "",
    "## Usage",
    "",
    `- observed provider calls with usage: ${result.usage?.stageCount || 0}`,
    `- prompt tokens: ${result.usage?.promptTokens || 0}`,
    `- completion tokens: ${result.usage?.completionTokens || 0}`,
    `- total tokens: ${result.usage?.totalTokens || 0}`,
    `- cache hit tokens: ${result.usage?.cacheHitTokens || 0}`,
    `- reasoning tokens: ${result.usage?.reasoningTokens || 0}`,
    "",
    "## Notes",
    "",
    result.note || ""
  ];
  writeFileSync(markdownReportPath, `${lines.join("\n")}\n`, "utf8");
  writeFileSync(jsonReportPath, JSON.stringify(result, null, 2), "utf8");
}

async function readChatRecords(dataDir, moduleKey) {
  const moduleId = moduleIdFromKey(moduleKey);
  const chatPath = join(dataDir, "engine", "worlds", moduleId, "runtime", "chat.jsonl");
  const text = existsSync(chatPath) ? await readFile(chatPath, "utf8") : "";
  return text.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
}

function blocked(reason, provider) {
  const result = {
    status: "BLOCKED_BY_CREDENTIALS",
    reason,
    provider,
    exampleId: demoId,
    assertions: [
      { id: "credentials", ok: false, detail: reason },
      { id: "no_fake_pass", ok: true, detail: "No real LLM PASS claimed without WT_SMOKE_BASE_URL/WT_SMOKE_MODEL/WT_SMOKE_KEY." }
    ],
    turns: [],
    note: "Real LLM Flow remains BLOCKED_BY_CREDENTIALS. This report is a gate record, not a PASS.",
    generatedAt: new Date().toISOString()
  };
  writeReport(result);
  console.log(JSON.stringify(result, null, 2));
}

function assertPass(assertions, id, ok, detail) {
  assertions.push({ id, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${id}: ${detail}`);
}

await mkdir(reportDir, { recursive: true });

const provider = {
  id: envValue("WT_SMOKE_PROVIDER_ID", "WORLD_TREE_LLM_PROVIDER") || "openai-compatible",
  baseUrl: envValue("WT_SMOKE_BASE_URL", "WORLD_TREE_LLM_BASE_URL", "LLM_BASE_URL"),
  model: envValue("WT_SMOKE_MODEL", "WORLD_TREE_LLM_MODEL", "LLM_MODEL")
};
const apiKey = envValue("WT_SMOKE_KEY", "WORLD_TREE_LLM_API_KEY", "LLM_API_KEY");

if (!provider.baseUrl || !provider.model || !apiKey) {
  blocked("missing WT_SMOKE_BASE_URL/WT_SMOKE_MODEL/WT_SMOKE_KEY", provider);
} else {
  const dataDir = await createTempDataDir("world-tree-first-play-");
  const server = await startWorldTreeServer({ dataDir });
  const assertions = [];
  const turns = [];
  const usageRecords = [];
  try {
    await api(server, "/api/config", {
      method: "POST",
      body: JSON.stringify({
        llmBaseUrl: provider.baseUrl,
        llmModel: provider.model,
        llmTimeoutMs: Number(process.env.WT_SMOKE_TIMEOUT_MS || 60000)
      })
    });
    await api(server, "/api/secrets/llm", {
      method: "POST",
      body: JSON.stringify({ id: "first-play-smoke", label: "First play smoke", value: apiKey })
    });

    const install = await api(server, "/api/examples/install", {
      method: "POST",
      body: JSON.stringify({ id: demoId })
    });
    assertPass(assertions, "install_demo_world", install.body?.status === "ok", `install status ${install.body?.status || install.status}`);
    const moduleKey = install.body.module.id;
    const messages = [];

    for (let i = 0; i < actions.length; i += 1) {
      const input = actions[i];
      const contextContainsFirstTerm = i < 2 || messages.some(message => String(message.content || "").includes(firstTerm));
      const chat = await api(server, "/api/llm/chat", {
        method: "POST",
        body: JSON.stringify({
          input,
          moduleKey,
          modeId: "world-rpg",
          dataMode: "worldbook",
          engineState: { dataMode: "worldbook", emotionState: { engagement: 6, tension: 5, fatigue: 4, curiosity: 7 } },
          messages
        })
      });
      const narrative = String(chat.body?.narrative || "");
      turns.push({
        turn: i + 1,
        status: chat.body?.status || "missing",
        narrativeChars: narrative.length,
        localFallback: chat.body?.localFallback === true,
        persistedTurnId: chat.body?.persistedIds?.turnId || "",
        usage: chat.body?.usage?.turn || null,
        contextContainsFirstTerm
      });
      if (chat.body?.usage?.turn) usageRecords.push({ usage: chat.body.usage.turn });
      assertPass(assertions, `turn_${i + 1}_status_ok`, chat.body?.status === "ok", `status=${chat.body?.status}; code=${chat.body?.code || ""}`);
      assertPass(assertions, `turn_${i + 1}_not_local_fallback`, chat.body?.localFallback !== true, "local fallback is not real LLM evidence");
      assertPass(assertions, `turn_${i + 1}_narrative_length`, narrative.length >= 80, `narrative length ${narrative.length}`);
      if (i === 2) assertPass(assertions, "third_turn_context_memory_minimum", contextContainsFirstTerm, `messages before turn 3 include ${firstTerm}`);
      messages.push({ role: "user", content: input }, { role: "assistant", content: narrative });
    }

    const records = await readChatRecords(dataDir, moduleKey);
    assertPass(assertions, "chat_jsonl_six_records", records.length === 6, `chat.jsonl record count ${records.length}`);
    const evidenceText = JSON.stringify({ turns, records });
    const forbidden = [/hiddenTruth/i, /gm_only/i, /system_only/i, /api.?key/i, /authorization/i, /\b[A-Za-z]:\\/];
    const hit = forbidden.find(pattern => pattern.test(evidenceText));
    assertPass(assertions, "no_hidden_truth_or_secret_leak", !hit, hit ? `matched ${hit}` : "no forbidden evidence markers");

    const result = {
      status: "PASS",
      provider,
      exampleId: demoId,
      moduleKey,
      assertions,
      turns,
      usage: summarizeUsageRecords(usageRecords),
      usageCompleteness: usageRecords.length === actions.length ? "complete_for_chat_turns" : "partial_usage_missing_from_some_chat_turns",
      note: "PASS requires a real provider key supplied through environment variables. Human playtest and screen recording are still HUMAN_VALIDATION_REQUIRED.",
      generatedAt: new Date().toISOString()
    };
    writeReport(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      provider,
      exampleId: demoId,
      assertions,
      turns,
      note: error?.message || String(error),
      generatedAt: new Date().toISOString()
    };
    writeReport(result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
}
