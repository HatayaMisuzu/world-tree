// Tabletop V2 runtime paths (namespace data/engine/tabletop-v2/).

import { existsSync, mkdirSync } from "node:fs";
import { join, sep } from "node:path";

// ── Path guard ──

export function assertTabletopV2RuntimePath(path) {
  if (!String(path).includes(`${sep}tabletop-v2${sep}`)) {
    throw new Error(`Tabletop V2 runtime path escaped namespace: ${path}`);
  }
}

// ── Paths ──

export function moduleDir(dataRoot, moduleId) {
  return join(dataRoot, "engine", "tabletop-v2", "modules", moduleId);
}

export function runsDir(dataRoot) {
  return join(dataRoot, "engine", "tabletop-v2", "runs");
}

export function runDir(dataRoot, runId) {
  return join(runsDir(dataRoot), runId);
}

export function savesDir(dataRoot, runId) {
  return join(runDir(dataRoot, runId), "saves");
}

export function branchesDir(dataRoot, runId) {
  return join(runDir(dataRoot, runId), "branches");
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
