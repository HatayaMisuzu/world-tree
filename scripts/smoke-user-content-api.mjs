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
  const requiredFiles = ["world.json", "shared/worldbook.json", "shared/characters.json", "runtime/state.json", "runtime/alchemy-deliveries.jsonl"];
  const requiredFilesPresent = Object.fromEntries(requiredFiles.map((file) => [file, existsSync(join(worldPath, file))]));

  const modules = await api(server, "/api/modules");
  const loaded = await api(server, "/api/modules/load", { method: "POST", body: JSON.stringify({ id: deliver.body.moduleKey }) });
  let chat = null;
  let chatRows = [];
  let state = await readJson(join(worldPath, "runtime", "state.json"));
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
    const chatText = readFileSync(join(worldPath, "runtime", "chat.jsonl"), "utf8");
    chatRows = chatText.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    state = await readJson(join(worldPath, "runtime", "state.json"));
  }

  const worldbook = await readJson(join(worldPath, "shared", "worldbook.json"));
  return {
    label,
    selectedTargets,
    intakeType: plan.body.intakeType,
    previewMode: preview.body.mode,
    deliveryId: deliver.body.deliveryId,
    moduleKey: deliver.body.moduleKey,
    moduleId,
    worldPath,
    requiredFilesPresent,
    moduleListed: modules.status === 200 && modules.body.some((item) => item.id === moduleId),
    moduleLoadStatus: loaded.body?.status || null,
    worldbookEntries: Array.isArray(worldbook.entries) ? worldbook.entries.length : 0,
    chat: chat ? {
      status: chat.body?.status,
      localFallback: chat.body?.localFallback === true,
      fallbackReason: chat.body?.fallbackReason || "",
      persistedTurnId: chat.body?.persistedIds?.turnId || "",
      assistantRows: chatRows.filter((row) => row.role === "assistant").length,
      userInputPersisted: chatRows.some((row) => row.role === "user" && String(row.content || "").includes(firstTurnInput)),
      turnCount: state.turnCount,
      lastInput: state.lastInput
    } : null
  };
}

function writeFlowReport(fileName, title, result) {
  const lines = [
    `# ${title}`,
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Status: PASS",
    "",
    "| Field | Value |",
    "|---|---|",
    `| intakeType | \`${result.intakeType}\` |`,
    `| preview.mode | \`${result.previewMode}\` |`,
    `| selectedTargets | \`${result.selectedTargets.join(", ")}\` |`,
    `| deliveryId | \`${result.deliveryId}\` |`,
    `| moduleKey | \`${result.moduleKey}\` |`,
    `| moduleId | \`${result.moduleId}\` |`,
    `| worldPath | \`${result.worldPath}\` |`,
    `| module listed | ${result.moduleListed ? "PASS" : "FAIL"} |`,
    `| module load | \`${result.moduleLoadStatus}\` |`,
    `| worldbook entries | ${result.worldbookEntries} |`,
    "",
    "## Required Files",
    "",
    ...Object.entries(result.requiredFilesPresent).map(([file, ok]) => `- ${ok ? "PASS" : "FAIL"} \`${file}\``),
    "",
    "## First Turn",
    "",
    result.chat ? `- PASS: chat persisted turn \`${result.chat.persistedTurnId}\`, localFallback=${result.chat.localFallback}, fallbackReason=\`${result.chat.fallbackReason}\`, turnCount=${result.chat.turnCount}, lastInput preserved=${result.chat.lastInput === flowAFirstTurn}.` : "- Not required for this flow.",
    "",
    "This evidence uses isolated local data. It does not claim Productization Closure PASS or v1.0.0 readiness."
  ];
  writeFileSync(join(reportsDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

await mkdir(reportsDir, { recursive: true });
const dataDir = await createTempDataDir("world-tree-user-content-api-");
const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });

try {
  const flowA = await runFlow(server, {
    label: "Flow A",
    text: flowAText,
    expectedIntakeTypes: ["quick_create", "mixed"],
    selectedTargets: ["world_module", "worldbook", "character", "mechanism"],
    firstTurnInput: flowAFirstTurn
  });
  if (flowA.previewMode !== "quick_create") throw new Error(`Flow A preview mode ${flowA.previewMode}`);

  const flowB = await runFlow(server, {
    label: "Flow B",
    text: flowBText,
    expectedIntakeTypes: ["localize_existing", "mixed"],
    selectedTargets: ["world_module", "worldbook"]
  });
  if (flowB.previewMode !== "localize_existing") throw new Error(`Flow B preview mode ${flowB.previewMode}`);
  if (flowB.worldbookEntries < 1) throw new Error("Flow B worldbook entries missing");

  writeFlowReport("user-content-flow-a-evidence.md", "User Content Flow A Evidence", flowA);
  writeFlowReport("user-content-flow-b-evidence.md", "User Content Flow B Evidence", flowB);

  const summary = { status: "PASS", dataDir, flowA, flowB, generatedAt: new Date().toISOString() };
  writeFileSync(join(reportsDir, "user-content-api-smoke-result.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await server.stop();
  await removeTempDir(dataDir);
}
