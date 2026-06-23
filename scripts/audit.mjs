// scripts/audit.mjs — 项目审计（兼容 preflight）
// 检查：版本号 / 关键文件存在 / 目录结构 / 开源卫生
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

function pass(message) {
  console.log(`  ✅ ${message}`);
}

function fail(message) {
  console.error(`  ❌ ${message}`);
  errors++;
}

function readText(file) {
  return readFileSync(join(ROOT, file), "utf-8");
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const version = pkg?.version;

console.log(`\n📋 版本审计 (v${version})`);

// 版本一致性
for (const [file, regex] of [
  ["CHANGELOG.md", /^##\s+v?(\d+\.\d+\.\d+)/m],
  ["README.md", /\*\*(?:Current version|当前版本|Package version)\*\*:\s*v(\d+\.\d+\.\d+)/],
]) {
  const content = readText(file);
  const m = content.match(regex);
  if (m && m[1] === version) pass(`${file}: ${m[1]}`);
  else if (file === "README.md" && !m) pass(`${file}: 版本号未显式展示（package.json 为真相源）`);
  else fail(`${file}: 版本不匹配 (期望 ${version})`);
}

// 引擎版本号与 package.json 对照
{
  // ENGINE_VERSION 动态从 package.json 读取，检查 modules.js 中是否有动态读取逻辑
  const engineContent = readText("src/core/engine/modules.js");
  const hasDynamicVersion = engineContent.includes("package.json") && engineContent.includes("ENGINE_VERSION");
  if (hasDynamicVersion) pass(`modules.js ENGINE_VERSION: 动态读取（跟随 package.json）`);
  else fail(`modules.js ENGINE_VERSION 应为动态读取`);
}

// CHANGELOG 日期不能随版本推进而倒退；同日多版本允许。
{
  const changelog = readText("CHANGELOG.md");
  const entries = [...changelog.matchAll(/^##\s+v?(\d+\.\d+\.\d+)\s+.+?\((\d{4}-\d{2}-\d{2})\)/gm)]
    .map((m) => ({ version: m[1], date: m[2] }));
  let ok = entries.length > 0;
  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i].date < entries[i + 1].date) {
      fail(`CHANGELOG 日期倒退: v${entries[i].version} (${entries[i].date}) 早于 v${entries[i + 1].version} (${entries[i + 1].date})`);
      ok = false;
    }
  }
  if (ok) pass(`CHANGELOG 日期单调: ${entries.length} 个版本`);
}

// 关键文件
console.log("\n📁 关键文件");
for (const f of ["server.js", "world-tree-console.html", "package.json", "CHANGELOG.md", "README.md", "README.en.md", "LICENSE", "AI-GUIDE.md", "src/adapters/llm.js", "src/core/world-engine.js", "scripts/interface-audit.mjs"]) {
  if (existsSync(join(ROOT, f))) pass(f);
  else fail(`${f}: 缺失`);
}

// 目录
console.log("\n📂 目录结构");
for (const d of ["defaults/engine-profile", "defaults/world-profiles", "defaults/examples", "src/core/engine", "src/core/data/alchemy", "tests/unit", "legacy/adapters"]) {
  if (existsSync(join(ROOT, d))) pass(d);
  else fail(`${d}: 缺失`);
}

console.log("\n🧹 开源卫生");

// 核心公开事实源不得出现本机绝对路径。defaults/ 与 archive/ 是历史/知识库材料，不在此处拦截。
{
  const checkedFiles = [
    "README.md",
    "README.en.md",
    "LICENSE",
    "AI-GUIDE.md",
    "CHANGELOG.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "package.json",
    "server.js",
    "world-tree-console.html",
    "world-tree-console.css",
    "world-tree-console.js",
    "scripts/audit.mjs",
    "scripts/test.mjs",
    "scripts/interface-audit.mjs",
    "src/core/world-engine.js",
    "src/core/engine/context-engine.js",
    "src/core/data/skill-parser.js",
    "legacy/adapters/hermes.js"
  ];
  const machinePath = /(?<![A-Za-z])[A-Z]:[\\/]/i;
  const hits = [];
  for (const file of checkedFiles) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    const lines = readFileSync(full, "utf-8").split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (machinePath.test(line)) hits.push(`${file}:${idx + 1}`);
    });
  }
  if (hits.length) fail(`核心文件存在本机绝对路径: ${hits.join(", ")}`);
  else pass("核心文件无本机绝对路径");
}

// README / AI-GUIDE 必须反映角色卡当前单来源实现。
{
  const publicDocs = `${readText("README.md")}\n${readText("AI-GUIDE.md")}`;
  if (/双来源|Hermes skills/.test(publicDocs)) fail("公开文档仍描述角色卡 Hermes 双来源");
  else pass("角色卡来源文档与 server.js 单来源实现一致");
}

// context-engine 当前被 world-engine 调用，不应标记为 deprecated。
{
  const worldEngine = readText("src/core/world-engine.js");
  const contextEngine = readText("src/core/engine/context-engine.js");
  if (worldEngine.includes("context-engine.js") && /@deprecated/.test(contextEngine)) {
    fail("context-engine.js 当前被调用但仍标记 @deprecated");
  } else {
    pass("context-engine 状态描述与调用关系一致");
  }
}

