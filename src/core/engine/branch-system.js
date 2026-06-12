// ===== 枝干系统 v1 =====
// 世界树核心特色：四态分支管理 + 嫁接合并 + 枯枝标记
// 构建于 world-manager.js 的文件夹分支之上。
//
// 四态模型:
//   active  — 活跃分支，可继续游戏
//   dead    — 枯枝，废弃路线（保留数据可复活）
//   merged  — 已嫁接回目标分支
//   trunk   — 主线（只有一个）
//
// 核心 API:
//   createBranch(worldName, label, divergeEvent)
//   mergeBranch(sourceBranch, targetBranch, mergeEvent)
//   abandonBranch(branchId, reason)
//   compareBranches(branchA, branchB)
//   getBranchTree(worldName)

import { readFile, writeFile, mkdir, cp, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

/** async helper — replaces existsSync */
async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

/** async helper — replaces readJSON (sync) */
async function readJSON(path) {
  if (!(await exists(path))) return null;
  try { return JSON.parse(await readFile(path, "utf-8")); } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
//  branch-meta.json 格式
// ═══════════════════════════════════════════════════════════════

/**
 * 创建分支元数据
 */
function createBranchMeta(opts = {}) {
  return {
    branchId: opts.branchId || `branch-${Date.now()}`,
    parentBranch: opts.parentBranch || "main",
    createdFrom: opts.divergeEvent || null,
    createdAtRound: opts.round || 0,
    status: "active",        // active | dead | merged
    label: opts.label || "",
    description: opts.description || "",
    divergeEvent: opts.divergeEvent || null,
    mergeTarget: null,
    mergeEvent: null,
    mergedAt: null,
    abandonedAt: null,
    abandonReason: "",
    lastPlayedAt: new Date().toISOString(),
    playCount: 0,
    tags: opts.tags || [],
    createdAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════
//  创建分支
// ═══════════════════════════════════════════════════════════════

/**
 * 从当前活跃分支创建新分支
 * @param {string} worldsRoot — 世界文件夹根路径
 * @param {string} worldName — 世界名
 * @param {string} sourceBranch — 源分支 ID（默认 "main"）
 * @param {Object} opts — { label, divergeEvent, round }
 * @returns {Object} 新分支信息
 */
export async function createBranch(worldsRoot, worldName, sourceBranch = "main", opts = {}) {
  const worldDir = join(worldsRoot, worldName);
  if (!(await exists(worldDir))) return { error: `世界「${worldName}」不存在` };

  const srcDir = join(worldDir, "branches", sourceBranch);
  if (!(await exists(srcDir))) return { error: `源分支「${sourceBranch}」不存在` };

  // 生成新分支 ID
  const branchId = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const dstDir = join(worldDir, "branches", branchId);

  // 不允许重复
  if (await exists(dstDir)) return { error: `分支「${branchId}」已存在` };

  // 深拷贝源分支
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir);
  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const dstPath = join(dstDir, entry);
    const st = await stat(srcPath);
    if (st.isDirectory()) {
      await cp(srcPath, dstPath, { recursive: true });
    } else {
      await writeFile(dstPath, await readFile(srcPath));
    }
  }

  // 写入分支元数据
  const meta = createBranchMeta({
    branchId,
    parentBranch: sourceBranch,
    divergeEvent: opts.divergeEvent || null,
    round: opts.round || 0,
    label: opts.label || `${worldName} — 分支 ${branchId.slice(-4)}`,
    description: opts.description || ""
  });
  await writeFile(join(dstDir, "branch-meta.json"), JSON.stringify(meta, null, 2));

  return {
    ok: true,
    branchId,
    parentBranch: sourceBranch,
    path: dstDir,
    meta
  };
}

// ═══════════════════════════════════════════════════════════════
//  分支树
// ═══════════════════════════════════════════════════════════════

/**
 * 获取完整分支树
 * @returns {Object} { trunk, branches: [{ id, parent, status, label, children }] }
 */
export async function getBranchTree(worldsRoot, worldName) {
  const branchesDir = join(worldsRoot, worldName, "branches");
  if (!(await exists(branchesDir))) return { trunk: "main", branches: [] };

  const allBranches = [];
  const entries = await readdir(branchesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(branchesDir, entry.name, "branch-meta.json");
    const meta = (await exists(metaPath))
      ? JSON.parse(await readFile(metaPath, "utf-8"))
      : { branchId: entry.name, parentBranch: null, status: "active", label: entry.name };

    allBranches.push({
      id: entry.name,
      parent: meta.parentBranch || null,
      status: meta.status || "active",
      label: meta.label || entry.name,
      description: meta.description || "",
      divergeEvent: meta.divergeEvent || null,
      createdAt: meta.createdAt || "",
      lastPlayedAt: meta.lastPlayedAt || "",
      playCount: meta.playCount || 0,
      tags: meta.tags || [],
      mergeTarget: meta.mergeTarget || null,
      abandonReason: meta.abandonReason || ""
    });
  }

  // 找主线
  const trunk = allBranches.find(b => b.id === "main") || allBranches[0];

  // 构建父子索引
  const byParent = {};
  for (const b of allBranches) {
    const p = b.parent || "main";
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(b);
  }

  // 构建树（非递归BFS）
  const rootId = trunk?.id || "main";
  const tree = [];
  const queue = [...(byParent[rootId] || [])];
  const seen = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    const children = (byParent[node.id] || []).filter(c => !seen.has(c.id));
    node.children = children.map(c => ({ ...c }));
    tree.push(node);

    // 将子节点加入队列
    for (const child of children) {
      if (!seen.has(child.id)) queue.push(child);
    }
  }

  return {
    trunk: rootId,
    branches: tree,
    allBranches,
    stats: {
      total: allBranches.length,
      active: allBranches.filter(b => b.status === "active").length,
      dead: allBranches.filter(b => b.status === "dead").length,
      merged: allBranches.filter(b => b.status === "merged").length
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  枯枝标记
// ═══════════════════════════════════════════════════════════════

/**
 * 标记分支为枯枝（废弃但保留数据）
 * @returns {Object}
 */
export async function abandonBranch(worldsRoot, worldName, branchId, reason = "") {
  if (branchId === "main") return { error: "不能废弃主线" };

  const metaPath = join(worldsRoot, worldName, "branches", branchId, "branch-meta.json");
  if (!(await exists(metaPath))) return { error: `分支「${branchId}」不存在` };

  const meta = JSON.parse(await readFile(metaPath, "utf-8"));
  if (meta.status === "dead") return { error: "该分支已是枯枝" };
  if (meta.status === "merged") return { error: "已合并的分支不能废弃——它已经是主线的一部分" };

  meta.status = "dead";
  meta.abandonReason = reason;
  meta.abandonedAt = new Date().toISOString();
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { ok: true, branchId, previousStatus: "active", meta };
}

/**
 * 复活枯枝
 */
export async function reviveBranch(worldsRoot, worldName, branchId) {
  const metaPath = join(worldsRoot, worldName, "branches", branchId, "branch-meta.json");
  if (!(await exists(metaPath))) return { error: `分支「${branchId}」不存在` };

  const meta = JSON.parse(await readFile(metaPath, "utf-8"));
  if (meta.status !== "dead") return { error: "只有枯枝可以复活" };

  meta.status = "active";
  meta.revivedAt = new Date().toISOString();
  // 清除废弃标记
  delete meta.abandonReason;
  delete meta.abandonedAt;
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { ok: true, branchId, meta };
}

// ═══════════════════════════════════════════════════════════════
//  分支对比
// ═══════════════════════════════════════════════════════════════

/**
 * 对比两个分支的差异
 * @returns {Object} { added, removed, modified, summary }
 */
export async function compareBranches(worldsRoot, worldName, branchA, branchB) {
  const aDir = join(worldsRoot, worldName, "branches", branchA);
  const bDir = join(worldsRoot, worldName, "branches", branchB);

  if (!(await exists(aDir))) return { error: `分支「${branchA}」不存在` };
  if (!(await exists(bDir))) return { error: `分支「${branchB}」不存在` };

  const result = { added: [], removed: [], modified: [], summary: "" };

  // 对比 canon_state
  const aCanon = await readJSON(join(aDir, "canon_state.json"));
  const bCanon = await readJSON(join(bDir, "canon_state.json"));
  if (aCanon && bCanon) {
    const aConfirmed = aCanon.confirmed || [];
    const bConfirmed = bCanon.confirmed || [];

    // 简化对比：比较 confirmed 条目
    for (const entry of bConfirmed) {
      if (!aConfirmed.some(e => JSON.stringify(e) === JSON.stringify(entry))) {
        result.added.push({ source: "canon_state", entry });
      }
    }
    for (const entry of aConfirmed) {
      if (!bConfirmed.some(e => JSON.stringify(e) === JSON.stringify(entry))) {
        result.removed.push({ source: "canon_state", entry });
      }
    }
  }

  // 对比 characters
  const aChars = await readJSON(join(aDir, "..", "..", "shared", "characters.json"));
  const bChars = await readJSON(join(bDir, "..", "..", "shared", "characters.json"));
  // 注意：shared 是跨分支共享的，所以这里主要比较 runtime 中的角色状态
  const aRuntime = await readJSON(join(aDir, "runtime.json"));
  const bRuntime = await readJSON(join(bDir, "runtime.json"));
  if (aRuntime?.characters && bRuntime?.characters) {
    const aNames = new Set(aRuntime.characters.map(c => c.name));
    const bNames = new Set(bRuntime.characters.map(c => c.name));
    for (const name of bNames) {
      if (!aNames.has(name)) result.added.push({ source: "characters", name });
    }
    for (const name of aNames) {
      if (!bNames.has(name)) result.removed.push({ source: "characters", name });
    }
  }

  // 对比 runtime 场景
  if (aRuntime?.scene?.title !== bRuntime?.scene?.title) {
    result.modified.push({
      source: "scene",
      a: aRuntime?.scene?.title,
      b: bRuntime?.scene?.title
    });
  }

  result.summary = [
    result.added.length ? `新增 ${result.added.length} 项` : "",
    result.removed.length ? `移除 ${result.removed.length} 项` : "",
    result.modified.length ? `修改 ${result.modified.length} 项` : ""
  ].filter(Boolean).join("，") || "无差异";

  return result;
}

// ═══════════════════════════════════════════════════════════════
//  嫁接合并
// ═══════════════════════════════════════════════════════════════

/**
 * 将源分支嫁接到目标分支
 * 不直接覆盖——生成 merge proposal 列表供用户逐项确认
 * @returns {Object} { ok, proposals: [], summary }
 */
export async function mergeBranch(worldsRoot, worldName, sourceBranch, targetBranch = "main") {
  if (sourceBranch === targetBranch) return { error: "不能将分支合并到自身" };

  const srcDir = join(worldsRoot, worldName, "branches", sourceBranch);
  const tgtDir = join(worldsRoot, worldName, "branches", targetBranch);

  if (!(await exists(srcDir))) return { error: `源分支「${sourceBranch}」不存在` };
  if (!(await exists(tgtDir))) return { error: `目标分支「${targetBranch}」不存在` };

  // 对比差异
  const diff = await compareBranches(worldsRoot, worldName, targetBranch, sourceBranch);
  if (diff.error) return diff;

  // 生成嫁接提案列表
  const proposals = [];

  for (const add of diff.added) {
    proposals.push({
      type: "add",
      source: add.source,
      data: add.entry || { name: add.name },
      targetBranch,
      description: `从「${sourceBranch}」新增: ${add.entry ? JSON.stringify(add.entry).slice(0, 80) : add.name}`
    });
  }
  for (const remove of diff.removed) {
    proposals.push({
      type: "remove",
      source: remove.source,
      data: remove.entry || { name: remove.name },
      targetBranch,
      description: `在「${targetBranch}」中移除: ${remove.entry ? JSON.stringify(remove.entry).slice(0, 80) : remove.name}`
    });
  }
  for (const mod of diff.modified) {
    proposals.push({
      type: "modify",
      source: mod.source,
      oldValue: mod.a,
      newValue: mod.b,
      targetBranch,
      description: `修改: ${mod.source}「${mod.a}」→「${mod.b}」`
    });
  }

  return {
    ok: true,
    sourceBranch,
    targetBranch,
    proposals,
    proposalCount: proposals.length,
    diff
  };
}

/**
 * 执行嫁接：将确认后的 proposal 列表应用到目标分支
 * @param {Object[]} confirmedProposals — 用户确认要执行的提案
 * @returns {Object}
 */
export async function executeMerge(worldsRoot, worldName, sourceBranch, targetBranch, confirmedProposals = []) {
  const tgtDir = join(worldsRoot, worldName, "branches", targetBranch);
  if (!(await exists(tgtDir))) return { error: `目标分支不存在` };

  const applied = [];
  const skipped = [];

  for (const proposal of confirmedProposals) {
    if (proposal.type === "add" && proposal.source === "canon_state") {
      const canonPath = join(tgtDir, "canon_state.json");
      const canon = (await readJSON(canonPath)) || { confirmed: [], implied: [], proposed: [] };
      canon.confirmed = [...(canon.confirmed || []), proposal.data];
      await writeFile(canonPath, JSON.stringify(canon, null, 2));
      applied.push(proposal);
    } else if (proposal.type === "remove" && proposal.source === "canon_state") {
      const canonPath = join(tgtDir, "canon_state.json");
      const canon = (await readJSON(canonPath)) || { confirmed: [], implied: [], proposed: [] };
      canon.confirmed = (canon.confirmed || []).filter(
        e => JSON.stringify(e) !== JSON.stringify(proposal.data)
      );
      await writeFile(canonPath, JSON.stringify(canon, null, 2));
      applied.push(proposal);
    } else {
      skipped.push({ ...proposal, reason: "不支持的提案类型或来源" });
    }
  }

  // 标记源分支为 merged
  const srcMetaPath = join(worldsRoot, worldName, "branches", sourceBranch, "branch-meta.json");
  if (await exists(srcMetaPath)) {
    const meta = JSON.parse(await readFile(srcMetaPath, "utf-8"));
    meta.status = "merged";
    meta.mergeTarget = targetBranch;
    meta.mergedAt = new Date().toISOString();
    await writeFile(srcMetaPath, JSON.stringify(meta, null, 2));
  }

  return {
    ok: true,
    applied: applied.length,
    skipped: skipped.length,
    sourceBranch,
    targetBranch
  };
}

// ═══════════════════════════════════════════════════════════════
//  获取可玩分支
// ═══════════════════════════════════════════════════════════════

export async function getActiveBranches(worldsRoot, worldName) {
  const tree = await getBranchTree(worldsRoot, worldName);
  return tree.allBranches.filter(b => b.status === "active");
}

export async function getDeadBranches(worldsRoot, worldName) {
  const tree = await getBranchTree(worldsRoot, worldName);
  return tree.allBranches.filter(b => b.status === "dead");
}
