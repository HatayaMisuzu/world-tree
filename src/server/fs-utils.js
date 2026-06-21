import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { appendFile, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    if (existsSync(filePath)) {
      logCorruptFile(filePath, err);
    }
    return fallback;
  }
}

export function readJsonSync(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    if (existsSync(filePath)) {
      logCorruptFile(filePath, err);
    }
    return fallback;
  }
}

export async function writeJson(filePath, data) {
  ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function appendJsonl(filePath, record) {
  ensureDir(dirname(filePath));
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf-8");
}

export async function readJsonlTail(filePath, limit = 80) {
  if (!existsSync(filePath)) return [];
  try {
    const fileStat = statSync(filePath);
    if (fileStat.size < 10 * 1024 * 1024) {
      const text = await readFile(filePath, "utf-8");
      const lines = text.trim().split("\n").filter(Boolean);
      return lines.slice(-limit).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }

    const chunkSize = 64 * 1024;
    const chunks = [];
    let offset = fileStat.size;
    let lines = [];
    const fd = await (await import("node:fs/promises")).open(filePath, "r");
    try {
      while (offset > 0 && lines.length < limit + 5) {
        const readSize = Math.min(chunkSize, offset);
        offset -= readSize;
        const buf = Buffer.alloc(readSize);
        await fd.read(buf, 0, readSize, offset);
        chunks.unshift(buf);
        lines = Buffer.concat(chunks).toString("utf-8").split("\n").filter(Boolean);
      }
    } finally {
      await fd.close();
    }
    if (offset > 0 && lines.length) lines.shift();
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    console.warn("[readJsonlTail] read failed:", filePath, err.message);
    return [];
  }
}

export async function calcDirectorySizeLimited(rootDir, { maxEntries = 5000, maxMs = 250 } = {}) {
  const deadline = Date.now() + maxMs;
  let entries = 0;
  let truncated = false;

  async function walk(dir) {
    if (Date.now() > deadline || entries >= maxEntries) {
      truncated = true;
      return 0;
    }
    let size = 0;
    let list = [];
    try {
      list = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of list) {
      if (Date.now() > deadline || entries >= maxEntries) {
        truncated = true;
        break;
      }
      entries += 1;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        size += await walk(p);
      } else {
        try { size += (await stat(p)).size; } catch {}
      }
    }
    return size;
  }

  if (!existsSync(rootDir)) return { sizeBytes: 0, entries: 0, truncated: false };
  const sizeBytes = await walk(rootDir);
  return { sizeBytes, entries, truncated };
}

// ═══════════════════════════════════════════════════════════════
//  原子写 — 防止进程崩溃造成半截 JSON
// ═══════════════════════════════════════════════════════════════

/**
 * 原子写入 JSON：先写 .tmp，flush 后再 rename 覆盖目标文件。
 * 可防止进程崩溃或断电导致目标文件变成半截 JSON。
 */
export async function writeJsonAtomic(filePath, data) {
  ensureDir(dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await writeFile(tmpPath, json, "utf8");
  // 同步 rename 确保原子性
  renameSync(tmpPath, filePath);
}

/**
 * 同步版本（用于同步上下文中调用）
 */
export function writeJsonAtomicSync(filePath, data) {
  ensureDir(dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmpPath, filePath);
}

// ═══════════════════════════════════════════════════════════════
//  损坏文件日志 — 读取 JSON 失败时记录 warning
// ═══════════════════════════════════════════════════════════════

function logCorruptFile(filePath, err) {
  try {
    // 使用同步 append 以避免事件循环问题；损坏日志本身失败就静默忽略
    const userData = dirname(filePath);
    // 尝试定位到项目根下的 userData/
    let logDir = userData;
    // 在项目根目录下查找 userData
    let cursor = userData;
    for (let i = 0; i < 5; i++) {
      const candidate = join(cursor, "userData");
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        logDir = candidate;
        break;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    const logPath = join(logDir, "corrupt-files.jsonl");
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      filePath,
      error: String(err?.message || "unknown parse error").slice(0, 500)
    }) + "\n";
    writeFileSync(logPath, entry, { flag: "a", encoding: "utf8" });
  } catch {
    // 日志写入失败，静默忽略，避免因为 logging 本身崩溃
  }
}
