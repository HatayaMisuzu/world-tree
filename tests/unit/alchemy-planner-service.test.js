import test from "node:test";
import assert from "node:assert/strict";
import { getAlchemyCapabilities } from "../../src/server/alchemy-capabilities.js";
import { createAlchemyPlannerService } from "../../src/server/alchemy-planner-service.js";

function planner() {
  return createAlchemyPlannerService({ getCapabilities: () => getAlchemyCapabilities() });
}

test("short idea becomes quick_create and still needs user target choice", async () => {
  const result = await planner().plan({ text: "我想玩一个赛博修仙世界，主角是被公司追杀的炼丹师。" });
  assert.equal(result.status, "ok");
  assert.equal(result.intakeType, "quick_create");
  assert.equal(result.summary.needsUserTargetChoice, true);
  assert.ok(result.entrypointMap.some((item) => item.entrypointId === "playable_world" && item.recommendation === "strong"));
});

test("long setting becomes localize_existing", async () => {
  const longText = "世界观：白塔议会统治北境。角色：艾伦是流亡佣兵。势力：白塔、黑市、旧王党。规则：魔法有代价。".repeat(30);
  const result = await planner().plan({ text: longText });
  assert.equal(result.status, "ok");
  assert.equal(result.intakeType, "localize_existing");
});

test("strategy keywords recommend strategy_sim", async () => {
  const result = await planner().plan({ text: "我要做一个经营策略玩法，有资源、回合、事件牌和胜利失败条件。" });
  assert.ok(result.entrypointMap.some((item) => item.entrypointId === "strategy_sim" && item.recommendation === "strong"));
});

test("mystery keywords recommend detective", async () => {
  const result = await planner().plan({ text: "这是一个密室案件，有嫌疑人、线索、凶手和推理提交。" });
  assert.ok(result.entrypointMap.some((item) => item.entrypointId === "detective" && item.recommendation === "strong"));
});

test("tabletop keywords recommend tabletop", async () => {
  const result = await planner().plan({ text: "我有一个跑团模组，包含 GM 信息、NPC、场景和秘密时钟。" });
  assert.ok(result.entrypointMap.some((item) => item.entrypointId === "tabletop" && item.recommendation === "strong"));
});
