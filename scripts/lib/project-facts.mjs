import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CANONICAL_PRODUCT_FEATURES } from "../../src/core/features/feature-alias-registry.js";

export const PLAYABLE_STATUS = "HUMAN_VALIDATION_REQUIRED";

export function parseTapTestCount(output = "") {
  const matches = [...String(output).matchAll(/^# tests\s+(\d+)\s*$/gm)];
  if (!matches.length) throw new Error("TEST_COUNT_NOT_FOUND");
  return Number(matches.at(-1)[1]);
}

export function parsePackJson(output = "") {
  const packs = JSON.parse(String(output || "[]"));
  const pack = packs[0];
  if (!pack) throw new Error("PACK_RESULT_NOT_FOUND");
  return {
    packageFiles: Array.isArray(pack.files) ? pack.files.length : 0,
    packageBytes: Number(pack.unpackedSize || 0),
    packedBytes: Number(pack.size || 0)
  };
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})\n${detail}`);
  }
  return result.stdout || "";
}

export function collectProjectFacts({ root = process.cwd(), runCommand = run } = {}) {
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const head = runCommand("git", ["rev-parse", "HEAD"], { cwd: root }).trim();
  const unitOutput = runCommand("node", ["--test", "tests/unit/*.test.js"], { cwd: root });
  const integrationOutput = runCommand("node", ["--test", "tests/integration/*.test.js"], { cwd: root });
  const packOutput = runCommand("npm", ["pack", "--dry-run", "--json"], { cwd: root });
  const pack = parsePackJson(packOutput);
  return {
    schemaVersion: 1,
    version: packageJson.version,
    head,
    generatedAt: new Date().toISOString(),
    unitTests: parseTapTestCount(unitOutput),
    integrationTests: parseTapTestCount(integrationOutput),
    packageFiles: pack.packageFiles,
    packageBytes: pack.packageBytes,
    packedBytes: pack.packedBytes,
    canonicalEntries: CANONICAL_PRODUCT_FEATURES.length,
    playableStatus: PLAYABLE_STATUS
  };
}

export function validateProjectFacts(facts, expected = {}) {
  const errors = [];
  if (facts?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^\d+\.\d+\.\d+/.test(String(facts?.version || ""))) errors.push("version is invalid");
  if (!/^[a-f0-9]{40}$/i.test(String(facts?.head || ""))) errors.push("head must be a full git SHA");
  for (const key of ["unitTests", "integrationTests", "packageFiles", "packageBytes", "packedBytes"]) {
    if (!Number.isInteger(facts?.[key]) || facts[key] <= 0) errors.push(`${key} must be a positive integer`);
  }
  if (facts?.canonicalEntries !== 8) errors.push("canonicalEntries must remain 8");
  if (facts?.playableStatus !== PLAYABLE_STATUS) errors.push(`playableStatus must be ${PLAYABLE_STATUS}`);
  for (const [key, value] of Object.entries(expected)) {
    if (facts?.[key] !== value) errors.push(`${key} mismatch: ${facts?.[key]} !== ${value}`);
  }
  return errors;
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
