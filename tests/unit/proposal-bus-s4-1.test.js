import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import {
  createProposal,
  approveProposal,
  rejectProposal,
  adoptProposal,
  commitProposal,
  reverseProposal,
  ingestBusProposal,
  exportProposalSnapshot,
  importProposalSnapshot,
  resetProposalStore,
  getByStatus,
  getPendingUserConfirmations
} from "../../src/core/system/proposal-bus.js";
import { appendJsonl, writeJson, readJsonSync } from "../../src/shared/fs-utils.js";
import { createWorldStateProposal } from "../../src/core/world-state/world-state-proposals.js";
import { createCompletionProposal } from "../../src/core/processing/completion-proposal.js";

function tempRoot(label) {
  const root = mkdtempSync(join(tmpdir(), `${label}-`));
  mkdirSync(join(root, "runtime"), { recursive: true });
  mkdirSync(join(root, "shared"), { recursive: true });
  return root;
}

test("S4-1 callers use proposal-bus surface backed by proposal-system", () => {
  resetProposalStore();
  const ws = createWorldStateProposal("/tmp", { stateId: "alert", summary: "raise", impactLevel: "major" }, { modeId: "world-rpg" });
  assert.equal(ws.type, "world_state_update");
  assert.ok(getByStatus("pending").some(p => p.id === ws.id), "world-state proposal ingested into record store");

  const completion = createCompletionProposal({ summary: "cand", riskLevel: "high", suggestedTarget: "shared/world_state.json" });
  assert.ok(completion.id);
  assert.ok(getByStatus("pending").some(p => p.id === completion.id));
});

test("S4-1 adopt/commit/reject/reverse record ops remain available on proposal-bus", async () => {
  resetProposalStore();
  const record = createProposal({
    typeId: "relation",
    change: { field: "relationship", description: "关系网全局重构", oldValue: "friend", newValue: "rival" },
    source: "writer",
    moduleKey: "s4-1",
    round: 2
  });
  assert.equal(record.status, "pending");
  assert.equal(getPendingUserConfirmations().some(p => p.id === record.id), true);

  assert.equal(adoptProposal(record.id).ok, true);
  assert.equal(commitProposal(record.id).ok, true);
  const reversed = reverseProposal(record.id, "test stop-loss");
  assert.equal(reversed.ok, true);
  assert.equal(reversed.proposal.status, "reversed");

  resetProposalStore();
  const root = tempRoot("wt-s41-rec-rej");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    const bus = createProposal({ id: "rej-1", type: "world_state_update", summary: "nope", impactLevel: "medium" });
    await appendJsonl(logPath, bus);
    const rejected = await rejectProposal({ projectRoot: root, proposalLog: logPath }, "rej-1");
    assert.equal(rejected.ok, true);
    assert.equal(rejected.status, "rejected");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("S4-1 bus approve/reject + overlay WRITE_POLICY; shared untouched", async () => {
  resetProposalStore();
  const root = tempRoot("wt-s41-approve");
  try {
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    await writeJson(join(root, "shared", "world_state.json"), { v: 1 });
    const proposal = createProposal({
      id: "s41-a",
      summary: "bump",
      targetFile: "shared/world_state.json",
      patch: { merge: { v: 2 } },
      impactLevel: "major",
      oldValue: { v: 1 },
      rollbackPatch: { merge: { v: 1 } }
    });
    await appendJsonl(logPath, proposal);
    const approved = await approveProposal({ projectRoot: root, proposalLog: logPath }, "s41-a", {}, { currentTurn: 4 });
    assert.equal(approved.ok, true);
    assert.equal(approved.writePath, "overlay-store");
    assert.equal(approved.stopLossWindow.status, "open");
    assert.equal(readJsonSync(join(root, "shared", "world_state.json")).v, 1);
    assert.equal(readJsonSync(join(root, "runtime", "overlay", "canon-overlay.json")).v, 2);
    assert.ok(existsSync(join(root, "runtime", "tracking", "change-log.jsonl")));

    resetProposalStore();
    const root2 = tempRoot("wt-s41-reject");
    try {
      const log2 = join(root2, "runtime", "world-proposals.jsonl");
      await writeJson(join(root2, "shared", "world_state.json"), { v: 1 });
      await appendJsonl(log2, createProposal({
        id: "s41-r",
        summary: "no",
        targetFile: "shared/world_state.json",
        patch: { replace: { v: 9 } }
      }));
      const rejected = await rejectProposal({ projectRoot: root2, proposalLog: log2 }, "s41-r");
      assert.equal(rejected.ok, true);
      assert.equal(rejected.status, "rejected");
      assert.equal(readJsonSync(join(root2, "shared", "world_state.json")).v, 1);
      assert.equal(existsSync(join(root2, "runtime", "overlay", "canon-overlay.json")), false);
    } finally {
      rmSync(root2, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("S4-1 engineSnapshot loads old bus-shaped proposals", () => {
  resetProposalStore();
  const legacy = {
    version: 1,
    proposals: {
      proposals: [
        {
          id: "legacy-bus-1",
          type: "world_state_update",
          status: "pending",
          targetFile: "shared/world_state.json",
          patch: { merge: { alert: "high" } },
          summary: "old save shape",
          impactLevel: "critical",
          requiresSecondConfirm: true
        }
      ],
      history: [],
      autoCommitLog: []
    },
    memory: { layers: {} },
    relations: { relations: [], changeLog: [] }
  };
  // Minimal memory/relations shape tolerance — importEngineState only touches present keys
  importProposalSnapshot(legacy.proposals);
  const snap = exportProposalSnapshot();
  assert.ok(snap.proposals.some(p => p.id === "legacy-bus-1" && p.change && p.typeId));

  resetProposalStore();
  // Array-root legacy
  importProposalSnapshot([
    { id: "legacy-arr", type: "world_state_update", status: "pending", patch: { replace: { x: 1 } }, targetFile: "shared/world_state.json" }
  ]);
  assert.ok(exportProposalSnapshot().proposals.some(p => p.id === "legacy-arr"));
  resetProposalStore();
});

test("S4-1 archived implementation path exists", async () => {
  const { access } = await import("node:fs/promises");
  await access(new URL("../../archive/src/core/system/proposal-bus.js", import.meta.url));
});
