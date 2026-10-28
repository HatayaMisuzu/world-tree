import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  submitVisibilityRevealProposal,
  readRecordVisibility,
  readVisibilityOverlayEntry,
  VISIBILITY_REVEAL_TARGET
} from "../../src/core/v2-ready/visibility-reveal-bus.js";
import { buildVisibilityRevealProposalInput } from "../../src/core/v2-ready/visibility-policy.js";
import {
  approveProposal,
  getByStatus,
  resetProposalStore
} from "../../src/core/system/proposal-bus.js";
import { appendJsonl, writeJson, readJsonSync } from "../../src/shared/fs-utils.js";

function tempRoot(label) {
  const root = mkdtempSync(join(tmpdir(), `${label}-`));
  mkdirSync(join(root, "runtime"), { recursive: true });
  mkdirSync(join(root, "shared"), { recursive: true });
  return root;
}

test("S4-5 submitVisibilityRevealProposal uses helper → createProposal; record unchanged", () => {
  resetProposalStore();
  const record = { id: "clue_secret", visibility: "gm_only", knownBy: ["npc_a"] };
  const before = readRecordVisibility(record);
  const shaped = buildVisibilityRevealProposalInput(record, {
    observerId: "player",
    toVisibility: "player_visible"
  });
  const proposal = submitVisibilityRevealProposal(record, {
    observerId: "player",
    toVisibility: "player_visible",
    modeId: "world-rpg",
    round: 3
  });

  assert.equal(proposal.type, "visibility_reveal");
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.targetFile, VISIBILITY_REVEAL_TARGET);
  assert.equal(proposal.impactLevel, shaped.impactLevel);
  assert.ok(proposal.patch?.merge?.visibilityById?.clue_secret);
  assert.equal(proposal.patch.merge.visibilityById.clue_secret.visibility, "player_visible");
  assert.ok(proposal.patch.merge.visibilityById.clue_secret.knownBy.includes("player"));
  assert.ok(proposal.patch.merge.visibilityById.clue_secret.knownBy.includes("npc_a"));

  // Source record must not mutate without approve
  assert.deepEqual(readRecordVisibility(record), before);
  assert.equal(record.visibility, "gm_only");
  assert.deepEqual(record.knownBy, ["npc_a"]);

  const pending = getByStatus("pending");
  assert.ok(pending.some((p) => p.id === proposal.id), "ingested into proposal-system via bus");
  assert.equal(pending.find((p) => p.id === proposal.id)?.metadata?.busType, "visibility_reveal");
});

test("S4-5 reveal without approve: no overlay write; visibility/knownBy unchanged", async () => {
  resetProposalStore();
  const root = tempRoot("wt-s45-noapprove");
  try {
    const record = { id: "fact_x", visibility: "gm_only", knownBy: ["npc_b"] };
    await writeJson(join(root, "shared", "visibility.json"), { visibilityById: {} });
    await writeJson(join(root, "shared", "world_state.json"), { v: 1 });

    const proposal = submitVisibilityRevealProposal(record, {
      observerId: "player",
      toVisibility: "player_visible",
      modeId: "world-rpg"
    });
    const logPath = join(root, "runtime", "world-proposals.jsonl");
    await appendJsonl(logPath, proposal);

    assert.equal(existsSync(join(root, "runtime", "overlay", "canon-overlay.json")), false);
    assert.equal(readVisibilityOverlayEntry(root, "fact_x"), null);
    assert.equal(record.visibility, "gm_only");
    assert.deepEqual(record.knownBy, ["npc_b"]);
    assert.equal(readJsonSync(join(root, "shared", "visibility.json")).visibilityById?.fact_x, undefined);
    assert.equal(readJsonSync(join(root, "shared", "world_state.json")).v, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetProposalStore();
  }
});

test("S4-5 approve→commit writes visibility via overlay WRITE_POLICY; shared Canon untouched", async () => {
  resetProposalStore();
  const root = tempRoot("wt-s45-approve");
  try {
    const record = { id: "clue_1", visibility: "gm_only", knownBy: ["npc_a"] };
    await writeJson(join(root, "shared", "visibility.json"), { visibilityById: {} });
    await writeJson(join(root, "shared", "world_state.json"), { v: 1 });

    const proposal = submitVisibilityRevealProposal(record, {
      observerId: "player",
      toVisibility: "player_visible",
      addKnownBy: ["ally_1"],
      modeId: "world-rpg",
      round: 4
    });
    assert.equal(record.visibility, "gm_only", "pre-approve record still gm_only");

    const logPath = join(root, "runtime", "world-proposals.jsonl");
    await appendJsonl(logPath, proposal);
    const approved = await approveProposal(
      { projectRoot: root, proposalLog: logPath },
      proposal.id,
      {},
      { currentTurn: 4 }
    );

    assert.equal(approved.ok, true, JSON.stringify(approved));
    assert.equal(approved.writePath, "overlay-store");
    assert.equal(approved.patchApplied, true);

    // Source object still not mutated in-memory (overlay is the write point)
    assert.equal(record.visibility, "gm_only");
    assert.deepEqual(record.knownBy, ["npc_a"]);

    // shared/ Canon untouched
    assert.deepEqual(readJsonSync(join(root, "shared", "visibility.json")), { visibilityById: {} });
    assert.equal(readJsonSync(join(root, "shared", "world_state.json")).v, 1);

    // Documented write point: overlay canon
    assert.ok(existsSync(join(root, "runtime", "overlay", "canon-overlay.json")));
    const entry = readVisibilityOverlayEntry(root, "clue_1");
    assert.ok(entry, "overlay visibilityById.clue_1 present after commit");
    assert.equal(entry.visibility, "player_visible");
    assert.equal(entry.fromVisibility, "gm_only");
    assert.ok(entry.knownBy.includes("player"));
    assert.ok(entry.knownBy.includes("npc_a"));
    assert.ok(entry.knownBy.includes("ally_1"));
    assert.equal(entry.kind, "visibility_reveal");
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetProposalStore();
  }
});
