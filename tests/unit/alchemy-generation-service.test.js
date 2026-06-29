import test from "node:test";
import assert from "node:assert/strict";
import { createAlchemyGenerationService } from "../../src/server/alchemy-generation-service.js";

test("generation service calls LLM for quick_create preview", async () => {
  let called = false;
  const service = createAlchemyGenerationService({
    runLlmJson: async (prompt, meta) => {
      called = true;
      assert.match(prompt, /最低可玩世界|快速创世/);
      assert.equal(meta.responseFormat, "json");
      return {
        status: "ok",
        mode: "quick_create",
        title: "赛博修仙",
        playableWorld: {
          world: { name: "cyber-xianxia", displayName: "赛博修仙" },
          opening: { scene: "雨夜黑市丹房", firstPrompt: "你将如何行动？" }
        },
        worldbookEntries: [{ title: "白塔公司", keys: ["白塔"], content: "白塔公司追杀主角。", source: "llm_suggested" }],
        characters: [],
        mechanismDrafts: [],
        deliveryPlan: []
      };
    }
  });

  const result = await service.generate({
    text: "我想玩一个赛博修仙世界",
    plan: { intakeType: "quick_create", summary: { title: "快速创世" } },
    selectedTargets: ["world_module", "worldbook"]
  });

  assert.equal(called, true);
  assert.equal(result.status, "ok");
  assert.equal(result.mode, "quick_create");
  assert.equal(result.playableWorld.world.name, "cyber-xianxia");
});

test("generation service uses fallback when LLM fails", async () => {
  const service = createAlchemyGenerationService({
    runLlmJson: async () => {
      throw new Error("boom");
    }
  });

  const result = await service.generate({
    text: "一个被公司追杀的炼丹师",
    plan: { intakeType: "quick_create", summary: { title: "赛博修仙" }, entrypointMap: [] },
    selectedTargets: ["world_module"]
  });

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "quick_create");
  assert.ok(result.warnings.some((item) => /fallback|LLM/.test(item)));
});

test("generation service requires user selected targets", async () => {
  const service = createAlchemyGenerationService();
  const result = await service.generate({
    text: "一个世界",
    plan: { intakeType: "quick_create" },
    selectedTargets: []
  });
  assert.equal(result.status, "error");
  assert.equal(result.code, "ALCHEMY_GENERATE_TARGET_REQUIRED");
});

test("generation service scrubs hidden markers from opening", async () => {
  const service = createAlchemyGenerationService({
    runLlmJson: async () => ({
      status: "ok",
      mode: "quick_create",
      title: "秘密世界",
      playableWorld: {
        world: { name: "secret-world", displayName: "秘密世界" },
        opening: {
          scene: "hiddenTruth: 凶手是管家",
          firstPrompt: "gm_only: 不要告诉玩家"
        }
      },
      worldbookEntries: []
    })
  });

  const result = await service.generate({
    text: "秘密世界",
    plan: { intakeType: "quick_create" },
    selectedTargets: ["world_module"]
  });

  assert.doesNotMatch(result.playableWorld.opening.scene, /hiddenTruth|gm_only/i);
  assert.doesNotMatch(result.playableWorld.opening.firstPrompt, /hiddenTruth|gm_only/i);
});
