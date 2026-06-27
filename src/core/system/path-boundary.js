// src/core/system/path-boundary.js
// Shared lexical path-boundary checks.
// This file intentionally lives in core/system so server and core/engine can
// both depend on it without core importing from server.

import { resolve, relative, isAbsolute } from "node:path";

/**
 * Returns true if targetPath lexically resolves inside rootPath.
 *
 * This uses path.resolve + path.relative for lexical path-boundary checks.
 * It does NOT resolve symlinks. Callers that need symlink-aware checks must
 * use fs.realpath / fs.realpathSync.native before calling this helper.
 */
export function pathWithinRoot(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  const root = resolve(String(rootPath).replaceAll("\\", "/"));
  const target = resolve(String(targetPath).replaceAll("\\", "/"));
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function isPathWithinRootStrict(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  return pathWithinRoot(rootPath, targetPath);
}
