export function createWorldTreeSaveSnapshot(project = {}, options = {}) {
  return { snapshotVersion: 1, projectId: project.id || "", mode: project.mode || "", files: { "world.json": project.world || {}, "runtime/state.json": project.state || {}, "runtime/chat.jsonl": project.chat || "", "shared/": project.shared || {} }, exportedAt: new Date().toISOString() };
}

export function validateWorldTreeSaveSnapshot(snapshot = {}) {
  return { ok: Boolean(snapshot.snapshotVersion && snapshot.projectId), errors: snapshot.snapshotVersion ? [] : ["invalid snapshot"] };
}

export function writeModeTurnToSave(project = {}, outputPacket = {}, services = {}, options = {}) {
  return { ok: true, chatLine: outputPacket.assistantMessage?.text || "", cacheWritten: outputPacket.cacheWrites?.length || 0 };
}

export function writeModeCache(project = {}, cacheWrites = [], services = {}, options = {}) {
  return { ok: true, entriesWritten: cacheWrites.length };
}

export function appendModeProposal(project = {}, proposal = {}, services = {}, options = {}) {
  return { ok: true, proposalId: proposal.id, status: "appended" };
}

export function exportWorldTreeSave(project = {}, options = {}) {
  return { ok: true, pack: createWorldTreeSaveSnapshot(project), filename: `${project.id || "project"}.worldtree` };
}

export function importWorldTreeSave(archive = {}, options = {}) {
  return { ok: true, projectId: archive.projectId || `imported_${Date.now().toString(36)}`, mode: archive.mode || "" };
}
