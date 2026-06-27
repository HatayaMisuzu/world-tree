#!/usr/bin/env node
// scripts/verify-audit-reality.mjs
// Cross-platform audit reality checker for World Tree.

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const rel = (...parts) => join(ROOT, ...parts);

function walk(dir, predicate = () => true, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, predicate, out);
    else if (predicate(p, st)) out.push(p);
  }
  return out;
}

function topLevelFiles(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isFile() && p.endsWith(suffix));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTextSafe(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const pkg = readJson(rel("package.json"));
const unitFiles = topLevelFiles(rel("tests", "unit"), ".test.js").map((p) => p.replaceAll("\\", "/"));
const integrationFiles = topLevelFiles(rel("tests", "integration"), ".test.js").map((p) => p.replaceAll("\\", "/"));
const coreJs = walk(rel("src", "core"), (p) => p.endsWith(".js"));
const docsTop = topLevelFiles(rel("docs"), ".md");
const docsAll = walk(rel("docs"), (p) => p.endsWith(".md"));
const rootMd = topLevelFiles(ROOT, ".md");
const auditFiles = walk(rel("audit"));

const testUnit = pkg.scripts?.["test:unit"] || "";
const usesGlob = testUnit.includes("tests/unit/*.test.js");
const listed = usesGlob
  ? unitFiles
  : [...testUnit.matchAll(/tests\/unit\/[^\s]+\.test\.js/g)].map((m) => m[0]);

const listedSet = new Set(listed.map((p) => p.replaceAll("\\", "/")));
const actualSet = new Set(unitFiles);
const missing = unitFiles.filter((p) => !listedSet.has(p));
const nonexistent = listed.filter((p) => !existsSync(rel(p)));

function section(title) {
  console.log(`\n===== ${title} =====`);
}

section("File counts");
console.log(`src/core JS files:        ${coreJs.length}`);
console.log(`tests/unit files:         ${unitFiles.length}`);
console.log(`tests/integration files:  ${integrationFiles.length}`);
console.log(`docs/*.md top-level:      ${docsTop.length}`);
console.log(`docs recursive *.md:      ${docsAll.length}`);
console.log(`root *.md:                ${rootMd.length}`);
console.log(`audit/ files:             ${auditFiles.length}`);

section("Key script coverage");
console.log(`npm test:                 ${pkg.scripts?.test || ""}`);
console.log(`test:unit mode:           ${usesGlob ? "glob" : "explicit"}`);
console.log(`test:unit listed files:   ${listedSet.size}`);
console.log(`tests/unit actual files:  ${unitFiles.length}`);
console.log(`missing from test:unit:   ${missing.length}`);
console.log(`nonexistent listed:       ${nonexistent.length}`);

if (missing.length) {
  console.log("\nMissing sample:");
  for (const p of missing.slice(0, 30)) console.log(`  ${p}`);
}

if (nonexistent.length) {
  console.log("\nNonexistent listed:");
  for (const p of nonexistent) console.log(`  ${p}`);
}

section("Known-risk state checks");
const roadmap = readTextSafe(rel("ROADMAP.md"));
console.log(`ROADMAP has old v0.3.0 baseline: ${roadmap.includes("Current Baseline: v0.3.0")}`);

const gitignore = readTextSafe(rel(".gitignore"));
console.log(`.gitignore contains audit/:       ${/(^|\n)audit\//.test(gitignore)}`);

const gitattributes = readTextSafe(rel(".gitattributes"));
console.log(`.gitattributes exists:            ${existsSync(rel(".gitattributes"))}`);
console.log(`global png lfs rule:              ${/^\*\.png\s+filter=lfs/m.test(gitattributes)}`);

const manifest = readTextSafe(rel("src/core/modes/mode-manifest.js"));
console.log(`creation-forge manifest planned:  ${manifest.includes('"creation-forge"') && manifest.includes("MODE_STATUS.PLANNED")}`);
console.log(`creation-forge default hidden:    ${manifest.includes("defaultVisibility: false")}`);

section("Interpretation");
console.log("test files != test cases/pass.");
console.log("Use npm run test:unit and npm run test:integration output for pass/case counts.");
