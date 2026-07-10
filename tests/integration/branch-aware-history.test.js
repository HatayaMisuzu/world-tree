import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";

test("module history follows the active branch and falls back to root runtime", async () => {
  const dataDir = await createTempDataDir("wt-branch-history-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const installed = await api(server, "/api/examples/install", { method: "POST", body: JSON.stringify({ id: "demo-world-cloud-steam-city" }) });
    const moduleId = installed.body.module.id;
    const worldRoot = join(dataDir, "engine", "worlds", moduleId.replace(/^world:/, ""));
    const branchRuntime = join(worldRoot, "branches", "main", "runtime");
    await mkdir(branchRuntime, { recursive: true });
    await writeFile(join(worldRoot, "timeline-tree.json"), JSON.stringify({ version: 1, rootBranchId: "main", activeBranchId: "main", branches: { main: { id: "main", status: "active" } } }), "utf8");
    await appendFile(join(branchRuntime, "chat.jsonl"), `${JSON.stringify({ id: "branch-assistant", role: "assistant", content: "分支历史可见" })}\n`, "utf8");
    await writeFile(join(branchRuntime, "state.json"), JSON.stringify({ turnCount: 1, activeBranch: "main" }), "utf8");

    const history = await api(server, `/api/modules/${encodeURIComponent(moduleId)}/history?limit=20`);
    assert.equal(history.body.status, "ok");
    assert.equal(history.body.activeBranch, "main");
    assert.equal(history.body.turnCount, 1);
    assert.equal(history.body.messages[0].content, "分支历史可见");
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});
