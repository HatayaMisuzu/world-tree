import { createHash } from "node:crypto";
import { validateImportFileKey } from "./data-import-service.js";

export const WTPACK_FORMAT = "world-tree.wtpack";
export const WTPACK_SPEC_VERSION = 1;

const REQUIRED_MANIFEST_FIELDS = ["kind", "id", "title", "author", "license", "minEngine", "contentRating", "checksums"];
const STRIPPED_EXPORT_PATTERNS = [
  /^runtime\/(?:chat|memory|usage).*\.jsonl$/i,
  /^runtime\/(?:debug|session|logs?)\//i,
  /^userData\//i,
  /(?:secret|private|credential|token)/i
];

export function createWtpack({ manifest = {}, files = {}, appVersion = "" } = {}) {
  const safeFiles = {};
  for (const [key, value] of Object.entries(files || {})) {
    const clean = validateWtpackExportFileKey(key);
    if (shouldStripWtpackExportFile(clean)) continue;
    safeFiles[clean] = cloneJson(value);
  }
  const checksums = checksumFiles(safeFiles);
  const nextManifest = normalizeManifest({
    ...manifest,
    specVersion: WTPACK_SPEC_VERSION,
    minEngine: manifest.minEngine || appVersion || "0.0.0",
    checksums
  });
  return {
    format: WTPACK_FORMAT,
    manifest: nextManifest,
    files: safeFiles
  };
}

export function validateWtpack(pack = {}) {
  if (!pack || typeof pack !== "object") return fail("WTPACK_INVALID", "wtpack must be an object");
  if (pack.format !== WTPACK_FORMAT) return fail("WTPACK_FORMAT_INVALID", "wtpack format must be world-tree.wtpack");
  const manifest = pack.manifest || {};
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] == null || manifest[field] === "") return fail("WTPACK_MANIFEST_INVALID", `manifest missing ${field}`);
  }
  if (Number(manifest.specVersion) !== WTPACK_SPEC_VERSION) return fail("WTPACK_SPEC_VERSION_UNSUPPORTED", "wtpack specVersion must be 1");
  if (!pack.files || typeof pack.files !== "object" || Array.isArray(pack.files)) return fail("WTPACK_FILES_INVALID", "wtpack files must be an object");
  const cleanFiles = {};
  try {
    for (const [key, value] of Object.entries(pack.files)) {
      cleanFiles[validateWtpackFileKey(key)] = value;
    }
  } catch (err) {
    return fail("WTPACK_FILE_PATH_UNSAFE", err.message);
  }
  const expected = manifest.checksums || {};
  const actual = checksumFiles(cleanFiles);
  for (const [key, hash] of Object.entries(expected)) {
    if (!actual[key] || actual[key] !== hash) return fail("WTPACK_CHECKSUM_MISMATCH", `checksum mismatch for ${key}`);
  }
  return { ok: true, manifest, files: cleanFiles, checksums: actual };
}

export function shouldStripWtpackExportFile(fileKey = "") {
  const clean = String(fileKey || "").replace(/\\/g, "/");
  return STRIPPED_EXPORT_PATTERNS.some((pattern) => pattern.test(clean));
}

export function checksumFiles(files = {}) {
  return Object.fromEntries(Object.entries(files).map(([key, value]) => [key, sha256Json(value)]));
}

export function validateWtpackFileKey(key = "") {
  const clean = validateImportFileKey(key);
  if (!(clean === "world.json" || clean.startsWith("shared/") || clean.startsWith("runtime/") || clean.startsWith("assets/"))) {
    const err = new Error(`unsupported wtpack file root: ${key}`);
    err.code = "WTPACK_FILE_ROOT_UNSUPPORTED";
    throw err;
  }
  if (shouldStripWtpackExportFile(clean)) {
    const err = new Error(`wtpack file is private/runtime-only: ${key}`);
    err.code = "WTPACK_FILE_PRIVATE";
    throw err;
  }
  return clean;
}

function validateWtpackExportFileKey(key = "") {
  const clean = validateImportFileKey(key);
  if (!(clean === "world.json" || clean.startsWith("shared/") || clean.startsWith("runtime/") || clean.startsWith("assets/") || clean.startsWith("userData/"))) {
    const err = new Error(`unsupported wtpack file root: ${key}`);
    err.code = "WTPACK_FILE_ROOT_UNSUPPORTED";
    throw err;
  }
  return clean;
}

function normalizeManifest(manifest = {}) {
  return {
    specVersion: Number(manifest.specVersion || WTPACK_SPEC_VERSION),
    kind: String(manifest.kind || "world"),
    id: String(manifest.id || "untitled"),
    title: String(manifest.title || manifest.id || "Untitled"),
    author: String(manifest.author || "Unknown"),
    license: String(manifest.license || "UNSPECIFIED"),
    minEngine: String(manifest.minEngine || "0.0.0"),
    contentRating: String(manifest.contentRating || "unrated"),
    checksums: manifest.checksums || {}
  };
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function fail(code, errorMsg) {
  return { ok: false, code, errorMsg };
}
