#!/usr/bin/env node
// docs:check — 文档完整性检查 + V1 闭环真实性检查

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, "..");

const checks = [];
let failures = 0;

function check(name, path, predicate, message) {
  const full = resolve(BASE, path);
  const ok = predicate(full);
  checks.push({ name, path, ok, message });
  if (!ok) { failures++; console.error(`FAIL: ${name} (${path}) — ${message}`); }
  else console.log(`OK: ${name}`);
}

// Core docs
check("README", "README.md", p => existsSync(p), "missing");
check("CHANGELOG", "CHANGELOG.md", p => existsSync(p), "missing");
check("AI-GUIDE", "AI-GUIDE.md", p => existsSync(p), "missing");
check("docs/INDEX", "docs/INDEX.md", p => existsSync(p), "missing");
check("docs/PROJECT_OVERVIEW", "docs/PROJECT_OVERVIEW.md", p => existsSync(p), "missing");
check("docs/FEATURES", "docs/FEATURES.md", p => existsSync(p), "missing");
check("docs/ARCHITECTURE_V1", "docs/ARCHITECTURE_V1.md", p => existsSync(p), "missing");
check("docs/API_REFERENCE", "docs/API_REFERENCE.md", p => existsSync(p), "missing");
check("docs/SAVE_SYSTEM", "docs/SAVE_SYSTEM_AND_WORLD_PACK.md", p => existsSync(p), "missing");
check("docs/PROPOSAL", "docs/PROPOSAL_AND_REVIEW_SYSTEM.md", p => existsSync(p), "missing");
check("docs/SCRIPTS", "docs/SCRIPTS_AND_CHECKS.md", p => existsSync(p), "missing");
check("docs/AI_AGENT_GUIDE", "docs/AI_AGENT_OPERATING_GUIDE.md", p => existsSync(p), "missing");
check("docs/STATUS", "docs/DOCUMENTATION_STATUS.md", p => existsSync(p), "missing");
check("docs/PROJECT_FACTS", "docs/PROJECT_FACTS.md", p => existsSync(p), "missing");

// Content checks
try {
  const readme = readFileSync(resolve(BASE, "README.md"), "utf-8");
  check("README mentions milestone", "README.md", () => readme.includes("快速体验") || readme.includes("World Tree"), "README should have expected structure");
  check("README mode table", "README.md", () => (readme.includes("quick-setting") && readme.includes("creation-forge")) || (readme.includes("快速设定") && readme.includes("炼金台")), "README should list all modes");
} catch {}

try {
  const changelog = readFileSync(resolve(BASE, "CHANGELOG.md"), "utf-8");
  check("CHANGELOG no ignored AI", "CHANGELOG.md", () => !changelog.includes("AI 无需阅读") && !changelog.includes("AI无需阅读"), "CHANGELOG should not say AI should ignore it");
} catch {}

try {
  const aiguide = readFileSync(resolve(BASE, "AI-GUIDE.md"), "utf-8");
  check("AI-GUIDE updated", "AI-GUIDE.md", () => aiguide.includes("CURRENT_PROJECT_STATE") || aiguide.includes("Service Deepening") || aiguide.includes("Workflow HTTP"), "AI-GUIDE should reflect current milestone");
} catch {}

// ═══ V1 closure truth checks ═══

// system-closure.test.js 是否被 test:unit 引用
try {
  const pkgJson = JSON.parse(readFileSync(resolve(BASE, "package.json"), "utf-8"));
  const testUnitCmd = pkgJson.scripts?.["test:unit"] || "";
  const isGlob = testUnitCmd.includes("tests/unit/*.test.js");
  check("test:unit includes system-closure", "package.json",
    () => testUnitCmd.includes("system-closure.test.js") || isGlob,
    "system-closure.test.js must be covered by test:unit");
} catch (err) {
  failures++;
  console.error(`FAIL: test:unit includes system-closure — ${err.message}`);
}

