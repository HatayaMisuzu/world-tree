import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validatePrehumanEvidence } from "./lib/prehuman-evidence-validation.mjs";

function git(...args) {
  return execFileSync("git", args, { cwd: resolve("."), encoding: "utf8" }).trim();
}

const dirty = git("status", "--porcelain");
if (dirty) throw new Error("PREHUMAN_GATE_DIRTY_WORKTREE");
const testedSha = git("rev-parse", "HEAD");
const evidencePath = process.env.WORLD_TREE_PREHUMAN_EVIDENCE;
if (!evidencePath) throw new Error("WORLD_TREE_PREHUMAN_EVIDENCE is required");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npmCommand, ["run", "verify:pr"], { cwd: resolve("."), stdio: "inherit" });

const evidence = JSON.parse(readFileSync(resolve(evidencePath), "utf8"));
const validation = validatePrehumanEvidence(evidence, { testedSha });
if (!validation.ok) throw new Error(`PREHUMAN_REAL_PROVIDER_EVIDENCE_INVALID: ${validation.errors.join("; ")}`);

console.log("PREHUMAN_AUTOMATED_GATE=PASS");
console.log(`testedSha=${testedSha}`);
