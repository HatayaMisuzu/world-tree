import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const IMPORT_FILE_RE = /\.(json|jsonl)$/i;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

/**
 * Validate and normalize an import bundle key.
 *
 * Security rule:
 * - Reject unsafe input.
 * - Do not silently sanitize traversal away.
 * - Return the canonical slash-separated relative path only after validation.
 */
export function validateImportFileKey(key = "") {
  const raw = String(key ?? "").trim().replace(/\\/g, "/");

  if (!raw) {
    const err = new Error("import file path is empty");
    err.code = "IMPORT_FILE_KEY_INVALID";
    err.file = key;
    throw err;
  }

  if (raw.startsWith("/") || isAbsolute(raw) || WINDOWS_ABSOLUTE_RE.test(raw)) {
    const err = new Error(`absolute import file path is not allowed: ${key}`);
    err.code = "IMPORT_FILE_KEY_INVALID";
    err.file = key;
    throw err;
  }

  const parts = raw.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    const err = new Error(`unsafe import file path segment: ${key}`);
    err.code = "IMPORT_FILE_KEY_INVALID";
    err.file = key;
    throw err;
  }

  if (!IMPORT_FILE_RE.test(raw)) {
    const err = new Error(`unsupported import file extension: ${key}`);
    err.code = "IMPORT_FILE_KEY_INVALID";
    err.file = key;
    throw err;
  }

  return raw;
}

/**
 * Backward compatible export for old imports.
 * Important: this no longer sanitizes. It validates and either returns a safe key or throws.
 */
export function sanitizeImportFileKey(key = "") {
  return validateImportFileKey(key);
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
      const e = new Error(`${fileKey}: invalid JSON (${err?.message || String(err)})`);
      e.code = "IMPORT_JSON_INVALID";
      e.file = fileKey;
      throw e;
    }
    return true;
  }

  if (/\.jsonl$/i.test(fileKey)) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        JSON.parse(line);
      } catch (err) {
        const e = new Error(`${fileKey}:${i + 1}: invalid JSONL line (${err?.message || String(err)})`);
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

/**
 * Validate all files before returning write targets.
 *
 * Atomicity rule:
 * This function must complete successfully for every file before the caller creates
 * directories or writes any target file.
 */
export function prepareImportFiles(rootDir, files = {}) {
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    const err = new Error("files must be an object");
    err.code = "IMPORT_PAYLOAD_INVALID";
    throw err;
  }

  const prepared = [];

  for (const [key, content] of Object.entries(files)) {
    const clean = validateImportFileKey(key);
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
