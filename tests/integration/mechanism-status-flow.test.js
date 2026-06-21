import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

async function withServer(fn) {
  const dataDir = await createTempDataDir("wt-mechanism-status-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  try { await fn(server, dataDir); }
  finally { await server.stop(); await removeTempDir(dataDir); }
}

async function createWorld(server) {
  const result = await api(server, "/api/modules/create", {
    method: "POST",
    body: JSON.stringify({ name: "mechanism_world", displayName: "Mechanism World", dataMode: "worldbook" })
  });
  assert.equal(result.body.status, "ok");
}

test("alchemy mechanisms are input-first, library-assisted, and committed outside review", async () => {
  await withServer(async (server, dataDir) => {
    await createWorld(server);
    const text = "红衣少女会根据玩家行动改变信任度。旧城堡有探索度。玩家可以获得银钥匙和梦境花。梦境稳定度会随着污染值变化。";
    const generated = await api(server, "/api/mechanisms/draft/from-alchemy", {
      method: "POST",
      body: JSON.stringify({ text, moduleKey: "mechanism_world" })
    });
    assert.equal(generated.status, 200);
    assert.ok(generated.body.drafts.length >= 4);
    assert.ok(generated.body.drafts.every(item => item.source === "input" && item.selected === true));
    assert.deepEqual(generated.body.libraryRecommendations.slice(0, 4).map(item => item.templateId), [
      "affinity.basic.v1", "exploration.location.v1", "inventory.simple.v1", "meter.pollution_stability.v1"
    ]);

    const library = await api(server, "/api/mechanisms/library?query=%E4%BB%BB%E5%8A%A1&moduleKey=mechanism_world");
    assert.equal(library.body.templates[0].templateId, "quest.progress.v1");

    const drafts = generated.body.drafts.map((item, index) => ({ ...item, selected: index !== 1 }));
    const committed = await api(server, "/api/mechanisms/world/commit-drafts", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "mechanism_world", drafts })
    });
    assert.equal(committed.body.committed, drafts.length - 1);
    assert.equal(committed.body.committedNew, drafts.length - 1);
    assert.equal(committed.body.cache.moduleKey, "mechanism_world");
    assert.ok(committed.body.cache.worldbookHash);
    assert.ok(committed.body.cache.definitionHash);
    const repeated = await api(server, "/api/mechanisms/world/commit-drafts", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "mechanism_world", drafts })
    });
    assert.equal(repeated.body.committed, 0);
    assert.equal(repeated.body.unchanged, drafts.length - 1);
    assert.equal(repeated.body.cache.definitionHash, committed.body.cache.definitionHash);
    assert.equal(repeated.body.cache.compiledAt, committed.body.cache.compiledAt);
    const fresh = await api(server, "/api/mechanisms/world?moduleKey=mechanism_world");
    assert.equal(fresh.body.stale, false);

    const runtime = join(dataDir, "engine", "worlds", "mechanism_world", "runtime");
    assert.equal(existsSync(join(runtime, "mechanisms", "cache.json")), true);
    assert.equal(existsSync(join(dataDir, "userData", "alchemy-review.json")), false);
    assert.equal(existsSync(join(runtime, "pending.jsonl")), false);

    const saveStatePath = join(runtime, "state.json");
    const saveStateBefore = readFileSync(saveStatePath, "utf8");
    await writeFile(join(dataDir, "engine", "worlds", "mechanism_world", "shared", "worldbook.json"), JSON.stringify({ entries: [{ id: "changed", content: "changed" }] }), "utf8");
    const stale = await api(server, "/api/mechanisms/world?moduleKey=mechanism_world");
    assert.equal(stale.body.stale, true);
    assert.equal(stale.body.cache.stale, true);
    assert.notEqual(stale.body.currentWorldbookHash, stale.body.cache.worldbookHash);
    assert.equal(readFileSync(saveStatePath, "utf8"), saveStateBefore);
  });
});

test("status frame APIs read latest, history and a selected turn after refresh", async () => {
  await withServer(async (server, dataDir) => {
    await createWorld(server);
    const statusDir = join(dataDir, "engine", "worlds", "mechanism_world", "runtime", "status");
    await mkdir(join(statusDir, "turn-frames"), { recursive: true });
    const mechanismDir = join(dataDir, "engine", "worlds", "mechanism_world", "runtime", "mechanisms");
    await mkdir(mechanismDir, { recursive: true });
    await writeFile(join(mechanismDir, "cache.json"), JSON.stringify({ version: "mechanism-cache.v1", moduleKey: "mechanism_world", mechanisms: [] }), "utf8");
    const frame = {
      id: "frame-2", turnId: "turn-2", round: 2, userMessageId: "turn-2-user", assistantMessageId: "turn-2-assistant",
      moduleKey: "mechanism_world", saveId: "main", createdAt: new Date().toISOString(),
      afterState: { characters: { meiling: { trust: 77 } }, world: {}, inventory: {}, quests: {}, mechanisms: {} },
      changes: [{ id: "change-1", type: "increase", category: "character", target: "characters.meiling.trust", label: "trust", before: 72, after: 77, delta: 5, applied: true }],
      visual: { version: "visual-dsl.v1", mode: "simple", cards: [] }
    };
    await writeFile(join(statusDir, "turn-frames", "turn-2.json"), JSON.stringify(frame), "utf8");
    await writeFile(join(statusDir, "index.json"), JSON.stringify({ version: "turn-state-index.v1", moduleKey: "mechanism_world", turns: [{ turnId: "turn-2", round: 2, saveId: "main", createdAt: frame.createdAt, changeCount: 1, summary: "1 项已确认状态变化" }] }), "utf8");

    const latest = await api(server, "/api/status/turn/latest?moduleKey=mechanism_world&saveId=main");
    const selected = await api(server, "/api/status/turn/turn-2?moduleKey=mechanism_world&saveId=main");
    const index = await api(server, "/api/status/turns?moduleKey=mechanism_world&saveId=main&limit=50");
    assert.equal(latest.body.frame.turnId, "turn-2");
    assert.equal(selected.body.frame.afterState.characters.meiling.trust, 77);
    assert.equal(index.body.turns[0].turnId, "turn-2");

    const worldPack = await api(server, "/api/world-pack/export?moduleKey=mechanism_world");
    assert.equal(Object.keys(worldPack.body.pack.files).some(key => key.includes("runtime/status")), false);
    assert.equal(Object.keys(worldPack.body.pack.files).some(key => key.includes("runtime/mechanisms")), false);
    const optionalWorldPack = await api(server, "/api/world-pack/export", {
      method: "POST",
      body: JSON.stringify({ moduleKey: "mechanism_world", includeMechanisms: true, includeTurnStateFrames: true })
    });
    assert.equal(Object.keys(optionalWorldPack.body.pack.files).some(key => key === "runtime/mechanisms/cache.json"), true);
    assert.equal(Object.keys(optionalWorldPack.body.pack.files).some(key => key === "runtime/status/turn-frames/turn-2.json"), true);
    const legacy = await api(server, "/api/data/export?moduleKey=mechanism_world");
    assert.equal(Object.keys(legacy.body.files || {}).some(key => /runtime\/(status|mechanisms|debug|proposal|session)/.test(key)), false);
    assert.equal(JSON.stringify(legacy.body).includes("apiKey"), false);
    assert.equal(readFileSync(join(statusDir, "turn-frames", "turn-2.json"), "utf8").includes("turn-2"), true);
  });
});
