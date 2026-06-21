import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

async function withServer(fn) {
  const dataDir = await createTempDataDir("wt-alchemy-workbench-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  try {
    await fn(server, dataDir);
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
}

async function createWorld(server) {
  const result = await api(server, "/api/modules/create", {
    method: "POST",
    body: JSON.stringify({ name: "alchemy_world", displayName: "Alchemy World", dataMode: "worldbook" })
  });
  assert.equal(result.body.status, "ok");
}

test("alchemy preview and refine remain outside review and formal world data until commit", async () => {
  await withServer(async (server, dataDir) => {
    await createWorld(server);
    const worldDir = join(dataDir, "engine", "worlds", "alchemy_world");
    const runtimeDir = join(worldDir, "runtime");
    const sharedPath = join(worldDir, "shared", "worldbook.json");
    const sharedBefore = readFileSync(sharedPath, "utf8");

    const preview = await api(server, "/api/alchemy/preview", {
      method: "POST",
      body: JSON.stringify({
        text: "世界树终端、红衣少女、云海城堡、梦境系统。",
        moduleKey: "alchemy_world",
        mode: "co_create",
        target: "mixed"
      })
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.status, "ok");
    assert.ok(preview.body.previewId);
    assert.ok(preview.body.preview.items.length > 0);
    assert.ok(Array.isArray(preview.body.preview.suggestions));
    assert.ok(Array.isArray(preview.body.preview.missingFields));
    assert.equal(existsSync(join(runtimeDir, "pending.jsonl")), false);
    assert.equal(existsSync(join(dataDir, "userData", "alchemy-review.json")), false);
    assert.equal(readFileSync(sharedPath, "utf8"), sharedBefore);

    const previewPath = join(runtimeDir, "alchemy-previews", `${preview.body.previewId}.json`);
    assert.equal(existsSync(previewPath), true);
    const saved = JSON.parse(readFileSync(previewPath, "utf8"));
    assert.ok(saved.input.excerpt.length <= 1000);
    assert.equal(JSON.stringify(preview.body).includes(dataDir), false);

    const refine = await api(server, "/api/alchemy/refine", {
      method: "POST",
      body: JSON.stringify({
        previewId: preview.body.previewId,
        instruction: "把世界树统一成超古代终端，不要传统神明化。",
        selectedItemIds: preview.body.preview.items.map(item => item.id),
        mode: "co_create"
      })
    });
    assert.equal(refine.status, 200);
    assert.equal(refine.body.previousPreviewId, preview.body.previewId);
    assert.notEqual(refine.body.previewId, preview.body.previewId);
    assert.equal(existsSync(join(runtimeDir, "pending.jsonl")), false);
    assert.equal(readFileSync(sharedPath, "utf8"), sharedBefore);

    const selected = refine.body.preview.items.slice(0, 1);
    const commit = await api(server, "/api/alchemy/commit", {
      method: "POST",
      body: JSON.stringify({
        previewId: refine.body.previewId,
        action: "enqueue_review",
        selectedItemIds: selected.map(item => item.id),
        editedItems: selected.map(item => ({ ...item, title: `${item.title}（已编辑）` }))
      })
    });
    assert.equal(commit.status, 200);
    assert.equal(commit.body.stats.enqueued, 1);
    assert.equal(existsSync(join(runtimeDir, "pending.jsonl")), true);
    assert.equal(readFileSync(sharedPath, "utf8"), sharedBefore);
  });
});

test("alchemy preview API validates input, ids and empty commits", async () => {
  await withServer(async (server) => {
    for (const body of [
      { text: "" },
      { text: "内容", mode: "invalid" },
      { text: "内容", target: "invalid" },
      { text: "x".repeat(120001) }
    ]) {
      const result = await api(server, "/api/alchemy/preview", { method: "POST", body: JSON.stringify(body) });
      assert.equal(result.status, 400);
      assert.equal(result.body.status, "error");
    }

    const traversal = await api(server, "/api/alchemy/refine", {
      method: "POST",
      body: JSON.stringify({ previewId: "../secrets.json", instruction: "继续" })
    });
    assert.equal(traversal.status, 400);
    assert.equal(traversal.body.code, "ALCHEMY_PREVIEW_ID_INVALID");

    const missing = await api(server, "/api/alchemy/commit", {
      method: "POST",
      body: JSON.stringify({ previewId: "00000000-0000-4000-8000-000000000000", action: "enqueue_review" })
    });
    assert.equal(missing.status, 404);

    const created = await api(server, "/api/alchemy/preview", {
      method: "POST",
      body: JSON.stringify({ text: "一个世界树终端。" })
    });
    const empty = await api(server, "/api/alchemy/commit", {
      method: "POST",
      body: JSON.stringify({ previewId: created.body.previewId, action: "enqueue_review", selectedItemIds: [] })
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.code, "ALCHEMY_COMMIT_EMPTY");
  });
});

test("alchemy previews are excluded from both default export formats and legacy import still works", async () => {
  await withServer(async (server) => {
    await createWorld(server);
    const preview = await api(server, "/api/alchemy/preview", {
      method: "POST",
      body: JSON.stringify({ text: "世界树终端。", moduleKey: "alchemy_world", mode: "structure" })
    });
    assert.equal(preview.status, 200);

    const worldPack = await api(server, "/api/world-pack/export?moduleKey=alchemy_world");
    assert.equal(Object.keys(worldPack.body.pack.files).some(key => key.includes("alchemy-previews")), false);

    const legacyExport = await api(server, "/api/data/export?moduleKey=alchemy_world");
    assert.equal(Object.keys(legacyExport.body.files || {}).some(key => key.includes("alchemy-previews")), false);

    const oldImport = await api(server, "/api/alchemy/import", {
      method: "POST",
      body: JSON.stringify({
        moduleKey: "alchemy_world",
        text: JSON.stringify({ spec: "chara_card_v2", data: { name: "兼容角色", description: "旧流程测试", first_mes: "你好" } })
      })
    });
    assert.equal(oldImport.status, 200);
    assert.equal(oldImport.body.status, "ok");
    assert.ok(oldImport.body.reviewItems.length > 0);
  });
});
