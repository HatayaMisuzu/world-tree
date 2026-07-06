import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "./helpers/server-process.js";
import { appendJsonl } from "../../src/server/fs-utils.js";
import { createProposal } from "../../src/core/system/proposal-bus.js";

test("kernel completion APIs cover summary, branches, telemetry, auto-light, and processing", async () => {
  const dataDir = await createTempDataDir("world-tree-kernel-");
  const server = await startWorldTreeServer({ dataDir });
  try {
    const created = await api(server, "/api/modules/create", { method: "POST", body: JSON.stringify({ name: "kernel_world", displayName: "Kernel World", mode: "world-rpg", dataMode: "worldbook", preset: "epic", allowBlank: true }) });
    assert.equal(created.body.status, "ok");
    const project = encodeURIComponent("kernel_world");

    const summary = await api(server, `/api/projects/${project}/kernel/summary`);
    assert.equal(summary.status, 200);
    assert.deepEqual(summary.body.status, { p0: true, p1: true, p2: true });
    assert.equal(summary.body.activeBranchId, "main");
    assert.equal(JSON.stringify(summary.body).includes(dataDir), false);

    const branch = await api(server, `/api/projects/${project}/branches/create`, { method: "POST", body: JSON.stringify({ id: "alternate", label: "Alternate" }) });
    assert.equal(branch.body.branch.id, "alternate");
    const switched = await api(server, `/api/projects/${project}/branches/alternate/switch`, { method: "POST", body: "{}" });
    assert.equal(switched.body.branch.status, "active");

    const telemetry = await api(server, `/api/projects/${project}/telemetry/refresh`, { method: "POST", body: "{}" });
    assert.equal(telemetry.body.telemetry.branchId, "alternate");
    const worldRoot = join(dataDir, "engine", "worlds", "kernel_world");
    await access(join(worldRoot, "branches", "alternate", "runtime", "world-telemetry.jsonl"));
    await assert.rejects(() => access(join(worldRoot, "branches", "main", "runtime", "world-telemetry.jsonl")));
    const auto = await api(server, `/api/projects/${project}/advance/auto-light`, { method: "POST", body: JSON.stringify({ userInput: "继续" }) });
    assert.ok(["ready", "blocked", "stopped"].includes(auto.body.result.status));
    assert.equal("approvedProposals" in auto.body.result, false);
    const choiceStop = await api(server, `/api/projects/${project}/advance/auto-light`, { method: "POST", body: JSON.stringify({ userInput: "继续", suggestedUserChoices: ["调查", "撤退"] }) });
    assert.equal(choiceStop.body.result.status, "stopped");
    assert.deepEqual(choiceStop.body.result.suggestedUserChoices, ["调查", "撤退"]);
    const hiddenBlock = await api(server, `/api/projects/${project}/advance/auto-light`, { method: "POST", body: JSON.stringify({ userInput: "继续", hiddenTruthRequired: true }) });
    assert.equal(hiddenBlock.body.result.status, "blocked");
    assert.equal(hiddenBlock.body.result.reason, "hidden_truth_required");

    const ingest = await api(server, `/api/projects/${project}/processing/ingest`, { method: "POST", body: JSON.stringify({ text: "Northern Mine Rune Slate", sourceType: "integration" }) });
    assert.equal(ingest.body.candidates.length, 1);
    const listed = await api(server, `/api/projects/${project}/processing/candidates`);
    assert.equal(listed.body.candidates.length, 1);
    assert.equal(listed.body.candidates[0].source.label, "integration");
    const branchWorldbook = join(worldRoot, "branches", "alternate", "shared", "worldbook.json");
    const worldbookBefore = await readFile(branchWorldbook, "utf8");
    const delivered = await api(server, `/api/projects/${project}/processing/candidates/${encodeURIComponent(listed.body.candidates[0].id)}/deliver`, { method: "POST", body: "{}" });
    assert.ok(["growth_tree", "proposal_queue"].includes(delivered.body.result.destination));
    assert.equal(await readFile(branchWorldbook, "utf8"), worldbookBefore);

    const critical = createProposal({ id: "critical-change", summary: "Raise alert", targetFile: "shared/world_state.json", patch: { merge: { states: { alert: "high" } } }, impactLevel: "critical", requiresSecondConfirm: true, reversible: true, rollbackPatch: { merge: { states: { alert: "low" } } } });
    await appendJsonl(join(worldRoot, "branches", "alternate", "runtime", "world-proposals.jsonl"), critical);
    const firstApprove = await api(server, `/api/projects/${project}/proposals/critical-change/approve`, { method: "POST", body: JSON.stringify({ currentTurn: 3 }) });
    assert.equal(firstApprove.body.status, "second_confirmation_required");
    const secondApprove = await api(server, `/api/projects/${project}/proposals/critical-change/approve`, { method: "POST", body: JSON.stringify({ currentTurn: 3, secondConfirm: true }) });
    assert.equal(secondApprove.body.status, "approved");
    assert.equal(secondApprove.body.stopLossWindow.status, "open");
    await access(join(worldRoot, "branches", "alternate", "runtime", "tracking", "change-log.jsonl"));
    const reverse = await api(server, `/api/projects/${project}/proposals/critical-change/reverse`, { method: "POST", body: "{}" });
    assert.equal(reverse.body.proposal.status, "pending");
    assert.equal(reverse.body.originalWindowStatus, "open_until_reverse_approved");

    const traversal = await api(server, "/api/projects/..%2F..%2Foutside/kernel/summary");
    assert.ok([400, 404].includes(traversal.status));
  } finally {
    await server.stop();
    await removeTempDir(dataDir);
  }
});

test("console exposes minimal kernel controls and keeps critical approval explicit", async () => {
  const source = await readFile(resolve("world-tree-console.js"), "utf8");
  assert.match(source, /data-kernel-panel/);
  assert.match(source, /kernel-create-branch/);
  assert.match(source, /kernel-auto-light/);
  assert.match(source, /kernel-approve-proposal/);
  assert.match(source, /第二次确认/);
  assert.match(source, /kernel-ingest-material/);
});
