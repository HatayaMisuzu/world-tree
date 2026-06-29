import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAlchemyCapabilities } from "../../src/server/alchemy-capabilities.js";
import { createAlchemyPlannerService } from "../../src/server/alchemy-planner-service.js";
import { createAlchemyLocalizerService } from "../../src/server/alchemy-localizer-service.js";
import { createAlchemyDeliveryService } from "../../src/server/alchemy-delivery-service.js";

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}
async function writeJson(path, value) {
  await mkdir(join(path, ".."), { recursive: true }).catch(() => {});
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}
async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}
async function appendJsonl(path, value) {
  await ensureDir(join(path, "..")).catch(() => {});
  await writeFile(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" });
}

function previewFromIdea(text, plan) {
  return {
    id: "preview-idea",
    planId: plan.planId,
    mode: plan.intakeType,
    title: "赛博修仙",
    playableWorld: {
      world: { name: "cyber-xianxia", displayName: "赛博修仙" },
      opening: { scene: "雨夜黑市丹房", playerRole: "被追杀的炼丹师", initialGoal: "逃出公司封锁区" }
    },
    worldbookEntries: [{ title: "白塔公司", keys: ["白塔", "公司"], content: "白塔公司是赛博修仙世界中追杀主角的巨型公司。", source: "llm_suggested" }],
    characters: [{ name: "林药师", description: "被公司追杀的炼丹师。", source: "user_specified" }],
    mechanismDrafts: [{ name: "公司通缉度", type: "meter", description: "记录公司追捕压力。", source: "llm_suggested" }]
  };
}

test("simple idea can plan, localize, and deliver playable module", async () => {
  const root = await mkdtemp(join(tmpdir(), "alchemy-closure-"));
  try {
    const planner = createAlchemyPlannerService({ getCapabilities: () => getAlchemyCapabilities() });
    const plan = await planner.plan({ text: "我想玩一个赛博修仙世界，主角是被公司追杀的炼丹师。" });
    assert.equal(plan.intakeType, "quick_create");
    assert.equal(plan.summary.needsUserTargetChoice, true);

    const localizer = createAlchemyLocalizerService({ now: () => new Date("2026-01-01T00:00:00.000Z") });
    const preview = previewFromIdea("", plan);
    const folderDraft = localizer.buildInstallableFolderDraft(preview);
    assert.equal(folderDraft.status, "ok");

    const delivery = createAlchemyDeliveryService({
      dataRoot: root,
      worldsDir: join(root, "worlds"),
      readJson,
      writeJson,
      writeFile,
      appendJsonl,
      exists: existsSync,
      ensureDir,
      buildInstallableFolderDraft: localizer.buildInstallableFolderDraft,
      now: () => new Date("2026-01-01T00:00:00.000Z")
    });
    const result = await delivery.deliver({
      preview,
      localFolderDraft: folderDraft,
      selectedTargets: ["world_module", "worldbook", "character", "mechanism"],
      userConfirmed: true
    });
    assert.equal(result.status, "ok");
    const worldPath = result.targetPaths.find((item) => item.target === "world_module").path;
    assert.ok(existsSync(join(worldPath, "world.json")));
    assert.ok(existsSync(join(worldPath, "shared", "worldbook.json")));
    assert.ok(existsSync(join(worldPath, "runtime", "mechanisms", "cache.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("complete setting plans as localization and preserves source policy", async () => {
  const text = "世界观：白塔议会统治北境。角色：艾伦是流亡佣兵。势力：旧王党和黑市联盟。规则：魔法有代价。".repeat(40);
  const planner = createAlchemyPlannerService({ getCapabilities: () => getAlchemyCapabilities() });
  const plan = await planner.plan({ text });
  assert.equal(plan.intakeType, "localize_existing");

  const localizer = createAlchemyLocalizerService({ now: () => new Date("2026-01-01T00:00:00.000Z") });
  const draft = localizer.buildModuleDraft({
    id: "preview-local",
    mode: "localize_existing",
    title: "北境白塔",
    sourcePolicy: { preserveCoreSetting: true }
  });
  assert.equal(draft.sourcePolicy.userSpecifiedPreserved, true);
});
