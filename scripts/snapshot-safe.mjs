import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import {
  MAX_TRACKED_FILE_BYTES,
  buildSnapshotManifest,
  findSecrets,
  forbiddenTrackedPath,
  normalizeTrackedPath
} from "./lib/safe-snapshot.mjs";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: options.encoding || "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "git command failed").toString());
  return result.stdout;
}

const status = String(git(["status", "--porcelain"])).trim();
if (status && process.env.WT_SNAPSHOT_ALLOW_DIRTY !== "1") {
  throw new Error("SNAPSHOT_DIRTY_WORKTREE: commit or stash tracked changes before creating a release snapshot");
}

const head = String(git(["rev-parse", "HEAD"])).trim();
const tracked = String(git(["ls-files", "-z"])).split("\0").filter(Boolean).map(normalizeTrackedPath).sort();
const violations = [];

for (const file of tracked) {
  const blockedBy = forbiddenTrackedPath(file);
  if (blockedBy) {
    violations.push(`${file}: forbidden path (${blockedBy})`);
    continue;
  }
  const absolute = resolve(root, file);
  const stat = statSync(absolute);
  if (stat.size > MAX_TRACKED_FILE_BYTES) {
    violations.push(`${file}: ${stat.size} bytes exceeds ${MAX_TRACKED_FILE_BYTES}`);
    continue;
  }
  if (stat.size <= 2 * 1024 * 1024) {
    const findings = findSecrets(readFileSync(absolute, "utf8"));
    if (findings.length) violations.push(`${file}: suspected secret (${findings.join(", ")})`);
  }
}

if (violations.length) throw new Error(`SNAPSHOT_SAFETY_VIOLATION\n${violations.join("\n")}`);

const shortHead = head.slice(0, 12);
const outputDir = resolve(root, process.env.WT_SNAPSHOT_DIR || "output/snapshots");
const archivePath = resolve(outputDir, `world-tree-safe-${packageJson.version}-${shortHead}.zip`);
mkdirSync(dirname(archivePath), { recursive: true });
git(["archive", "--format=zip", `--output=${archivePath}`, "HEAD"]);
const archiveBuffer = readFileSync(archivePath);
const manifest = buildSnapshotManifest({
  version: packageJson.version,
  head,
  archiveName: basename(archivePath),
  archiveBytes: archiveBuffer.length,
  files: tracked,
  archiveBuffer
});
const manifestPath = `${archivePath}.manifest.json`;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`[snapshot:safe] PASS ${archivePath}`);
console.log(`[snapshot:safe] manifest ${manifestPath}`);
