export function validateWorldbook(worldbook = {}, options = {}) {
  const errors = [], warnings = [];
  if (!worldbook.schemaVersion) errors.push({ code: "missing_schema", message: "schemaVersion required" });
  if (!Array.isArray(worldbook.entries)) errors.push({ code: "invalid_entries", message: "entries must be array" });
  return { ok: errors.length === 0, errors, warnings };
}

export function validateWorldbookEntry(entry = {}, options = {}) {
  const errors = [], warnings = [];
  if (!entry.id) errors.push({ code: "missing_id", message: "entry id required" });
  if (!entry.content) warnings.push({ code: "empty_content", message: "entry has no content" });
  return { ok: errors.length === 0, errors, warnings };
}

export function validateScenes(scenes = {}, options = {}) {
  const errors = [], warnings = [];
  if (!Array.isArray(scenes.items)) errors.push({ code: "invalid_items", message: "items must be array" });
  return { ok: errors.length === 0, errors, warnings };
}

export function validateWorldState(state = {}, options = {}) {
  return { ok: true, errors: [], warnings: [] };
}

export function validateTimeline(timeline = {}, options = {}) {
  return { ok: Array.isArray(timeline.events), errors: Array.isArray(timeline.events) ? [] : [{ code: "invalid_events", message: "events must be array" }], warnings: [] };
}

export function validateStateProposal(proposal = {}, options = {}) {
  const errors = [], warnings = [];
  if (!proposal.type) errors.push({ code: "missing_type", message: "proposal type required" });
  if (!proposal.summary) errors.push({ code: "missing_summary", message: "proposal summary required" });
  if (!["pending","approved","rejected"].includes(proposal.status)) errors.push({ code: "invalid_status", message: `invalid status: ${proposal.status}` });
  return { ok: errors.length === 0, errors, warnings };
}
