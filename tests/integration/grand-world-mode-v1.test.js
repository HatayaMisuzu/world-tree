import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { createGrandWorldModeContext, createGrandWorldTurnPacket, runGrandWorldTurn } from "../../src/core/grand-world/grand-world-mode-adapter.js";
import { createWorldbook, createWorldbookEntry, createDefaultScene, createDefaultWorldState, createDefaultTimeline, createDefaultRelations } from "../../src/core/worldbook/worldbook-schema.js";
import { createWorldStateProposal, applyApprovedWorldStateProposal } from "../../src/core/worldbook/worldbook-state-proposal.js";
import { createWorldThread, selectActiveWorldThreads } from "../../src/core/grand-world/grand-world-objectives.js";

test("world-rpg project creates full grand world file structure", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST", body: JSON.stringify({
        name: "gw_struct_test", displayName: "风暴大陆", mode: "world-rpg",
        dataMode: "worldbook", subType: "classic", preset: "epic", draft: true,
        sourceType: "world_rpg_seed", sourceText: "永恒风暴包围的大陆"
      })
    });
    assert.equal(create.body.status, "ok");
    const wd = join(dataDir, "engine", "worlds", "gw_struct_test");

    // Core files
    assert.ok(existsSync(join(wd, "world.json")));
    assert.ok(existsSync(join(wd, "runtime", "state.json")));
    assert.ok(existsSync(join(wd, "runtime", "source.txt")));
    assert.ok(existsSync(join(wd, "runtime", "chat.jsonl")));

    // Worldbook foundation
    assert.ok(existsSync(join(wd, "shared", "worldbook.json")));
    assert.ok(existsSync(join(wd, "shared", "scenes.json")));
    assert.ok(existsSync(join(wd, "shared", "world_state.json")));
    assert.ok(existsSync(join(wd, "shared", "timeline.json")));
    assert.ok(existsSync(join(wd, "shared", "relations.json")));

    // Grand World specific
    assert.ok(existsSync(join(wd, "shared", "world_threads.json")), "world_threads.json missing");
    assert.ok(existsSync(join(wd, "shared", "world_rpg.json")), "world_rpg.json missing");

    // Proposals
    assert.ok(existsSync(join(wd, "runtime", "world-proposals.jsonl")), "world-proposals.jsonl missing");

    // Cache directory
    assert.ok(existsSync(join(wd, "runtime", "cache", "worldbook")), "cache/worldbook dir missing");

    // Mode in world.json
    const world = JSON.parse(readFileSync(join(wd, "world.json"), "utf-8"));
    assert.equal(world.mode, "world-rpg");

    console.log(`[gw-struct] 12 files verified for world-rpg project`);
  } finally { await server.stop(); await removeTempDir(dataDir); }
});

test("grand world turn generates context, packet, and pending proposals", async () => {
  const wb = createWorldbook({ title: "风暴大陆", premise: "永恒风暴" });
  wb.entries.push(createWorldbookEntry({ id: "l1", title: "避风港", keys: ["港"], content: "唯一避风港", enabled: true }));
  const project = { worldbook: wb, scenes: createDefaultScene(), worldState: createDefaultWorldState(), timeline: createDefaultTimeline(), relations: createDefaultRelations() };

  // Run turn
  const result = runGrandWorldTurn(project, { text: "探索避风港" });
  assert.equal(result.status, "ready");
  assert.ok(result.turnPacket.modeMeaning, "grand_world");
  assert.ok(result.prompt.promptText.includes("大世界"));
  assert.ok(result.cacheKey);

  // Verify context
  const ctx = result.ctx;
  assert.ok(ctx.worldPacket.worldIdentity.title, "风暴大陆");
  assert.ok(ctx.activated.selected > 0);

  // Create + apply proposal
  const proposal = createWorldStateProposal({ type: "world_state_update", summary: "发现新区域", patch: { variables: { discovered: "harbor" } } });
  assert.equal(proposal.status, "pending");

  // Approve then apply
  const approved = { ...proposal, status: "approved" };
  const updated = applyApprovedWorldStateProposal(ctx.state, approved);
  assert.equal(updated.variables.discovered, "harbor");

  // Rejected proposal does not change state
  const rejected = { ...proposal, status: "rejected", patch: { variables: { ghost: true } } };
  const unchanged = applyApprovedWorldStateProposal(ctx.state, rejected);
  assert.equal(unchanged.variables.ghost, undefined);

  console.log("[gw-turn] turn + proposal approve/reject verified");
});

test("world threads are narrative leads not quests", () => {
  const t1 = createWorldThread({ title: "调查风暴来源", type: "lead" });
  assert.equal(t1.type, "lead");
  assert.equal(t1.status, "active");
  // world_threads are narrative leads, not traditional RPG quests
  assert.ok(!("questType" in t1));
  assert.ok(!("xpReward" in t1));
  assert.ok(!("questLog" in t1));
  const threads = [
    createWorldThread({ title: "A", type: "lead" }),  // defaults to active
    { id: "t2", title: "B", type: "lead", status: "completed" } // manual
  ];
  assert.equal(selectActiveWorldThreads(threads).length, 1);
});

test(".worldtree roundtrip preserves grand world metadata", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST", body: JSON.stringify({
        name: "gw_rt_test", displayName: "风暴大陆", mode: "world-rpg",
        dataMode: "worldbook", subType: "classic", preset: "epic", draft: true,
        sourceType: "world_rpg_seed", sourceText: "test"
      })
    });
    assert.equal(create.body.status, "ok");

    const exported = await api(server, "/api/world-pack/export", { method: "POST", body: JSON.stringify({ moduleKey: "gw_rt_test" }) });
    assert.equal(exported.body.status, "ok");

    const imported = await api(server, "/api/world-pack/import", { method: "POST", body: JSON.stringify({ pack: exported.body.pack, name: "gw_rt_imported", preview: false, confirm: true }) });
    assert.equal(imported.body.status, "ok");
    const impDir = join(dataDir, "engine", "worlds", imported.body.module.id);
    const impWorld = JSON.parse(readFileSync(join(impDir, "world.json"), "utf-8"));
    assert.equal(impWorld.mode, "world-rpg");
    assert.ok(existsSync(join(impDir, "shared", "worldbook.json")));
    assert.ok(existsSync(join(impDir, "shared", "world_threads.json")));
  } finally { await server.stop(); await removeTempDir(dataDir); }
});