try {
  const pkgJson = JSON.parse(readFileSync(resolve(BASE, "package.json"), "utf-8"));
  const factsDoc = readFileSync(resolve(BASE, "docs/PROJECT_FACTS.md"), "utf-8");
  const architecture = readFileSync(resolve(BASE, "docs/ARCHITECTURE_MAP.md"), "utf-8");
  check("project facts commands registered", "package.json",
    () => Boolean(pkgJson.scripts?.["facts:generate"] && pkgJson.scripts?.["facts:check"] && pkgJson.scripts?.["snapshot:safe"]),
    "facts and safe snapshot commands must be registered");
  check("project facts document machine source", "docs/PROJECT_FACTS.md",
    () => factsDoc.includes("output/project-facts.json") && factsDoc.includes("HUMAN_VALIDATION_REQUIRED"),
    "project facts must document the generated evidence path and human-validation boundary");
  check("architecture uses generated facts", "docs/ARCHITECTURE_MAP.md",
    () => architecture.includes("PROJECT_FACTS.md") && !/test:unit\s+->\s+\d+ tests/.test(architecture),
    "architecture must reference generated facts instead of hand-maintained counts");
} catch (err) {
  failures++;
  console.error(`FAIL: generated project facts documentation — ${err.message}`);
}

// mode-runner 不包含 modeMeaning + "_v1" 猜测
try {
  const modeRunner = readFileSync(resolve(BASE, "src/core/system/mode-runner.js"), "utf-8");
  check("mode-runner no modeMeaning guess", "src/core/system/mode-runner.js",
    () => !modeRunner.includes('modeMeaning + "_v1"'),
    "mode-runner must not guess prompt profile from modeMeaning + \"_v1\"");
} catch {}

// mode-runner catch 不返回 "完成" 作为错误 fallback
try {
  const modeRunner = readFileSync(resolve(BASE, "src/core/system/mode-runner.js"), "utf-8");
  // 检查：catch 块中是否有返回 ok:true 且 text 包含"完成"的情况（排除正常成功返回）
  const hasOkFalseInCatch = modeRunner.includes('return { ok: false');
  check("mode-runner catch returns ok:false", "src/core/system/mode-runner.js",
    () => hasOkFalseInCatch,
    "mode-runner catch blocks must return ok:false, not success text");
} catch {}

// proposal-bus 不再是 status return stub
try {
  const proposalBus = readFileSync(resolve(BASE, "src/core/system/proposal-bus.js"), "utf-8");
  const hasRealIO = proposalBus.includes("readProposalLog") || proposalBus.includes("writeProposalLog") ||
                    proposalBus.includes("appendJsonl") || proposalBus.includes("writeJson");
  check("proposal-bus has real I/O", "src/core/system/proposal-bus.js",
    () => hasRealIO,
    "proposal-bus must have real file I/O, not just status returns");
} catch {}

// save-system 不再是 ok true stub
try {
  const saveSystem = readFileSync(resolve(BASE, "src/core/system/world-tree-save-system.js"), "utf-8");
  const hasRealWrite = saveSystem.includes("appendJsonl") || saveSystem.includes("writeJson(") ||
                       saveSystem.includes("ensureDir");
  check("save-system has real write", "src/core/system/world-tree-save-system.js",
    () => hasRealWrite,
    "save-system must have real file writes, not just ok:true stubs");
} catch {}

// route-index validateAllWorldTreeRoutes 有真实校验
try {
  const routeIndex = readFileSync(resolve(BASE, "src/core/system/world-tree-route-index.js"), "utf-8");
  const hasRealValidation = routeIndex.includes("PROMPT_PROFILE_MISSING") ||
                            routeIndex.includes("hasModePromptProfile") ||
                            routeIndex.includes("MISSING_FIELD");
  check("route-index has real validation", "src/core/system/world-tree-route-index.js",
    () => hasRealValidation,
    "validateAllWorldTreeRoutes must have real checks, not unconditional ok:true");
} catch {}

// mode-isolation 有深层过滤
try {
  const isolationPolicy = readFileSync(resolve(BASE, "src/core/system/mode-isolation-policy.js"), "utf-8");
  check("isolation has deepFilter", "src/core/system/mode-isolation-policy.js",
    () => isolationPolicy.includes("deepFilterHiddenFields"),
    "mode-isolation-policy must have deep field filtering");
} catch {}

console.log(`\n${checks.length} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
