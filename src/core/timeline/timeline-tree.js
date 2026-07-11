import { join } from "node:path";
import { readJson, writeJson } from "../../shared/fs-utils.js";
const treePath = (root) => join(root, "timeline-tree.json");
export async function readTimelineTree(projectRoot) { return readJson(treePath(projectRoot), null); }
export async function writeTimelineTree(projectRoot, tree) { await writeJson(treePath(projectRoot), tree); return tree; }
export async function ensureTimelineTree(projectRoot) { let tree = await readTimelineTree(projectRoot); if (!tree) { const now = new Date().toISOString(); tree = { version: 1, rootBranchId: "main", activeBranchId: "main", branches: { main: { id: "main", label: "Main Timeline", parentBranchId: null, createdFrom: null, createdAt: now, status: "active" } } }; await writeTimelineTree(projectRoot, tree); await writeJson(join(projectRoot, "active-branch.json"), { branchId: "main", updatedAt: now }); } return tree; }