// 敏感文件与用户数据必须被忽略；config.example.json 作为安全模板保留。
{
  const gitignore = readText(".gitignore");
  const requiredPatterns = [
    "userData/",
    "config.json",
    "secrets.json",
    ".env",
    "data/engine/worlds/",
    "data/engine/characters/",
    "data/engine/global-memory/",
    "data/engine/runs/"
  ];
  const missing = requiredPatterns.filter((p) => !gitignore.includes(p));
  if (missing.length) fail(`.gitignore 缺少敏感/用户数据规则: ${missing.join(", ")}`);
  else pass(".gitignore 覆盖敏感文件与用户数据");

  if (!existsSync(join(ROOT, "config.example.json"))) {
    fail("缺少 config.example.json");
  } else {
    const example = readText("config.example.json");
    if (/api[_-]?key|sk-[A-Za-z0-9]/i.test(example)) fail("config.example.json 疑似包含密钥字段或真实 key");
    else pass("config.example.json 不含密钥");
  }
}

// 内置示例清单可以为空；一旦登记素材，路径必须真实存在。
{
  const manifestPath = join(ROOT, "defaults/examples/manifest.json");
  if (!existsSync(manifestPath)) {
    fail("缺少 defaults/examples/manifest.json");
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const examples = Array.isArray(manifest.examples) ? manifest.examples : null;
      if (!examples) fail("defaults/examples/manifest.json 的 examples 必须是数组");
      else {
        const missing = examples
          .filter((item) => !item?.id || !item?.type || !item?.path || !existsSync(join(ROOT, "defaults/examples", item.path)))
          .map((item) => item?.id || "(unknown)");
        if (missing.length) fail(`defaults/examples manifest 存在无效素材路径: ${missing.join(", ")}`);
        else pass(`defaults/examples manifest 有效: ${examples.length} 条`);
      }
    } catch (err) {
      fail(`defaults/examples/manifest.json 解析失败: ${err.message}`);
    }
  }
}

// MIT 决策必须在 LICENSE / package.json / README 中一致。
{
  const pkg = JSON.parse(readText("package.json"));
  const readme = readText("README.md");
  const license = readText("LICENSE");
  if (pkg.license !== "MIT") fail("package.json license 必须为 MIT");
  else if (!/MIT License/.test(license)) fail("LICENSE 不是 MIT 全文");
  else if (!/license-MIT/.test(readme) && !/## License/.test(readme)) fail("README 缺少 MIT license 说明");
  else pass("MIT license 元数据一致");
}

// 来源未确认的默认分发内容不应随开源包发布。
{
  const riskyDefaults = ["defaults/engine-knowledge", "defaults/cases"];
  const present = riskyDefaults.filter((p) => existsSync(join(ROOT, p)));
  if (present.length) fail(`来源未确认 defaults 内容仍存在: ${present.join(", ")}`);
  else pass("来源未确认 defaults 内容已移除");
  const runtimeRefs = [
    "server.js",
    "world-tree-console.js",
    "src/core/path-catalog.js"
  ].flatMap((file) => {
    const full = join(ROOT, file);
    if (!existsSync(full)) return [];
    const content = readFileSync(full, "utf-8");
    return riskyDefaults.filter((p) => content.includes(p)).map((p) => `${file} -> ${p}`);
  });
  if (runtimeRefs.length) fail(`运行时路径仍引用已移除 defaults 内容: ${runtimeRefs.join(", ")}`);
  else pass("运行时路径不再引用已移除 defaults 内容");
  if (!existsSync(join(ROOT, "docs/content-provenance.md"))) fail("缺少 docs/content-provenance.md");
  else pass("内容来源决策已存档");
}

// ═══════════════════════════════════════════════════════════════
//  版本事实源一致性（v0.1.10+）
// ═══════════════════════════════════════════════════════════════

console.log("\n📌 版本事实源");

// package-lock.json 与 package.json 版本一致
{
  const lockPath = join(ROOT, "package-lock.json");
  if (!existsSync(lockPath)) {
    fail("缺少 package-lock.json");
  } else {
    try {
      const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
      const lockVersion = lock.version || "";
      const lockPackagesVersion = (lock.packages && lock.packages[""]) ? lock.packages[""].version : "";
      if (lockVersion !== version) fail(`package-lock.json 顶层 version=${lockVersion}, 期望 ${version}`);
      else pass(`package-lock.json 顶层 version: ${version}`);
      if (lockPackagesVersion && lockPackagesVersion !== version) fail(`package-lock.json packages[""].version=${lockPackagesVersion}, 期望 ${version}`);
      else pass(`package-lock.json packages[""].version: ${version}`);
    } catch (err) {
      fail(`package-lock.json 解析失败: ${err.message}`);
    }
  }
}

// AI-GUIDE.md 最后更新版本
{
  const aiGuide = readText("AI-GUIDE.md");
  const m = aiGuide.match(/最后更新:\s*v?(\d+\.\d+\.\d+)/);
  if (!m) fail("AI-GUIDE.md 缺少'最后更新'版本号");
  else if (m[1] !== version) fail(`AI-GUIDE.md 最后更新 v${m[1]}, 期望 v${version}`);
  else pass(`AI-GUIDE.md 最后更新: v${version}`);
}

// world-tree-console.html 不含旧版本硬编码
{
  const html = readText("world-tree-console.html");
  // 检查是否仍硬编码旧版本（历史上出现过 v0.1.8）
  const oldVersions = [];
  for (const oldVer of ["0.1.8", "0.1.9"]) {
    if (new RegExp(`v?${oldVer.replace(/\./g, "\\.")}`).test(html)) {
      oldVersions.push(oldVer);
    }
  }
  if (oldVersions.length) fail(`world-tree-console.html 仍含旧版本硬编码: ${oldVersions.join(", ")}`);
  else pass("world-tree-console.html 无旧版本硬编码");
}

console.log(`\n审计完成: ${errors} 错误`);
process.exit(errors ? 1 : 0);
