// scripts/audit.mjs — v2.1 项目审计（兼容 preflight）
// 检查：版本号 / 关键文件存在 / 目录结构
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let errors = 0;

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const version = pkg?.version;

console.log(`\n📋 版本审计 (v${version})`);

// 版本一致性
for (const [file, regex] of [
  ["CHANGELOG.md", /v?(\d+\.\d+\.\d+)/],
  ["README.md", /\*\*Current version: v(\d+\.\d+\.\d+)\*\*/],
]) {
  const content = readFileSync(join(ROOT, file), "utf-8");
  const m = content.match(regex);
  if (m && m[1] === version) console.log(`  ✅ ${file}: ${m[1]}`);
  else { console.error(`  ❌ ${file}: 版本不匹配 (期望 ${version})`); errors++; }
}

// 关键文件
console.log("\n📁 关键文件");
for (const f of ["server.js", "world-tree-console.html", "package.json", "CHANGELOG.md", "README.md", "AI-GUIDE.md", "src/adapters/llm.js", "src/core/world-engine.js", "scripts/interface-audit.mjs"]) {
  if (existsSync(join(ROOT, f))) console.log(`  ✅ ${f}`);
  else { console.error(`  ❌ ${f}: 缺失`); errors++; }
}

// 目录
console.log("\n📂 目录结构");
for (const d of ["data/engine/worlds", "defaults/engine-profile", "defaults/world-profiles", "defaults/cases", "src/core/engine", "src/core/data/alchemy"]) {
  if (existsSync(join(ROOT, d))) console.log(`  ✅ ${d}`);
  else { console.error(`  ❌ ${d}: 缺失`); errors++; }
}

console.log(`\n审计完成: ${errors} 错误`);
process.exit(errors ? 1 : 0);
