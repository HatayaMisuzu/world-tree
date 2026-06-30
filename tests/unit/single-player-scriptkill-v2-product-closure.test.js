import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import fixture from "../fixtures/single-player-scriptkill-v2/ready-package.json" with { type: "json" };
import { advancePhaseSinglePlayerScriptKillV2, commitSinglePlayerScriptKillV2Import, debriefSinglePlayerScriptKillV2, exportRunSinglePlayerScriptKillV2, loadSinglePlayerScriptKillV2Run, privateChatSinglePlayerScriptKillV2, publicTalkSinglePlayerScriptKillV2, readSinglePlayerScriptKillV2RoleAct, searchSinglePlayerScriptKillV2, startSinglePlayerScriptKillV2, voteSinglePlayerScriptKillV2 } from "../../src/server/single-player-scriptkill-v2-service.js";

test("scriptkill user package loop preserves role knowledge boundary", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-scriptkill-product-"));
  try {
    const deps = { dataRoot };
    const imported = await commitSinglePlayerScriptKillV2Import({ package: fixture }, deps);
    assert.equal(imported.status, "ok");
    const started = await startSinglePlayerScriptKillV2({ scriptId: imported.scriptId, runId: "scriptkill_product", realPlayerRoleId: "role_writer" }, deps);
    assert.equal(started.status, "ok");
    const roleAct = await readSinglePlayerScriptKillV2RoleAct({ runId: started.runId }, deps);
    assert.equal(roleAct.status, "ok");
    await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_public" }, deps);
    const talk = await publicTalkSinglePlayerScriptKillV2({ runId: started.runId, text: "I state my timeline." }, deps);
    assert.equal(talk.status, "ok");
    await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_private" }, deps);
    const privateChat = await privateChatSinglePlayerScriptKillV2({ runId: started.runId, targetRoleId: "role_doctor", text: "Private question." }, deps);
    assert.equal(privateChat.status, "ok");
    await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_search" }, deps);
    const search = await searchSinglePlayerScriptKillV2({ runId: started.runId, clueId: "clue_watch", keepPrivate: true }, deps);
    assert.equal(search.status, "ok");
    await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_vote" }, deps);
    const vote = await voteSinglePlayerScriptKillV2({ runId: started.runId, targetRoleId: "role_doctor" }, deps);
    assert.equal(vote.status, "ok");
    await advancePhaseSinglePlayerScriptKillV2({ runId: started.runId, nextPhaseId: "phase_debrief" }, deps);
    const debrief = await debriefSinglePlayerScriptKillV2({ runId: started.runId }, deps);
    assert.equal(debrief.status, "ok");
    const exported = await exportRunSinglePlayerScriptKillV2({ runId: started.runId }, deps);
    const loaded = await loadSinglePlayerScriptKillV2Run({ runId: started.runId }, deps);
    assert.equal(exported.status, "ok");
    assert.equal(loaded.status, "ok");
    const playerVisible = JSON.stringify({ roleAct, talk, privateChat, search, exported });
    assert.equal(playerVisible.includes("DM手册"), false);
    assert.equal(playerVisible.includes("真正凶手"), false);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
