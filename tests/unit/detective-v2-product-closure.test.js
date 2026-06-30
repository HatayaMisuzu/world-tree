import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { commitDetectiveV2Import, exportDetectiveV2GMPack, exportDetectiveV2PlayerPack, exportDetectiveV2Run, extractDetectiveV2Notebook, interrogateDetectiveV2, investigateDetectiveV2, startDetectiveV2Run, submitDetectiveV2Deduction, updateDetectiveV2Notebook } from "../../src/server/detective-v2-service.js";

function caseText() {
  return JSON.stringify({
    title: "Structural Case",
    truthLedger: { culpritIds: ["suspect_a"], motive: "hidden motive", method: "hidden method" },
    locations: [{ locationId: "room", name: "Room", isStartingLocation: true }],
    evidence: [{ evidenceId: "note", name: "Public Note", locationId: "room", summary: "A public clue.", hiddenMeaning: "SECRET_SOLUTION" }],
    characters: [{ characterId: "suspect_a", name: "Suspect A", isCulprit: true }],
    testimony: [{ testimonyId: "t1", characterId: "suspect_a", publicText: "I was nearby.", deceptionReason: "SECRET_LIE" }]
  });
}

test("detective start/investigate/interrogate/notebook/deduction/export separates player and GM truth", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "wt-detective-product-"));
  try {
    const deps = { dataRoot };
    const committed = await commitDetectiveV2Import({ text: caseText() }, deps);
    assert.equal(committed.status, "ok");
    const started = await startDetectiveV2Run({ caseId: committed.caseId }, deps);
    assert.equal(started.status, "ok");
    const investigation = await investigateDetectiveV2({ runId: started.run.runId, locationId: "room" }, deps);
    assert.equal(investigation.status, "ok");
    const interrogation = await interrogateDetectiveV2({ runId: started.run.runId, characterId: "suspect_a" }, deps);
    assert.equal(interrogation.status, "ok");
    const extracted = await extractDetectiveV2Notebook({ runId: started.run.runId, selection: { sourceType: "evidence", sourceId: "note" } }, deps);
    assert.equal(extracted.status, "ok");
    const note = await updateDetectiveV2Notebook({ runId: started.run.runId, entryId: extracted.entry.noteId, patch: { summary: "Player-written." } }, deps);
    assert.equal(note.status, "ok");
    const deduction = await submitDetectiveV2Deduction({ runId: started.run.runId, report: { culpritId: "suspect_a", method: "guess" } }, deps);
    assert.equal(deduction.status, "ok");
    const runExport = await exportDetectiveV2Run({ runId: started.run.runId }, deps);
    const playerPack = await exportDetectiveV2PlayerPack({ runId: started.run.runId }, deps);
    const gmPack = await exportDetectiveV2GMPack({ runId: started.run.runId }, deps);
    assert.equal(runExport.status, "ok");
    assert.equal(playerPack.status, "ok");
    assert.equal(gmPack.status, "ok");
    assert.equal(JSON.stringify({ investigation, interrogation, note, deduction, runExport, playerPack }).includes("SECRET_SOLUTION"), false);
    assert.equal(JSON.stringify(gmPack).includes("hidden motive"), true);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
