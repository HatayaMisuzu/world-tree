import test from "node:test";
import assert from "node:assert/strict";
import { createAlchemyLocalizerService } from "../../src/server/alchemy-localizer-service.js";

function service() {
  return createAlchemyLocalizerService({
    now: () => new Date("2026-01-01T00:00:00.000Z")
  });
}

test("quick_create preview builds installable folder draft", () => {
  const preview = {
    id: "preview-1",
    mode: "quick_create",
    title: "赛博修仙",
    playableWorld: {
      world: { name: "cyber-xianxia", displayName: "赛博修仙" },
      opening: { scene: "雨夜的黑市丹房", firstPrompt: "你站在雨夜的黑市丹房。" }
    },
    worldbookEntries: [{ title: "白塔公司", keys: ["白塔"], content: "白塔公司是追杀主角的巨型公司。", source: "llm_suggested" }],
    characters: [{ name: "林药师", description: "被公司追杀的炼丹师。" }],
    mechanismDrafts: [{ name: "公司通缉度", type: "meter", description: "追捕压力。" }]
  };
  const draft = service().buildInstallableFolderDraft(preview);
  assert.equal(draft.status, "ok");
  assert.ok(draft.files["world.json"]);
  assert.ok(draft.files["shared/worldbook.json"].entries.length >= 1);
  assert.ok(draft.files["shared/characters.json"].length >= 1);
  assert.ok(draft.files["runtime/state.json"]);
  assert.ok(draft.files["runtime/mechanisms/cache.json"]);
});

test("scrubs secrets, paths, and script tags", () => {
  const preview = {
    title: "x",
    worldbookEntries: [{
      title: "泄漏测试",
      keys: ["泄漏"],
      content: "api_key=sk-12345678901234567890 C:\\Users\\Lenovo\\secret <script>alert(1)</script>"
    }]
  };
  const draft = service().buildInstallableFolderDraft(preview);
  const text = JSON.stringify(draft);
  assert.ok(!text.includes("sk-12345678901234567890"));
  assert.ok(!text.includes("C:\\Users\\Lenovo"));
  assert.ok(!text.includes("<script>"));
});

test("hidden truth marker does not enter opening firstPrompt", () => {
  const draft = service().buildInstallableFolderDraft({
    title: "秘密世界",
    playableWorld: { opening: { scene: "开始", firstPrompt: "hiddenTruth: 真凶是 A" } }
  });
  assert.ok(!JSON.stringify(draft.files["runtime/state.json"]).includes("hiddenTruth"));
});
