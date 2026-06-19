import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { appendFile, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function readJsonSync(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
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
