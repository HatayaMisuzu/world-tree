// Detective V2 Player Notebook
// Side-panel notebook at data layer. Player records discoveries, links evidence, marks credibility.
// No UI in Step 1.

export const NOTE_CREDIBILITY_LABELS = [
  "unverified", "observed", "documented", "claimed",
  "suspicious", "confirmed", "disproved", "key", "misleading",
];

export function createNotebookState(input = {}) {
  return {
    notebookId: input.notebookId || `nb_${Date.now()}`,
    caseId: input.caseId || "",
    entries: input.entries || [],
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    tags: input.tags || [],
  };
}

export function createNotebookEntryFromSelection(selection = {}, options = {}) {
  if (!selection || typeof selection !== "object") return null;
  return {
    noteId: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceType: selection.sourceType || options.sourceType || "evidence",
    sourceId: selection.sourceId || selection.evidenceId || selection.testimonyId || "",
    rawQuote: selection.rawQuote || selection.quote || "",
    summary: selection.summary || options.summary || "",
    playerNote: selection.playerNote || options.playerNote || "",
    credibility: NOTE_CREDIBILITY_LABELS.includes(selection.credibility || options.credibility)
      ? (selection.credibility || options.credibility) : "unverified",
    tags: [...(selection.tags || []), ...(options.tags || [])],
    links: selection.links || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateNotebookEntry(notebook = {}, entryId, patch = {}) {
  if (!notebook?.entries) return notebook;
  const entries = notebook.entries.map((e) => {
    if (e.noteId !== entryId) return e;
    return {
      ...e,
      ...patch,
      updatedAt: new Date().toISOString(),
      tags: patch.tags ? [...new Set([...(e.tags || []), ...patch.tags])] : e.tags,
    };
  });
  return { ...notebook, entries, updatedAt: new Date().toISOString() };
}

export function linkNotebookEntry(notebook = {}, entryId, link = {}) {
  if (!notebook?.entries) return notebook;
  const entries = notebook.entries.map((e) => {
    if (e.noteId !== entryId) return e;
    return { ...e, links: [...(e.links || []), link], updatedAt: new Date().toISOString() };
  });
  return { ...notebook, entries, updatedAt: new Date().toISOString() };
}

export function filterNotebookEntries(notebook = {}, filter = {}) {
  if (!notebook?.entries) return [];
  let results = [...notebook.entries];
  if (filter.sourceType) results = results.filter((e) => e.sourceType === filter.sourceType);
  if (filter.credibility) results = results.filter((e) => e.credibility === filter.credibility);
  if (filter.tag) results = results.filter((e) => (e.tags || []).includes(filter.tag));
  if (filter.search) {
    const q = filter.search.toLowerCase();
    results = results.filter((e) =>
      (e.summary || "").toLowerCase().includes(q) ||
      (e.rawQuote || "").toLowerCase().includes(q) ||
      (e.playerNote || "").toLowerCase().includes(q)
    );
  }
  return results;
}

export function validateNotebookState(notebook = {}) {
  const errors = [];
  if (!notebook.notebookId) errors.push("notebookId is required");
  if (!Array.isArray(notebook.entries)) errors.push("entries must be an array");
  return { valid: errors.length === 0, errors };
}
