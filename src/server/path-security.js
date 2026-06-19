import { isAbsolute, relative, resolve } from "node:path";

const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;
const WINDOWS_DRIVE_SEGMENT_RE = /^[a-zA-Z]:/;
const WINDOWS_UNC_RE = /^(?:\\\\|\/\/)/;
const MAX_PATH_CHARS = 4096;
const MAX_SEGMENT_CHARS = 255;

export function decodeMaybeEncodedPath(value = "") {
  let text = String(value ?? "");
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch {
      break;
    }
  }
  return text;
}

export function isUnsafePathSegment(segment) {
  const text = String(segment ?? "");
  return (
    text === "" ||
    text === "." ||
    text === ".." ||
    text.includes("\0") ||
    text.includes(":") ||
    text.length > MAX_SEGMENT_CHARS ||
    WINDOWS_DRIVE_SEGMENT_RE.test(text)
  );
}

function pathError(message, label, value) {
  const err = new Error(message);
  err.code = "PATH_UNSAFE";
  err.label = label;
  err.path = value;
  return err;
}

export function pathWithinRoot(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveInsideRoot(rootPath, userPath) {
  const decoded = decodeMaybeEncodedPath(userPath).trim();
  if (!rootPath || !decoded || decoded.length > MAX_PATH_CHARS || decoded.includes("\0")) {
    return null;
  }

  if (WINDOWS_UNC_RE.test(decoded) || WINDOWS_DRIVE_RE.test(decoded) || isAbsolute(decoded)) {
    return null;
  }

  const normalized = decoded.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (parts.some(isUnsafePathSegment)) return null;

  const target = resolve(rootPath, ...parts);
  return pathWithinRoot(rootPath, target) ? target : null;
}

export function assertPathInsideRoot(rootPath, userPath, label = "path") {
  const target = resolveInsideRoot(rootPath, userPath);
  if (!target) {
    throw pathError(`${label} is unsafe or outside root`, label, userPath);
  }
  return target;
}
