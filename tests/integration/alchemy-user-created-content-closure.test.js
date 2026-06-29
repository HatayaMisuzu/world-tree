import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  api,
  createTempDataDir,
  removeTempDir,
  startWorldTreeServer
} from "./helpers/server-process.js";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function moduleIdFromKey(moduleKey = "") {
  return String(moduleKey || "").replace(/^world:/, "");
}

async function runAlchemyFlow(server, {
  text,
  expectedIntakeTypes,
  selectedTargets,
  firstTurnInput = ""
}) {
  const plan = await api(server, "/api/alchemy/plan", {
    method: "POST",
    body: JSON.stringify({ text })
  });
  assert.equal(plan.status, 200);
  assert.equal(plan.body.status, "ok");
  assert.ok(expectedIntakeTypes.includes(plan.body.intakeType), `unexpected intakeType ${plan.body.intakeType}`);

  const preview = await api(server, "/api/alchemy/generate-preview", {
    method: "POST",
    body: JSON.stringify({ text, plan: plan.body, selectedTargets })
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.status, "ok");

  const localize = await api(server, "/api/alchemy/localize", {
    method: "POST",
    body: JSON.stringify({ preview: preview.body, selectedTargets })
  });
  assert.equal(localize.status, 200);
  assert.equal(localize.body.status, "ok");
  assert.ok(localize.body.files?.["world.json"]);
  assert.ok(localize.body.files?.["shared/worldbook.json"]);
  assert.ok(localize.body.files?.["runtime/state.json"]);

  const deliver = await api(server, "/api/alchemy/deliver", {
    method: "POST",
    body: JSON.stringify({
      preview: preview.body,
      localFolderDraft: localize.body,
      selectedTargets,
      userConfirmed: true
    })
  });
  assert.equal(deliver.status, 200);
  assert.equal(deliver.body.status, "ok");
  assert.ok(deliver.body.moduleKey);

  const moduleId = moduleIdFromKey(deliver.body.moduleKey);
  const worldPath = deliver.body.targetPaths.find((item) => item.target === "world_module")?.path;
  assert.ok(worldPath);
  assert.ok(worldPath.endsWith(moduleId));
  assert.equal(existsSync(join(worldPath, "world.json")), true);
  assert.equal(existsSync(join(worldPath, "shared", "worldbook.json")), true);
  assert.equal(existsSync(join(worldPath, "shared", "characters.json")), true);
  assert.equal(existsSync(join(worldPath, "runtime", "state.json")), true);
  assert.equal(existsSync(join(worldPath, "runtime", "alchemy-deliveries.jsonl")), true);

  const modules = await api(server, "/api/modules");
  assert.equal(modules.status, 200);
  assert.ok(modules.body.some((item) => item.id === moduleId));

  const loaded = await api(server, "/api/modules/load", {
    method: "POST",
    body: JSON.stringify({ id: deliver.body.moduleKey })
  });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.status, "ok");
  assert.equal(loaded.body.model.selected.id, moduleId);

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
    assert.equal(chat.status, 200);
    assert.equal(chat.body.status, "ok");
    assert.ok(chat.body.persistedIds?.turnId);
    assert.equal(existsSync(join(worldPath, "runtime", "chat.jsonl")), true);
    const chatText = await readFile(join(worldPath, "runtime", "chat.jsonl"), "utf8");
    const chatRows = chatText.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    assert.ok(chatRows.some((row) => row.role === "user" && row.content.includes(firstTurnInput)));
    assert.ok(chatRows.some((row) => row.role === "assistant"));
    const state = await readJson(join(worldPath, "runtime", "state.json"));
    assert.equal(state.turnCount, 1);
    assert.equal(state.lastInput, firstTurnInput);
  }

  return { plan: plan.body, preview: preview.body, localize: localize.body, deliver: deliver.body, moduleId, worldPath, chat: chat?.body || null };
}

test("user-created content closure: simple idea and localized setting flows pass", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });

  try {
    const flowA = await runAlchemyFlow(server, {
      text: "我想玩一个赛博修仙世界，主角是被公司追杀的炼丹师。",
      expectedIntakeTypes: ["quick_create", "mixed"],
      selectedTargets: ["world_module", "worldbook", "character", "mechanism"],
      firstTurnInput: "我先检查随身丹炉和附近出口。"
    });
    assert.equal(flowA.preview.mode, "quick_create");

    const flowB = await runAlchemyFlow(server, {
      text: [
        "世界观：浮岛群由七座城邦组成，灵能潮汐每三十天改变航路。",
        "势力：灯塔议会负责航线许可，灰帆商会掌握补给，边境学会研究潮汐规则。",
        "地点：中央灯塔、灰港、潮汐观测站。",
        "规则：所有飞舟必须记录航行誓约；违规会影响通行许可。",
        "时间线：第一阶段是潮汐异常，第二阶段是航线封锁，第三阶段是议会听证。",
        "主角目标：把这份设定本地化成可以继续扩写的 World Tree 世界。"
      ].join("\n"),
      expectedIntakeTypes: ["localize_existing", "mixed"],
      selectedTargets: ["world_module", "worldbook"]
    });
    assert.equal(flowB.preview.mode, "localize_existing");
    const worldbook = await readJson(join(flowB.worldPath, "shared", "worldbook.json"));
    assert.ok(worldbook.entries.length >= 1);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
