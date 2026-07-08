import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "../tests/integration/helpers/server-process.js";

const root = resolve(".");
const reportsDir = join(root, "docs", "reports");
const reportPath = join(reportsDir, "user-content-real-llm-smoke.md");
const resultPath = join(reportsDir, "user-content-real-llm-smoke-result.json");
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

function writeReport(result) {
  const provider = result.provider || {};
  const lines = [
    "# User Content Real LLM Smoke",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Status: ${result.status}`,
    "",
    "## Provider Profile",
    "",
    `- baseUrl: \`${provider.baseUrl || "not configured"}\``,
    `- model: \`${provider.model || "not configured"}\``,
    "- secret: not recorded",
    "",
    "## Flow A Evidence",
    "",
    result.flowA ? `- intakeType: \`${result.flowA.intakeType}\`; preview.mode: \`${result.flowA.previewMode}\`; moduleKey: \`${result.flowA.moduleKey}\`; localFallback: ${result.flowA.chat?.localFallback}` : "- Not run.",
    "",
    "## Flow B Evidence",
    "",
    result.flowB ? `- intakeType: \`${result.flowB.intakeType}\`; preview.mode: \`${result.flowB.previewMode}\`; moduleKey: \`${result.flowB.moduleKey}\`; worldbook entries: ${result.flowB.worldbookEntries}` : "- Not run.",
    "",
    "## Safety Scan",
    "",
    `- ${result.safetyScan || "Not run."}`,
    "",
    "## Commands Run",
    "",
    "- `WORLD_TREE_RUN_REAL_LLM_SMOKE=1 npm run smoke:user-content-real-llm`",
    "",
    "## Notes",
    "",
    result.note || ""
  ];
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf8");
}

function blocked(reason) {
  const result = {
    status: "BLOCKED",
    reason,
    provider: {
      baseUrl: process.env.WORLD_TREE_LLM_BASE_URL || process.env.LLM_BASE_URL || "",
      model: process.env.WORLD_TREE_LLM_MODEL || process.env.LLM_MODEL || ""
    },
    safetyScan: "Not run because real LLM credentials/config are unavailable.",
    note: "Real LLM Flow: BLOCKED - missing LLM credentials/config. Local fallback is not counted as real LLM evidence.",
    generatedAt: new Date().toISOString()
  };
  writeReport(result);
  console.log(JSON.stringify(result, null, 2));
}

async function runFlow(server, options) {
  const { label, text, selectedTargets, expectedIntakeTypes, firstTurnInput = "" } = options;
  const plan = await api(server, "/api/alchemy/plan", { method: "POST", body: JSON.stringify({ text }) });
  if (plan.status !== 200 || plan.body.status !== "ok") throw new Error(`${label} plan failed`);
  if (!expectedIntakeTypes.includes(plan.body.intakeType)) throw new Error(`${label} unexpected intakeType ${plan.body.intakeType}`);

  const preview = await api(server, "/api/alchemy/generate-preview", {
    method: "POST",
    body: JSON.stringify({ text, plan: plan.body, selectedTargets })
  });
  if (preview.status !== 200 || preview.body.status !== "ok") throw new Error(`${label} preview failed`);

  const localize = await api(server, "/api/alchemy/localize", {
    method: "POST",
    body: JSON.stringify({ preview: preview.body, selectedTargets })
  });
  if (localize.status !== 200 || localize.body.status !== "ok") throw new Error(`${label} localize failed`);

  const deliver = await api(server, "/api/alchemy/deliver", {
    method: "POST",
    body: JSON.stringify({ preview: preview.body, localFolderDraft: localize.body, selectedTargets, userConfirmed: true })
  });
  if (deliver.status !== 200 || deliver.body.status !== "ok") throw new Error(`${label} deliver failed`);

  const moduleId = moduleIdFromKey(deliver.body.moduleKey);
  const worldPath = deliver.body.targetPaths.find((item) => item.target === "world_module")?.path || "";
  let chat = null;
  if (firstTurnInput) {
    chat = await api(server, "/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({
        input: firstTurnInput,
        moduleKey: deliver.body.moduleKey,
        dataMode: "worldbook",
        engineState: { turnCount: 0, dataMode: "worldbook" },
        messages: []
      })
    });
    if (chat.status !== 200 || chat.body.status !== "ok") throw new Error(`${label} chat failed`);
    if (chat.body.localFallback === true) throw new Error(`${label} used localFallback during real LLM smoke`);
    if (String(chat.body.narrative || "").includes("本地占位回复")) throw new Error(`${label} returned local placeholder text`);
  }
  const worldbook = await readJson(join(worldPath, "shared", "worldbook.json"));
  return {
    intakeType: plan.body.intakeType,
    previewMode: preview.body.mode,
    deliveryId: deliver.body.deliveryId,
    moduleKey: deliver.body.moduleKey,
    moduleId,
    storage: "temp-world-module",
    worldbookEntries: Array.isArray(worldbook.entries) ? worldbook.entries.length : 0,
    chat: chat ? {
      status: chat.body.status,
      localFallback: chat.body.localFallback === true,
      persistedTurnId: chat.body.persistedIds?.turnId || ""
    } : null
  };
}

