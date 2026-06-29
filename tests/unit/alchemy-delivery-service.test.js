import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAlchemyDeliveryService } from "../../src/server/alchemy-delivery-service.js";
import { createAlchemyLocalizerService } from "../../src/server/alchemy-localizer-service.js";

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

function deps(root) {
  const localizer = createAlchemyLocalizerService({ now: () => new Date("2026-01-01T00:00:00.000Z") });
  return {
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
  };
}

const preview = {
  id: "preview-1",
  title: "赛博修仙",
  playableWorld: { world: { name: "cyber-xianxia", displayName: "赛博修仙" }, opening: { scene: "黑市丹房" } },
  worldbookEntries: [{ title: "白塔公司", keys: ["白塔"], content: "白塔公司是追杀主角的公司。" }],
  characters: [{ name: "林药师", description: "炼丹师。" }],
  mechanismDrafts: [{ name: "公司通缉度", type: "meter", description: "追捕压力。" }]
};

test("delivery rejects without user confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "alchemy-delivery-"));
  try {
    const service = createAlchemyDeliveryService(deps(root));
    const result = await service.deliver({ preview, selectedTargets: ["world_module"] });
    assert.equal(result.status, "error");
    assert.equal(result.code, "ALCHEMY_DELIVERY_CONFIRMATION_REQUIRED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("delivery rejects without targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "alchemy-delivery-"));
  try {
    const service = createAlchemyDeliveryService(deps(root));
    const result = await service.deliver({ preview, selectedTargets: [], userConfirmed: true });
    assert.equal(result.status, "error");
    assert.equal(result.code, "ALCHEMY_DELIVERY_TARGET_REQUIRED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("world_module delivery creates local world folder and logs", async () => {
  const root = await mkdtemp(join(tmpdir(), "alchemy-delivery-"));
  try {
    const service = createAlchemyDeliveryService(deps(root));
    const result = await service.deliver({
      preview,
      previewId: "preview-1",
      selectedTargets: ["world_module", "worldbook", "character", "mechanism"],
      userConfirmed: true
    });
    assert.equal(result.status, "ok");
    assert.ok(result.moduleKey);
    const worldPath = result.targetPaths.find((item) => item.target === "world_module").path;
    assert.ok(existsSync(join(worldPath, "world.json")));
    assert.ok(existsSync(join(worldPath, "shared", "worldbook.json")));
    assert.ok(existsSync(join(worldPath, "shared", "characters.json")));
    assert.ok(existsSync(join(worldPath, "runtime", "mechanisms", "cache.json")));
    assert.ok(existsSync(join(worldPath, "runtime", "alchemy-deliveries.jsonl")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
