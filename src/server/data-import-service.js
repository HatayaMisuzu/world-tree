import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export function sanitizeImportFileKey(key = "") {
  return String(key || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

export function pathWithinRoot(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function validateImportContent(fileKey, content) {
  const text = String(content ?? "");
  if (/\.json$/i.test(fileKey)) {
    try {
      JSON.parse(text);
    } catch (err) {
      const e = new Error(`${fileKey}: invalid JSON (${err.message})`);
      e.code = "IMPORT_JSON_INVALID";
      e.file = fileKey;
      throw e;
    }
    return true;
  }

  if (/\.jsonl$/i.test(fileKey)) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        JSON.parse(line);
      } catch (err) {
        const e = new Error(`${fileKey}:${i + 1}: invalid JSONL line (${err.message})`);
        e.code = "IMPORT_JSONL_INVALID";
        e.file = fileKey;
        e.line = i + 1;
        throw e;
      }
    }
    return true;
  }

  const e = new Error(`${fileKey}: unsupported file extension`);
  e.code = "IMPORT_FILE_KEY_INVALID";
  e.file = fileKey;
  throw e;
}

export function prepareImportFiles(rootDir, files = {}) {
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    const err = new Error("files must be an object");
    err.code = "IMPORT_PAYLOAD_INVALID";
    throw err;
  }

  const prepared = [];
  for (const [key, content] of Object.entries(files)) {
    const clean = sanitizeImportFileKey(key);
    if (!clean || !/\.(json|jsonl)$/i.test(clean)) {
      const err = new Error(`invalid import file path: ${key}`);
      err.code = "IMPORT_FILE_KEY_INVALID";
      err.file = key;
      throw err;
    }
    const targetPath = join(rootDir, clean);
    if (!pathWithinRoot(rootDir, targetPath)) {
      const err = new Error(`import file path escapes target root: ${key}`);
      err.code = "IMPORT_FILE_KEY_INVALID";
      err.file = key;
      throw err;
    }
    validateImportContent(clean, content);
    prepared.push({
      key,
      clean,
      content: String(content ?? ""),
      targetPath,
      targetDir: dirname(targetPath)
    });
  }
  return prepared;
}
