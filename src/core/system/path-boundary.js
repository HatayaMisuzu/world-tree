// src/core/system/path-boundary.js
// P1-3 v2.1: Shared path-boundary checks.
// Lives in core/system/ so both server/ and core/engine/ can depend on it
// without architectural inversion (core must never import from server).

import { resolve, relative, isAbsolute } from "node:path";

/**
 * Returns true if `targetPath` lexically resolves inside `rootPath`.
 *
 * This uses path.resolve + path.relative for lexical path-boundary checks.
 * It does NOT resolve symlinks. Callers that need symlink-aware checks must
 * use fs.realpath / fs.realpathSync.native before calling this helper.
 *
 * @param {string} rootPath
 * @param {string} targetPath
 * @returns {boolean}
 */
export function pathWithinRoot(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  const root = resolve(rootPath);
  const target = resolve(targetPath);
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Defensive wrapper for call sites that prefer false over edge-case exceptions.
 * @param {string} rootPath
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isPathWithinRootStrict(rootPath, targetPath) {
  if (!rootPath || !targetPath) return false;
  return pathWithinRoot(rootPath, targetPath);
}
