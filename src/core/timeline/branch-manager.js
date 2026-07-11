import { cp, mkdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readJson, writeJson } from "../../shared/fs-utils.js";
import { ensureTimelineTree, writeTimelineTree } from "./timeline-tree.js";
import { assertBranchId } from "./branch-policy.js";

const branchInitializationInFlight = new Map();

async function exists(path) { try { await access(path); return true; } catch { return false; } }
export function resolveBranchPath(projectRoot, branchId) { return join(projectRoot, "branches", assertBranchId(branchId)); }
export async function getActiveBranch(projectRoot) { const tree = await ensureTimelineTree(projectRoot); return tree.branches[tree.activeBranchId] || null; }
export async function resolveActiveBranchProjectRoot(projectRoot) { const branch = await getActiveBranch(projectRoot); return resolveBranchPath(projectRoot, branch.id); }
async function initializeBranchTreeOnce(projectRoot) { const tree = await ensureTimelineTree(projectRoot); const mainRoot = resolveBranchPath(projectRoot, "main"); await mkdir(mainRoot, { recursive: true }); for (const folder of ["shared", "runtime"]) { const source = join(projectRoot, folder); const target = join(mainRoot, folder); if (!(await exists(target))) { if (await exists(source)) await cp(source, target, { recursive: true }); else await mkdir(target, { recursive: true }); } } await writeJson(join(mainRoot, "branch-meta.json"), tree.branches.main); return tree; }
export async function initializeBranchTree(projectRoot) {
  const key = resolve(projectRoot);
  const current = branchInitializationInFlight.get(key);
  if (current) return await current;

  const initialization = initializeBranchTreeOnce(key);
  branchInitializationInFlight.set(key, initialization);
  try {
    return await initialization;
  } finally {
    if (branchInitializationInFlight.get(key) === initialization) {
      branchInitializationInFlight.delete(key);
    }
  }
}
export async function createBranch(projectRoot, options = {}) { const id = assertBranchId(options.id); const tree = await initializeBranchTree(projectRoot); if (tree.branches[id]) throw new Error("branch already exists"); const sourceId = options.sourceBranchId || tree.activeBranchId; const source = resolveBranchPath(projectRoot, sourceId); const target = resolveBranchPath(projectRoot, id); await cp(source, target, { recursive: true }); const meta = { id, label: options.label || id, parentBranchId: sourceId, createdFrom: options.createdFrom || null, createdAt: new Date().toISOString(), status: "available" }; tree.branches[id] = meta; await writeJson(join(target, "branch-meta.json"), meta); await writeTimelineTree(projectRoot, tree); return meta; }
export async function switchBranch(projectRoot, branchId) { assertBranchId(branchId); const tree = await initializeBranchTree(projectRoot); if (!tree.branches[branchId]) throw new Error("branch not found"); if (tree.branches[branchId].status === "archived") throw new Error("branch is archived"); for (const branch of Object.values(tree.branches)) if (branch.status === "active") branch.status = "available"; tree.activeBranchId = branchId; tree.branches[branchId].status = "active"; await writeTimelineTree(projectRoot, tree); await writeJson(join(projectRoot, "active-branch.json"), { branchId, updatedAt: new Date().toISOString() }); return tree.branches[branchId]; }
export async function listBranches(projectRoot) { return Object.values((await initializeBranchTree(projectRoot)).branches); }
export async function archiveBranch(projectRoot, branchId) { const tree = await initializeBranchTree(projectRoot); if (branchId === tree.activeBranchId || branchId === tree.rootBranchId) throw new Error("cannot archive active or root branch"); if (!tree.branches[branchId]) throw new Error("branch not found"); tree.branches[branchId].status = "archived"; await writeTimelineTree(projectRoot, tree); return tree.branches[branchId]; }
