import test from "node:test";
import assert from "node:assert/strict";
import { createNotebookState, createNotebookEntryFromSelection, updateNotebookEntry, linkNotebookEntry, filterNotebookEntries, NOTE_CREDIBILITY_LABELS } from "../../src/core/detective/detective-player-notebook.js";

test("createNotebookState: default", () => {
  const nb = createNotebookState();
  assert.ok(nb.notebookId);
  assert.ok(Array.isArray(nb.entries));
});

test("createNotebookEntryFromSelection: from evidence", () => {
  const entry = createNotebookEntryFromSelection({ sourceType: "evidence", evidenceId: "e1", summary: "Bloody knife", credibility: "suspicious" });
  assert.equal(entry.sourceType, "evidence");
  assert.equal(entry.credibility, "suspicious");
});

test("updateNotebookEntry: updates summary", () => {
  let nb = createNotebookState();
  const e = createNotebookEntryFromSelection({ summary: "old" });
  nb.entries.push(e);
  nb = updateNotebookEntry(nb, e.noteId, { summary: "new" });
  assert.equal(nb.entries[0].summary, "new");
});

test("linkNotebookEntry: adds link", () => {
  let nb = createNotebookState();
  const e1 = createNotebookEntryFromSelection({ summary: "A" });
  const e2 = createNotebookEntryFromSelection({ summary: "B" });
  nb.entries.push(e1);
  nb = linkNotebookEntry(nb, e1.noteId, { targetNoteId: e2.noteId, type: "related" });
  assert.equal(nb.entries[0].links.length, 1);
});

test("filterNotebookEntries: by credibility", () => {
  let nb = createNotebookState();
  nb.entries.push(createNotebookEntryFromSelection({ summary: "A", credibility: "confirmed" }));
  nb.entries.push(createNotebookEntryFromSelection({ summary: "B", credibility: "suspicious" }));
  const filtered = filterNotebookEntries(nb, { credibility: "confirmed" });
  assert.equal(filtered.length, 1);
});

test("NOTE_CREDIBILITY_LABELS includes key labels", () => {
  assert.ok(NOTE_CREDIBILITY_LABELS.includes("unverified"));
  assert.ok(NOTE_CREDIBILITY_LABELS.includes("confirmed"));
  assert.ok(NOTE_CREDIBILITY_LABELS.includes("key"));
});
