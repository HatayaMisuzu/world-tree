import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { appendFile, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const fileQueues = new Map();

function lockKey(filePath) {
  const absolute = resolve(filePath);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

/** Serialize a complete operation that reads and/or writes one JSON path. */
export async function withFileLock(filePath, operation) {
  const key = lockKey(filePath);
  const previous = fileQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  fileQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (fileQueues.get(key) === current) fileQueues.delete(key);
  }
}

async function syncDirectory(dirPath) {
  let handle;
  try {
    handle = await open(dirPath, "r");
    await handle.sync();
  } catch (error) {
    // Directory fsync is unavailable on some Windows/filesystem combinations.
    if (!(["EINVAL", "EPERM", "EISDIR", "ENOTSUP"].includes(error?.code))) throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function writeJsonDurable(filePath, data) {
  ensureDir(dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(tmpPath, "wx", 0o600);
    await handle.writeFile(JSON.stringify(data, null, 2), "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tmpPath, filePath);
    await syncDirectory(dirname(filePath));
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(tmpPath, { force: true }).catch(() => {});
    throw error;
  }
}

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
  return withFileLock(filePath, () => writeJsonDurable(filePath, data));
}

/** Atomically serialize the full read-modify-write cycle for one JSON file. */
export async function updateJson(filePath, fallback, updater) {
  return withFileLock(filePath, async () => {
    const current = readJsonSync(filePath, fallback);
    const next = await updater(current);
    await writeJsonDurable(filePath, next);
    return next;
  });
}

// writeJsonAtomic 为别名，保留向后兼容
export { writeJson as writeJsonAtomic };

/**
 * 兼容读取：优先主路径 → 回退旧路径 → fallback。
 * 解决 readJsonSync(primary,{}) || readJsonSync(legacy,{}) 中 {} truthy 阻断 fallback 的问题。
 */
export function readJsonWithLegacy(primaryPath, legacyPath, fallback = {}) {
  if (existsSync(primaryPath)) return readJsonSync(primaryPath, fallback);
  if (existsSync(legacyPath)) return readJsonSync(legacyPath, fallback);
  return fallback;
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
        try { size += (await stat(p)).size; } catch (err) { console.warn("[fs-utils] skipped unreadable size entry (non-fatal):", err?.message || "unknown error"); }
      }
    }
    return size;
  }

  if (!existsSync(rootDir)) return { sizeBytes: 0, entries: 0, truncated: false };
  const sizeBytes = await walk(rootDir);
  return { sizeBytes, entries, truncated };
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
