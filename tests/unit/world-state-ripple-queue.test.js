import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  rootChangeFromStateSuggestion,
  enqueueRippleProposals
} from "../../src/core/world-state/world-state-ripple-queue.js";
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

test("rootChangeFromStateSuggestion synthesizes depth-2 effects for major impact", () => {
  const root = rootChangeFromStateSuggestion({
    "状态建议": { impactLevel: "major", stateId: "capital", summary: "siege" }
  }, { input: "攻城", round: 3 });
  assert.ok(root);
  assert.equal(root.impactLevel, "major");
  assert.equal(root.effects.some((e) => e.depth === 2), true);
});

test("rootChangeFromStateSuggestion ignores light/medium without effects", () => {
  assert.equal(rootChangeFromStateSuggestion({ "状态建议": { impactLevel: "medium", stateId: "x" } }), null);
  assert.equal(rootChangeFromStateSuggestion({}), null);
});

test("enqueueRippleProposals puts depth≥2 into pending proposal queue", () => {
  resetProposalStore();
  const root = {
    id: "siege_root",
    stateId: "capital",
    impactLevel: "major",
    effects: [
      { depth: 1, confidence: 0.9, stateId: "capital_direct", summary: "direct" },
      { depth: 2, confidence: 0.8, stateId: "harbor", summary: "harbor threatened" },
      { depth: 3, confidence: 0.9, stateId: "rumor", summary: "hook" }
    ]
  };
  const { ripple, proposals } = enqueueRippleProposals("", root, { modeId: "world-rpg" });
  assert.equal(ripple.maxDepth, 2);
  assert.ok(proposals.length >= 1);
  assert.equal(proposals.every((p) => p.status === "pending" && Number(p.rippleDepth) >= 2), true);
  assert.equal(proposals.every((p) => p.causedBy === "siege_root"), true);
});

test("S4-2 depth≥2 ripple proposals visible in proposal-bus queue with id/type/depth", () => {
  resetProposalStore();
  const root = {
    id: "siege_root",
    stateId: "capital",
    impactLevel: "major",
    effects: [
      { depth: 1, confidence: 0.9, stateId: "capital_direct", summary: "direct", value: "hit" },
      { depth: 2, confidence: 0.8, stateId: "harbor", summary: "harbor threatened", value: "evacuate" }
    ]
  };
  const { proposals } = enqueueRippleProposals("", root, { modeId: "world-rpg" });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].type, "world_state_update");
  assert.equal(Number(proposals[0].rippleDepth), 2);

  const pending = getByStatus("pending");
  const queued = pending.filter((p) => Number(p.rippleDepth) >= 2);
  assert.equal(queued.length, 1, "depth≥2 must land in proposal-system via proposal-bus");
  assert.ok(queued[0].id, "assertable id");
  assert.equal(queued[0].typeName || queued[0].metadata?.busType, "world_state_update");
  assert.equal(Number(queued[0].rippleDepth), 2);
  assert.equal(queued[0].causedBy, "siege_root");
  assert.equal(queued[0].id, proposals[0].id);
});

test("S4-2 depth<2 (and light roots) stay out of proposal queue", () => {
  resetProposalStore();
  const depth1Only = {
    id: "skirmish",
    stateId: "gate",
    impactLevel: "medium",
    effects: [
      { depth: 1, confidence: 0.9, stateId: "gate_direct", summary: "clash" },
      { depth: 2, confidence: 0.8, stateId: "should_be_capped", summary: "ignored by maxDepth" }
    ]
  };
  const { ripple, proposals } = enqueueRippleProposals("", depth1Only, { modeId: "world-rpg" });
  assert.equal(ripple.maxDepth, 1);
  assert.equal(proposals.length, 0);
  assert.equal(getByStatus("pending").filter((p) => Number(p.rippleDepth) >= 2).length, 0);

  resetProposalStore();
  const explicitDepth1 = {
    id: "d1_only",
    stateId: "camp",
    impactLevel: "critical",
    effects: [{ depth: 1, confidence: 0.95, stateId: "camp_hit", summary: "auto only" }]
  };
  const again = enqueueRippleProposals("", explicitDepth1, { modeId: "world-rpg" });
  assert.equal(again.proposals.length, 0);
  assert.equal(getByStatus("pending").length, 0);
});

test("S4-2 enqueue leaves Canon untouched; approve via bus writes overlay", async () => {
  resetProposalStore();
  const root = tempRoot("wt-s42-canon");
  try {
    await writeJson(join(root, "shared", "world_state.json"), { v: 1, states: {} });
    const changeRoot = {
      id: "siege_root",
      stateId: "capital",
      impactLevel: "major",
      effects: [
        { depth: 1, confidence: 0.9, stateId: "capital_direct", summary: "direct" },
        { depth: 2, confidence: 0.8, stateId: "harbor", summary: "harbor threatened", value: "evacuate" }
      ]
    };
    const { proposals } = enqueueRippleProposals(root, changeRoot, { modeId: "world-rpg" });
    assert.equal(proposals.length, 1);
    assert.equal(readJsonSync(join(root, "shared", "world_state.json")).v, 1);
    assert.equal(existsSync(join(root, "runtime", "overlay", "canon-overlay.json")), false);

    const logPath = join(root, "runtime", "world-proposals.jsonl");
    await appendJsonl(logPath, proposals[0]);
    const approved = await approveProposal(
      { projectRoot: root, proposalLog: logPath },
      proposals[0].id,
      {},
      { currentTurn: 5 }
    );
    assert.equal(approved.ok, true);
    assert.equal(approved.writePath, "overlay-store");
    assert.equal(readJsonSync(join(root, "shared", "world_state.json")).v, 1, "shared Canon still untouched");
    assert.ok(existsSync(join(root, "runtime", "overlay", "canon-overlay.json")), "overlay written via WRITE_POLICY");
    const overlay = readJsonSync(join(root, "runtime", "overlay", "canon-overlay.json"));
    assert.ok(overlay.harbor === "evacuate" || overlay.states || Object.keys(overlay).length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetProposalStore();
  }
});
