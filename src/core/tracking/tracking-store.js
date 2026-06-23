import { join } from "node:path";
import { appendJsonl, readJsonlTail, readJson, writeJson } from "../../server/fs-utils.js";

const trackingPath = (projectRoot, name) => join(projectRoot, "runtime", "tracking", name);
const envelope = () => ({ version: 1, updatedAt: null, items: [] });

export async function appendChange(projectRoot, change = {}) {
  const entry = {
    id: change.id || `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: change.timestamp || new Date().toISOString(),
    modeId: change.modeId || "",
    sceneId: change.sceneId || "",
    source: change.source || "system",
    proposalId: change.proposalId || null,
    moduleId: change.moduleId || "",
    targetFile: change.targetFile || "",
    fieldPath: change.fieldPath || "",
    oldValue: change.oldValue ?? null,
    newValue: change.newValue ?? null,
    reason: change.reason || "",
    changeType: change.changeType || "state_update",
    impactLevel: change.impactLevel || "medium",
    rippleDepth: Math.max(0, Math.min(3, Number(change.rippleDepth || 0))),
    causedBy: change.causedBy || null
  };
  await appendJsonl(trackingPath(projectRoot, "change-log.jsonl"), entry);
  return entry;
}

export function readRecentChanges(projectRoot, limit = 20) {
  return readJsonlTail(trackingPath(projectRoot, "change-log.jsonl"), Math.max(1, Math.min(200, limit)));
}

async function updateItems(projectRoot, fileName, updater) {
  const path = trackingPath(projectRoot, fileName);
  const current = await readJson(path, envelope());
  const next = updater({ ...envelope(), ...current, items: Array.isArray(current?.items) ? [...current.items] : [] });
  next.updatedAt = new Date().toISOString();
  await writeJson(path, next);
  return next;
}

export function upsertForeshadowing(projectRoot, item = {}) {
  return updateItems(projectRoot, "foreshadowing.json", (data) => {
    const id = item.id || `fsh_${Date.now()}`;
    const index = data.items.findIndex((entry) => entry.id === id);
    const next = { status: "active", importance: "medium", visibility: "player_known", ...item, id };
    index >= 0 ? data.items.splice(index, 1, { ...data.items[index], ...next }) : data.items.push(next);
    return data;
  });
}

export function resolveForeshadowing(projectRoot, id, resolution = {}) {
  return updateItems(projectRoot, "foreshadowing.json", (data) => {
    const item = data.items.find((entry) => entry.id === id);
    if (item) Object.assign(item, { status: "resolved", resolvedAt: new Date().toISOString(), resolution });
    return data;
  });
}

export function upsertConflict(projectRoot, conflict = {}) {
  return updateItems(projectRoot, "conflicts.json", (data) => {
    const id = conflict.id || `conf_${Date.now()}`;
    const index = data.items.findIndex((entry) => entry.id === id);
    const next = { status: "open", severity: "medium", ...conflict, id, detectedAt: conflict.detectedAt || new Date().toISOString() };
    index >= 0 ? data.items.splice(index, 1, { ...data.items[index], ...next }) : data.items.push(next);
    return data;
  });
}

export function resolveConflict(projectRoot, id, resolution = {}) {
  return updateItems(projectRoot, "conflicts.json", (data) => {
    const item = data.items.find((entry) => entry.id === id);
    if (item) Object.assign(item, { status: "resolved", resolvedAt: new Date().toISOString(), resolution });
    return data;
  });
}

export async function readTrackingCollections(projectRoot) {
  const [changes, foreshadowing, conflicts] = await Promise.all([
    readRecentChanges(projectRoot, 50),
    readJson(trackingPath(projectRoot, "foreshadowing.json"), envelope()),
    readJson(trackingPath(projectRoot, "conflicts.json"), envelope())
  ]);
  return { changes, foreshadowing, conflicts };
}
