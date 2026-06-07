// scripts/audit.mjs
// v0.7.5 — 项目审计脚本
// 检查：版本一致性 / 缺失文件 / 危险路径 / 便携版结构
// 用法: node scripts/audit.mjs [--compare <other-dir>]
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const CHECKS = [];
let errors = 0;
let warnings = 0;

function fail(msg) { errors++; console.error(`  ❌ ${msg}`); }
function warn(msg) { warnings++; console.warn(`  ⚠️ ${msg}`); }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// ── 1. 版本号一致性 ──
console.log("\n📋 版本号一致性");
const pkgJson = readJSON("package.json");
const manifest = readJSON("app-manifest.json");
const readme = readFile("README.md");
const changelog = readFile("CHANGELOG.md");

const version = pkgJson?.version;
if (!version) { fail("package.json 无 version 字段"); }
else {
  const sources = {
    "package.json": pkgJson.version,
    "app-manifest.json": manifest?.version,
    "README.md": extractVersion(readme, /v?(\d+\.\d+\.\d+)/),
    "CHANGELOG.md": extractVersion(changelog, /v?(\d+\.\d+\.\d+)/),
  };
  for (const [file, ver] of Object.entries(sources)) {
    if (ver === version) ok(`${file}: ${ver}`);
    else if (ver) fail(`${file}: ${ver} ≠ ${version}`);
    else warn(`${file}: 未找到版本号`);
  }
}

// ── 2. 危险路径检查 ──
console.log("\n🛡️ 危险路径");
const dangerous = searchInFiles("src", /(?<!\/\/.*)_desktop_engine(?!\/)/gm);
if (dangerous.length) {
  for (const f of dangerous) fail(`残留 _desktop_engine: ${f}`);
} else ok("无 _desktop_engine 残留");

const outsideData = searchInFiles("src", /D:\\\\[^d]|C:\\\\Users/);
if (outsideData.length) {
  for (const f of outsideData) warn(`外部路径引用: ${f}`);
} else ok("无外部绝对路径");

// ── 3. 关键目录存在性 ──
console.log("\n📁 目录结构");
const requiredDirs = [
  "data/engine/runs",
  "data/engine/worlds",
  "data/engine/global-memory",
  "data/modules",
  "data/profiles",
  "defaults/engine-profile",
  "defaults/engine-knowledge/fulltext",
  "defaults/world-profiles",
  "defaults/cases",
  "personas",
  "src/core/engine",
];
for (const dir of requiredDirs) {
  existsSync(join(PROJECT_ROOT, dir)) ? ok(dir) : fail(`缺失目录: ${dir}`);
}

// ── 4. 便携版结构 ──
console.log("\n📦 便携版结构");
const portable = join(PROJECT_ROOT, "..", "world-tree-desktop-portable");
if (!existsSync(portable)) {
  warn("未找到便携版目录（world-tree-desktop-portable）");
} else {
  const portableFiles = ["World Tree Desktop.exe", "resources/app.asar"];
  for (const f of portableFiles) {
    existsSync(join(portable, f)) ? ok(`portable/${f}`) : fail(`portable 缺失: ${f}`);
  }
}

// ── 5. 对比模式 ──
const compareDir = process.argv.includes("--compare") ? process.argv[process.argv.indexOf("--compare") + 1] : null;
if (compareDir) {
  console.log(`\n🔍 对比: ${compareDir}`);
  const coreFiles = [
    "src/core/engine/director.js",
    "src/core/engine/guardian.js",
    "src/core/engine/runtime.js",
    "src/core/engine/world-manager.js",
    "src/core/engine/lifecycle.js",
    "src/core/engine/output-parser.js",
    "src/core/world-engine.js",
    "src/adapters/llm.js",
  ];
  let diffs = 0;
  for (const f of coreFiles) {
    const local = join(PROJECT_ROOT, f);
    const remote = join(compareDir, f);
    if (!existsSync(local)) { fail(`本地缺失: ${f}`); continue; }
    if (!existsSync(remote)) { warn(`对比端缺失: ${f}`); continue; }
    const localHash = sha256(readFileSync(local));
    const remoteHash = sha256(readFileSync(remote));
    if (localHash !== remoteHash) {
      diffs++;
      console.log(`  🔴 ${f} — 不一致`);
    }
  }
  if (diffs === 0) ok("核心文件全部一致");
  else warn(`${diffs} 个文件不一致`);
}

// ── 总结 ──
console.log(`\n${"=".repeat(40)}`);
console.log(`审计完成: ${errors} 错误, ${warnings} 警告`);
if (errors > 0) process.exit(1);
else if (warnings > 0) process.exit(0);
else console.log("🎉 全部通过！");

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function readJSON(filepath) {
  try { return JSON.parse(readFileSync(join(PROJECT_ROOT, filepath), "utf-8")); }
  catch { return null; }
}

function readFile(filepath) {
  try { return readFileSync(join(PROJECT_ROOT, filepath), "utf-8"); }
  catch { return ""; }
}

function extractVersion(text, regex) {
  const m = text.match(regex);
  return m ? m[1] : null;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function searchInFiles(dir, pattern) {
  const results = [];
  const fullDir = join(PROJECT_ROOT, dir);
  if (!existsSync(fullDir)) return results;
  
  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const p = join(current, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith(".") && e.name !== "node_modules") walk(p); }
      else if (/\.(js|cjs|mjs|json|html|css|md)$/.test(e.name)) {
        try {
          const content = readFileSync(p, "utf-8");
          if (pattern.test(content)) {
            results.push(relative(PROJECT_ROOT, p));
          }
        } catch {}
      }
    }
  }
  walk(fullDir);
  return results;
}
