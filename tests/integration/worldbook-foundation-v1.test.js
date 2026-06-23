import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { createWorldbook, createWorldbookEntry, createDefaultScene, createDefaultWorldState, createDefaultTimeline, createDefaultRelations } from "../../src/core/worldbook/worldbook-schema.js";
import { activateWorldbookContext } from "../../src/core/worldbook/worldbook-context-activator.js";
import { createWorldContextPacket } from "../../src/core/worldbook/worldbook-context-packet.js";
import { createWorldStateProposal, applyApprovedWorldStateProposal } from "../../src/core/worldbook/worldbook-state-proposal.js";
import { createWorldbookModuleRuntimePacket } from "../../src/core/worldbook/worldbook-module-integration.js";

test("worldbook foundation V1 full chain: schema → context → proposal → roundtrip", async () => {
  // 1. Create schema
  const wb = createWorldbook({ title: "风暴大陆", premise: "永恒风暴包围的大陆" });
  wb.entries.push(createWorldbookEntry({ id: "lore-1", title: "避风港", keys: ["避风港"], content: "唯一的避风港" }));
  wb.entries.push(createWorldbookEntry({ id: "lore-2", title: "风暴", keys: ["风暴"], content: "无尽风暴" }));
  const scenes = createDefaultScene({ title: "避风港码头" });
  const state = createDefaultWorldState();
  const timeline = createDefaultTimeline();
  const relations = createDefaultRelations();

  assert.equal(wb.entries.length, 2);
  assert.equal(scenes.items[0].title, "避风港码头");

  // 2. Context activation
  const activated = activateWorldbookContext(wb, { input: "风暴来临" });
  assert.ok(activated.selected > 0);

  // 3. Context packet
  const packet = createWorldContextPacket({
    worldbook: wb, scenes, worldState: state, timeline, relations,
    activeLoreEntries: activated.activeEntries, mode: "world-rpg"
  });
  assert.equal(packet.worldIdentity.title, "风暴大陆");

  // 4. Module integration
  const modPacket = createWorldbookModuleRuntimePacket({}, { text: "storm" }, { modeId: "world-rpg" });
  assert.ok(modPacket.worldbookModulesAvailable.length > 0);

  // 5. State proposal
  const proposal = createWorldStateProposal({ type: "world_state_update", summary: "风暴增强", patch: { variables: { stormLevel: 3 } } });
  assert.equal(proposal.status, "pending");

  const approved = { ...proposal, status: "approved" };
  const updated = applyApprovedWorldStateProposal(state, approved);
  assert.equal(updated.variables.stormLevel, 3);

  console.log(`[worldbook] V1 chain: ${wb.entries.length} entries, ${activated.selected} activated, ${modPacket.worldbookModulesAvailable.length} modules → PASS`);
});

test("worldbook .worldtree roundtrip preserves data", async () => {
  const dataDir = await createTempDataDir();
  const server = await startWorldTreeServer({ dataDir });
  try {
    const create = await api(server, "/api/modules/create", {
      method: "POST", body: JSON.stringify({
        name: "wb_roundtrip_test", displayName: "风暴大陆", mode: "world-rpg",
        dataMode: "worldbook", subType: "classic", preset: "epic",
        draft: true, sourceType: "world_rpg_seed", sourceText: "永恒风暴"
      })
    });
    assert.equal(create.body.status, "ok");

    const exported = await api(server, "/api/world-pack/export", { method: "POST", body: JSON.stringify({ moduleKey: "wb_roundtrip_test" }) });
    assert.equal(exported.body.status, "ok");

    const imported = await api(server, "/api/world-pack/import", { method: "POST", body: JSON.stringify({ pack: exported.body.pack, name: "wb_rt_imported", preview: false, confirm: true }) });
    assert.equal(imported.body.status, "ok");
    assert.equal(imported.body.module.mode, "world-rpg");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
