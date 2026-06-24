import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendJsonl } from "../../src/server/fs-utils.js";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

test("immersive proposal reject endpoint keeps shared canon unchanged", async () => {
  const dataDir = await createTempDataDir("world-tree-proposal-ui-");
  const server = await startWorldTreeServer({ dataDir, env: { WORLD_TREE_DISABLE_LLM: "1" } });
  try {
    const name = "proposal_review_world";
    const created = await api(server, "/api/modules/create", { method: "POST", body: JSON.stringify({ name, displayName: "提案审查", mode: "world-rpg", dataMode: "worldbook", subType: "classic", preset: "epic", draft: true, sourceText: "test" }) });
    assert.equal(created.body.status, "ok");
    const worldDir = join(dataDir, "engine", "worlds", name);
    const proposalPath = join(worldDir, "runtime", "world-proposals.jsonl");
    const sharedPath = join(worldDir, "shared", "world_state.json");
    const before = await readFile(sharedPath, "utf8");
    await appendJsonl(proposalPath, { id: "reject-me", type: "world_state_change", summary: "天气永久改变", targetFile: "shared/world_state.json", patch: { merge: { weather: "storm" } }, status: "pending", impactLevel: "major" });

    const rejected = await api(server, `/api/projects/${encodeURIComponent(created.body.module.id)}/proposals/reject-me/reject`, { method: "POST", body: "{}" });
    assert.equal(rejected.body.ok, true);
    assert.equal(rejected.body.status, "rejected");
    assert.equal(await readFile(sharedPath, "utf8"), before);
    const activeProposalPath = join(worldDir, "branches", "main", "runtime", "world-proposals.jsonl");
    const proposals = (await readFile(activeProposalPath, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    assert.equal(proposals.find(item => item.id === "reject-me").status, "rejected");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