await mkdir(reportsDir, { recursive: true });

const runEnabled = process.env.WORLD_TREE_RUN_REAL_LLM_SMOKE === "1";
const baseUrl = process.env.WORLD_TREE_LLM_BASE_URL || process.env.LLM_BASE_URL || "";
const model = process.env.WORLD_TREE_LLM_MODEL || process.env.LLM_MODEL || "";
const apiKey = process.env.WORLD_TREE_LLM_API_KEY || process.env.LLM_API_KEY || "";

if (!runEnabled) {
  blocked("WORLD_TREE_RUN_REAL_LLM_SMOKE is not set to 1");
} else if (!baseUrl || !model || !apiKey) {
  blocked("missing WORLD_TREE_LLM_BASE_URL/WORLD_TREE_LLM_MODEL/WORLD_TREE_LLM_API_KEY or LLM_BASE_URL/LLM_MODEL/LLM_API_KEY");
} else {
  const dataDir = await createTempDataDir("world-tree-real-llm-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    await api(server, "/api/config", {
      method: "POST",
      body: JSON.stringify({ llmBaseUrl: baseUrl, llmModel: model, llmTimeoutMs: Number(process.env.WORLD_TREE_LLM_TIMEOUT_MS || 60000) })
    });
    await api(server, "/api/secrets/llm", {
      method: "POST",
      body: JSON.stringify({ id: "real-llm-smoke", label: "Real LLM smoke", value: apiKey })
    });

    const flowA = await runFlow(server, {
      label: "Flow A",
      text: flowAText,
      expectedIntakeTypes: ["quick_create", "mixed"],
      selectedTargets: ["world_module", "worldbook", "character", "mechanism"],
      firstTurnInput: flowAFirstTurn
    });
    const flowB = await runFlow(server, {
      label: "Flow B",
      text: flowBText,
      expectedIntakeTypes: ["localize_existing", "mixed"],
      selectedTargets: ["world_module", "worldbook"]
    });

    const payload = [
      JSON.stringify(flowA),
      JSON.stringify(flowB),
      existsSync(join(dataDir, "engine", "worlds", flowA.moduleId, "runtime", "chat.jsonl"))
        ? readFileSync(join(dataDir, "engine", "worlds", flowA.moduleId, "runtime", "chat.jsonl"), "utf8")
        : ""
    ].join("\n");
    const forbidden = [/hiddenTruth/i, /gm_only/i, /system_only/i, /api.?key/i, /secret/i, /authorization/i, /\b[A-Za-z]:\\/];
    const hit = forbidden.find((pattern) => pattern.test(payload));
    if (hit) throw new Error(`safety scan matched ${hit}`);

    const result = {
      status: "PASS",
      provider: { baseUrl, model },
      flowA,
      flowB,
      safetyScan: "PASS: no hidden/system/secret/local-path payload detected in smoke evidence.",
      generatedAt: new Date().toISOString()
    };
    writeReport(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      provider: { baseUrl, model },
      safetyScan: "FAIL or incomplete.",
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
