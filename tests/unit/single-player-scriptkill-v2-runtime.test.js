import test from "node:test";
import assert from "node:assert/strict";
import { createSinglePlayerScriptKillPackage } from "../../src/core/single-player-scriptkill/single-player-scriptkill-package.js";
import { createSinglePlayerScriptKillRun, stripSinglePlayerScriptKillRunForPlayer } from "../../src/core/single-player-scriptkill/single-player-scriptkill-runtime-state.js";
import { readCurrentRoleAct, performPublicTalk, performSearch, performRevealClue, advanceSinglePlayerScriptKillPhase, performVote, performDebrief } from "../../src/core/single-player-scriptkill/single-player-scriptkill-solo-runtime.js";
import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };

test("solo runtime supports read, talk, search, reveal, vote, debrief closure", () => {
  const pkg = createSinglePlayerScriptKillPackage(fixture);
  let run = createSinglePlayerScriptKillRun(pkg, { realPlayerRoleId: "role_writer", runId: "run_test" });

  const read = readCurrentRoleAct(pkg, run);
  assert.equal(read.status, "ok");
  assert.ok(read.acts.length >= 1);

  // Advance to public discussion phase before public talk
  let adv = advanceSinglePlayerScriptKillPhase({ packageData: pkg, runState: run, nextPhaseId: "phase_public" });
  assert.equal(adv.status, "ok");
  run = adv.state;

  let talk = performPublicTalk({ packageData: pkg, runState: run, realPlayerText: "我先说我的时间线。" });
  assert.equal(talk.status, "ok");
  run = talk.runState;
  assert.ok(talk.messages.every(m => m.speaker.visibleName && !m.speaker.visibleName.includes("小岚")));

  adv = advanceSinglePlayerScriptKillPhase({ packageData: pkg, runState: run, nextPhaseId: "phase_search" });
  assert.equal(adv.status, "ok");
  run = adv.state;

  let search = performSearch({ packageData: pkg, runState: run, clueId: "clue_watch", keepPrivate: true });
  assert.equal(search.status, "ok");
  run = search.runState;

  let reveal = performRevealClue({ packageData: pkg, runState: run, clueId: "clue_watch" });
  assert.equal(reveal.status, "ok");
  run = reveal.runState;
  assert.ok(run.publicBoard.revealedClueIds.includes("clue_watch"));

  adv = advanceSinglePlayerScriptKillPhase({ packageData: pkg, runState: run, nextPhaseId: "phase_vote" });
  run = adv.state;
  const vote = performVote({ packageData: pkg, runState: run, targetRoleId: "role_doctor", reason: "线索矛盾" });
  assert.equal(vote.status, "ok");
  run = vote.runState;

  adv = advanceSinglePlayerScriptKillPhase({ packageData: pkg, runState: run, nextPhaseId: "phase_debrief" });
  run = adv.state;
  const debrief = performDebrief({ packageData: pkg, runState: run });
  assert.equal(debrief.status, "ok");

  const playerRun = stripSinglePlayerScriptKillRunForPlayer(pkg, run);
  assert.equal(playerRun.dmBook, undefined);
  assert.ok(!JSON.stringify(playerRun).includes("真正凶手"));
});
