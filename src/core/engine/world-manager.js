// ===== 世界管理器 =====
// 每个世界是一个自包含的文件夹，包含全部数据和运行时状态。
// 类似 Minecraft 的世界系统——世界 = 存档，不存在存档点。
//
// 目录结构：
//   data/engine/worlds/<世界名>/
//     world.json        ← 元数据
//     runtime.json      ← 实时运行时状态
//     cache.json        ← 事件预测缓存 + 随机事件历史
//     shared/           ← 世界书/角色/规则（初始创建后基本不变）
//     branches/         ← 叙事分支
//     memory/           ← 记忆快照

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from "fs";
import { join, dirname, basename, resolve } from "path";

// 🆕 v0.7.4.1 数据归家
export const WORLDS_ROOT = "data/engine/worlds";
// 🆕 v0.7.4.1 项目内路径，由 resolve() 解析为 <PROJECT_ROOT>/defaults/world-profiles
export const WORLD_PROFILES_ROOT = "defaults/world-profiles";

// ═══════════════════════════════════════════════════════════════
//  世界书子类型配置（经典/跑团/RPG/模拟经营）
//  不修改引擎核心，仅提供预设配置模板。
// ═══════════════════════════════════════════════════════════════

const PROFILE_CACHE = new Map();

/**
 * 加载世界书子类型配置
 * @param {string} subType - classic | tabletop | rpg | sim
 * @returns {Object|null} 配置对象
 */
export function loadWorldProfile(subType = "classic") {
  if (PROFILE_CACHE.has(subType)) return PROFILE_CACHE.get(subType);

  const profilePath = resolve(WORLD_PROFILES_ROOT, `${subType}.json`);
  if (!existsSync(profilePath)) {
    // 回退到经典
    const fallback = loadWorldProfile("classic");
    PROFILE_CACHE.set(subType, fallback);
    return fallback;
  }

  try {
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    PROFILE_CACHE.set(subType, profile);
    return profile;
  } catch {
    const fallback = loadWorldProfile("classic");
    PROFILE_CACHE.set(subType, fallback);
    return fallback;
  }
}

/**
 * 列出所有可用的子类型（默认隐藏 status=hidden 的未完成模式）
 * 
 * ⚠️ 重要：tabletop/rpg/sim 三种模式尚未完成，status=hidden。
 *    只有用户明确要求完成某个模式后，才可将对应 profile 的 status 改为 "active"。
 *    AI 代理不得擅自暴露这些模式到 UI。
 * 
 * @param {boolean} [includeHidden=false] - 是否包含隐藏模式（引擎内部使用）
 * @returns {Array} 子类型列表
 */
export function listWorldProfiles(includeHidden = false) {
  const dir = resolve(WORLD_PROFILES_ROOT);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const profiles = [];
  for (const file of files) {
    try {
      const profile = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const status = profile.status || "active";
      if (!includeHidden && status === "hidden") continue; // 🆕 过滤隐藏模式
      profiles.push({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        status,
        basedOn: profile.basedOn || "worldbook"
      });
    } catch {}
  }
  return profiles;
}

// ═══════════════════════════════════════════════════════════════
//  世界元数据
// ═══════════════════════════════════════════════════════════════

export function worldPath(name) {
  return `${WORLDS_ROOT}/${encodeURIComponent(name)}`;
}

export function worldMetaPath(name) {
  return `${worldPath(name)}/world.json`;
}

export function worldRuntimePath(name) {
  return `${worldPath(name)}/runtime.json`;
}

export function worldCachePath(name) {
  return `${worldPath(name)}/cache.json`;
}

export function worldMemoryPath(name) {
  return `${worldPath(name)}/memory/snapshots.json`;
}

/**
 * 创建新世界
 * @param {string} name - 世界名称
 * @param {string} mode - worldbook | character_card | preset
 * @param {Object} [extra] - 额外元数据
 * @returns {Object} 世界元数据
 */
export function createWorld(name, mode = "worldbook", extra = {}) {
  const subType = extra.subType || "classic";
  const profile = loadWorldProfile(subType);

  const meta = {
    name,
    mode,
    subType,         // 🆕 子类型
    profileVersion: profile?.id || "classic",
    displayName: extra.displayName || name,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    playCount: 0,
    turnCount: 0,
    description: extra.description || (profile?.description || ""),
    tags: extra.tags || (profile?.tags || []),
    defaultModules: profile?.defaultModules || [],
    version: 1
  };

  // 初始化运行时
  const runtime = {
    emotion: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 },
    lastEventRound: 0,
    currentScene: "",
    currentBranch: "main",
    turnCount: 0
  };

  // 初始化缓存
  const cache = {
    predictionCache: { events: [], maxSize: 5 },
    eventHistory: []
  };

  return { meta, runtime, cache };
}

/**
 * 保存世界元数据到文件
 * @param {Object} fs - 文件系统接口（Electron 或 Node fs）
 * @param {Object} worldMeta
 */
