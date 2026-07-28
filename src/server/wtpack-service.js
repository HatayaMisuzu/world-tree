import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateImportFileKey } from "./data-import-service.js";

export const WTPACK_FORMAT = "world-tree.wtpack";
export const WTPACK_SPEC_VERSION = 1;

const REQUIRED_MANIFEST_FIELDS = ["kind", "id", "title", "author", "license", "minEngine", "contentRating", "checksums"];
const CURRENT_APP_VERSION = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;
const SHA256_RE = /^[a-f0-9]{64}$/i;
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

export function validateWtpack(pack = {}, { appVersion = CURRENT_APP_VERSION } = {}) {
  if (!pack || typeof pack !== "object") return fail("WTPACK_INVALID", "wtpack must be an object");
  if (pack.format !== WTPACK_FORMAT) return fail("WTPACK_FORMAT_INVALID", "wtpack format must be world-tree.wtpack");
  const manifest = pack.manifest || {};
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] == null || manifest[field] === "") return fail("WTPACK_MANIFEST_INVALID", `manifest missing ${field}`);
  }
  if (Number(manifest.specVersion) !== WTPACK_SPEC_VERSION) return fail("WTPACK_SPEC_VERSION_UNSUPPORTED", "wtpack specVersion must be 1");
  if (!pack.files || typeof pack.files !== "object" || Array.isArray(pack.files)) return fail("WTPACK_FILES_INVALID", "wtpack files must be an object");
  if (!isPlainObject(manifest.checksums)) return fail("WTPACK_CHECKSUMS_INVALID", "manifest checksums must be a plain object");
  const cleanFiles = {};
  const cleanChecksums = {};
  try {
    for (const [key, value] of Object.entries(pack.files)) {
      const clean = validateWtpackFileKey(key);
      if (Object.hasOwn(cleanFiles, clean)) throw collisionError(key, clean);
      cleanFiles[clean] = value;
    }
    for (const [key, hash] of Object.entries(manifest.checksums)) {
      const clean = validateWtpackFileKey(key);
      if (Object.hasOwn(cleanChecksums, clean)) throw collisionError(key, clean);
      cleanChecksums[clean] = hash;
    }
  } catch (err) {
    return fail("WTPACK_FILE_PATH_UNSAFE", err.message);
  }
  const fileKeys = Object.keys(cleanFiles).sort();
  const checksumKeys = Object.keys(cleanChecksums).sort();
  if (fileKeys.length !== checksumKeys.length || fileKeys.some((key, index) => key !== checksumKeys[index])) {
    return fail("WTPACK_CHECKSUM_SET_MISMATCH", "wtpack files and checksum keys must match exactly");
  }
  for (const [key, hash] of Object.entries(cleanChecksums)) {
    if (typeof hash !== "string" || !SHA256_RE.test(hash)) {
      return fail("WTPACK_CHECKSUM_INVALID", `invalid SHA-256 checksum for ${key}`);
    }
  }
  const versionCheck = compareEngineVersions(appVersion, manifest.minEngine);
  if (!versionCheck.ok) return versionCheck;
  const expected = cleanChecksums;
  const actual = checksumFiles(cleanFiles);
  for (const [key, hash] of Object.entries(expected)) {
    if (!actual[key] || actual[key] !== hash) return fail("WTPACK_CHECKSUM_MISMATCH", `checksum mismatch for ${key}`);
  }
  return { ok: true, manifest, files: cleanFiles, checksums: actual };
}

export function compareEngineVersions(currentVersion, minimumVersion) {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumVersion);
  if (!current || !minimum) return fail("WTPACK_ENGINE_VERSION_INVALID", "current app version and minEngine must be valid semantic versions");
  if (compareParsedVersions(current, minimum) < 0) {
    return fail("WTPACK_ENGINE_TOO_OLD", `wtpack requires engine ${minimumVersion}, current engine is ${currentVersion}`);
  }
  return { ok: true };
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

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function collisionError(key, clean) {
  const error = new Error(`wtpack key collision after normalization: ${key} -> ${clean}`);
  error.code = "WTPACK_FILE_KEY_COLLISION";
  return error;
}

function parseVersion(value) {
  const match = String(value || "").trim().match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  if (!match) return null;
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] ? match[4].split(".") : []
  };
}

function compareParsedVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a == null) return -1;
    if (b == null) return 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) < Number(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

function fail(code, errorMsg) {
  return { ok: false, code, errorMsg };
}
