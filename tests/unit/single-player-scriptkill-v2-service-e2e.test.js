import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };

import {
  commitSinglePlayerScriptKillV2Import,
  startSinglePlayerScriptKillV2,
  loadSinglePlayerScriptKillV2Run,
  advancePhaseSinglePlayerScriptKillV2,
  publicTalkSinglePlayerScriptKillV2,
  searchSinglePlayerScriptKillV2,
  revealClueSinglePlayerScriptKillV2,
  voteSinglePlayerScriptKillV2,
  debriefSinglePlayerScriptKillV2,
  exportRunSinglePlayerScriptKillV2,
} from "../../src/server/single-player-scriptkill-v2-service.js";

async function withTempDataRoot(fn) {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-scriptkill-v2-"));
  try { return await fn(dataRoot); }
  finally { rmSync(dataRoot, { recursive: true, force: true }); }
}

function readRunFile(dataRoot, runId) {
  return JSON.parse(readFileSync(join(dataRoot, "engine", "single-player-scriptkill-v2", "runs", runId, "run-state.json"), "utf-8"));
}

test("service e2e persists phase changes and completes solo scriptkill flow", async () => withTempDataRoot(async (dataRoot) => {
  const imported = await commitSinglePlayerScriptKillV2Import({ package: fixture }, { dataRoot });
  assert.equal(imported.status, "ok", JSON.stringify(imported));
  assert.equal(imported.package.entryDisplayName, "单人剧本杀");

  const started = await startSinglePlayerScriptKillV2({
    scriptId: imported.scriptId,
    runId: "run_service_e2e",
    realPlayerRoleId: "role_writer",
  }, { dataRoot });
  assert.equal(started.status, "ok", JSON.stringify(started));

  let advanced = await advancePhaseSinglePlayerScriptKillV2({
    runId: started.runId,
    nextPhaseId: "phase_public",
    reason: "service-e2e-public",
  }, { dataRoot });
  assert.equal(advanced.status, "ok", JSON.stringify(advanced));
  assert.equal(advanced.runState.currentPhaseId, "phase_public");
  assert.equal(readRunFile(dataRoot, started.runId).currentPhaseId, "phase_public", "advance-phase must persist run-state.json");

  const talk = await publicTalkSinglePlayerScriptKillV2({
    runId: started.runId,
    text: "我先说明我的时间线。",
  }, { dataRoot });
  assert.equal(talk.status, "ok", JSON.stringify(talk));
  assert.ok(talk.playerRun.publicBoard.transcript.length >= 1);
  assert.ok(!JSON.stringify(talk.playerRun).includes("DM手册"));
  assert.ok(!JSON.stringify(talk.playerRun).includes("真正凶手"));

  advanced = await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_search" }, { dataRoot });
  assert.equal(advanced.status, "ok", JSON.stringify(advanced));
  assert.equal(readRunFile(dataRoot, started.runId).currentPhaseId, "phase_search", "search phase must persist");

  const search = await searchSinglePlayerScriptKillV2({ runId: started.runId, clueId: "clue_watch", keepPrivate: true }, { dataRoot });
  assert.equal(search.status, "ok", JSON.stringify(search));
  assert.ok(readRunFile(dataRoot, started.runId).searchState.privateKeptClueIds.includes("clue_watch"));

  const reveal = await revealClueSinglePlayerScriptKillV2({ runId: started.runId, clueId: "clue_watch" }, { dataRoot });
  assert.equal(reveal.status, "ok", JSON.stringify(reveal));
  assert.ok(readRunFile(dataRoot, started.runId).publicBoard.revealedClueIds.includes("clue_watch"));

  advanced = await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_vote" }, { dataRoot });
  assert.equal(advanced.status, "ok", JSON.stringify(advanced));
  assert.equal(readRunFile(dataRoot, started.runId).currentPhaseId, "phase_vote");

  const vote = await voteSinglePlayerScriptKillV2({ runId: started.runId, targetRoleId: "role_doctor", reason: "线索与时间线矛盾" }, { dataRoot });
  assert.equal(vote.status, "ok", JSON.stringify(vote));
  assert.equal(readRunFile(dataRoot, started.runId).voteState.finalVoteSubmitted, true);

  advanced = await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_debrief" }, { dataRoot });
  assert.equal(advanced.status, "ok", JSON.stringify(advanced));
  assert.equal(readRunFile(dataRoot, started.runId).currentPhaseId, "phase_debrief");

  const debrief = await debriefSinglePlayerScriptKillV2({ runId: started.runId }, { dataRoot });
  assert.equal(debrief.status, "ok", JSON.stringify(debrief));
  assert.ok(debrief.debrief.truthReview || debrief.debrief.summary);

  const exported = await exportRunSinglePlayerScriptKillV2({ runId: started.runId }, { dataRoot });
  assert.equal(exported.status, "ok", JSON.stringify(exported));
  assert.equal(exported.export.package.entryDisplayName, "单人剧本杀");
  assert.ok(!JSON.stringify(exported.export.playerRun).includes("DM手册"));
  assert.ok(!JSON.stringify(exported.export.playerRun).includes("真正凶手"));

  const loaded = await loadSinglePlayerScriptKillV2Run({ runId: started.runId }, { dataRoot });
  assert.equal(loaded.status, "ok", JSON.stringify(loaded));
  assert.equal(loaded.playerRun.currentPhaseId, "phase_debrief");
}));