export function saveWorldMeta(fs, worldMeta) {
  const dir = worldPath(worldMeta.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(worldMetaPath(worldMeta.name), JSON.stringify(worldMeta, null, 2));
}

/**
 * 读取世界元数据
 */
export function loadWorldMeta(fs, name) {
  const path = worldMetaPath(name);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

// ═══════════════════════════════════════════════════════════════
//  运行时状态（每轮自动保存）
// ═══════════════════════════════════════════════════════════════

/**
 * 保存运行时状态（每轮 completeTurn 后调用）
 */
export function saveWorldRuntime(fs, worldName, runtime) {
  const dir = worldPath(worldName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(worldRuntimePath(worldName), JSON.stringify({
    ...runtime,
    savedAt: new Date().toISOString()
  }, null, 2));
}

/**
 * 读取运行时状态
 */
export function loadWorldRuntime(fs, worldName) {
  const path = worldRuntimePath(worldName);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

// ═══════════════════════════════════════════════════════════════
//  缓存状态（每轮自动保存 + 读世界时恢复）
// ═══════════════════════════════════════════════════════════════

/**
 * 保存缓存状态（完整的事件预测缓存 + 随机事件历史）
 */
export function saveWorldCache(fs, worldName, cacheData) {
  const dir = worldPath(worldName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(worldCachePath(worldName), JSON.stringify({
    ...cacheData,
    savedAt: new Date().toISOString()
  }, null, 2));
}

/**
 * 读取缓存状态
 */
export function loadWorldCache(fs, worldName) {
  const path = worldCachePath(worldName);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

// ═══════════════════════════════════════════════════════════════
//  世界列表
// ═══════════════════════════════════════════════════════════════

/**
 * 列出所有世界
 */
export function listWorlds(fs) {
  if (!fs.existsSync(WORLDS_ROOT)) return [];
  const entries = fs.readdirSync(WORLDS_ROOT, { withFileTypes: true });
  const worlds = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(WORLDS_ROOT, entry.name, "world.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      worlds.push({
        dir: entry.name,
        ...meta
      });
    } catch {}
  }
  return worlds.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0));
}

// ═══════════════════════════════════════════════════════════════
//  导入/导出
// ═══════════════════════════════════════════════════════════════

/**
 * 从旧存档导入为世界（迁移工具）
 */
export function importArchiveAsWorld(fs, archiveData, worldName) {
  const runtime = archiveData._runtime || {};
  const meta = {
    name: worldName,
    mode: archiveData.mode || "worldbook",
    displayName: worldName,
    createdAt: archiveData.createdAt || new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    playCount: 0,
    turnCount: runtime.lastEventRound || 0,
    description: `从存档导入: ${archiveData.name || "未命名"}`,
    tags: ["imported"],
    version: 1
  };
  return { meta, runtime, cache: runtime.predictionCache ? { predictionCache: runtime.predictionCache, eventHistory: runtime.eventHistory || [] } : null };
}

// ═══════════════════════════════════════════════════════════════
//  世界复制（分支机制）
//  复制 = 整个文件夹的完整克隆。两个世界完全独立，互不影响。
//  这是实现"Galgame 式存档分支"的方式——在任意节点复制世界，
//  副本世界走向不同的选择。
// ═══════════════════════════════════════════════════════════════

/**
 * 复制整个世界到新名称
 * @param {Object} fs
 * @param {string} sourceWorld - 源世界名
 * @param {string} newWorld - 新世界名
 * @param {Object} [options]
 * @param {string} [options.label] - 用户标注（如"表白前分歧"）
 * @returns {{ ok: boolean, error?: string, meta?: Object }}
 */
export function copyWorld(fs, sourceWorld, newWorld, options = {}) {
  const srcDir = worldPath(sourceWorld);
  const dstDir = worldPath(newWorld);

  if (!fs.existsSync(srcDir)) {
    return { ok: false, error: `源世界 "${sourceWorld}" 不存在` };
  }
  if (fs.existsSync(dstDir)) {
    return { ok: false, error: `目标世界 "${newWorld}" 已存在` };
  }

  // 递归复制整个文件夹
  cpSync(srcDir, dstDir, { recursive: true });

  // 更新副本的元数据
  const metaPath = join(dstDir, "world.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      meta.name = newWorld;
      meta.displayName = options.label || `${sourceWorld} — ${new Date().toLocaleString()}`;
      meta.sourceWorld = sourceWorld;
      meta.createdAt = new Date().toISOString();
      meta.lastPlayedAt = new Date().toISOString();
      meta.playCount = 0;
      meta.copyOf = sourceWorld;
      meta.copyLabel = options.label || "";
      meta.branchGeneration = (meta.branchGeneration || 0) + 1;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      return { ok: true, meta };
    } catch (e) {
      return { ok: false, error: `元数据更新失败: ${e.message}` };
    }
  }

  return { ok: true };
}

/**
 * 获取世界的分支树（所有源自同一源世界的副本链）
 */
export function getWorldBranchTree(fs, worldName) {
  const all = listWorlds(fs);
  const tree = [];

  // 找到所有相关的世界（源或副本）
  const related = all.filter((w) => {
    const chain = [w.name, w.copyOf, w.sourceWorld].filter(Boolean);
    return chain.includes(worldName) || chain.some((c) => c && c.startsWith(worldName));
  });

  // 按创建时间排序
  return related.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}
