import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const VERSION = "0.4.2-v2-engineering-foundation-truth.0";

const requiredFiles = [
  "docs/PROJECT_TRUTH_SOURCE.md",
  "docs/CURRENT_PROJECT_STATE.md",
  "docs/V2_ENGINEERING_CLOSURE_STATUS.md",
  "docs/V2_ENTRY_COMPLETION_STATUS.md",
  "docs/PLAY_MODE_GUIDE.md",
  "docs/FEATURES.md",
  "docs/STATUS_TERMINOLOGY.md",
  "docs/AGENT_STATUS_HANDOFF.md",
  "README.en.md",
  "docs/AI_AGENT_OPERATING_GUIDE.md",
  "docs/MAINTENANCE_ENTRY.md",
  "docs/DOCUMENTATION_STATUS.md",
  "docs/CURRENT_DOCUMENTATION_INVENTORY.md",
  "docs/DOCUMENT_RETENTION_POLICY.md",
  "docs/TRUTH_SOURCE_SYNC_REPORT_v0.4.2.md"
];

const errors = [];
const warnings = [];

function read(path) {
  return readFileSync(join(ROOT, path), "utf-8");
}

for (const file of requiredFiles) {
  if (!existsSync(join(ROOT, file))) errors.push(`missing required truth-source file: ${file}`);
}

if (existsSync(join(ROOT, "package.json"))) {
  const pkg = JSON.parse(read("package.json"));
  if (pkg.version !== VERSION) errors.push(`package.json version mismatch: ${pkg.version} !== ${VERSION}`);
  if (!pkg.scripts?.["truth:check"]) errors.push("package.json missing scripts.truth:check");
}

const mustContain = {
  "README.md": ["PROJECT_TRUTH_SOURCE", "engineering foundation", "product closure"],
  "AI-GUIDE.md": ["PROJECT_TRUTH_SOURCE", "V2_ENGINEERING_CLOSURE_STATUS"],
  "docs/INDEX.md": ["PROJECT_TRUTH_SOURCE", "V2_ENGINEERING_CLOSURE_STATUS"],
  "docs/CURRENT_PROJECT_STATE.md": ["Worldbook V2", "Strategy Sim V2", "ENGINEERING FOUNDATION COMPLETE", "PRODUCT CLOSURE NOT COMPLETE"],
  "docs/V2_ENTRY_COMPLETION_STATUS.md": ["Worldbook V2", "Strategy Sim V2", "ENGINEERING FOUNDATION COMPLETE", "PRODUCT CLOSURE NOT COMPLETE"],
  "README.en.md": ["Worldbook V2 engineering foundation", "Strategy Sim V2 engineering foundation", "product closure"],
  "app-manifest.json": ["Truth-source alignment", "Strategy Sim V2", "Worldbook V2"],
  "docs/AI_AGENT_OPERATING_GUIDE.md": ["PROJECT_TRUTH_SOURCE.md", "V2_ENGINEERING_CLOSURE_STATUS.md", "evidence index"],
  "docs/MAINTENANCE_ENTRY.md": ["PROJECT_TRUTH_SOURCE.md", "V2_ENGINEERING_CLOSURE_STATUS.md"],
  "docs/DOCUMENTATION_STATUS.md": ["PROJECT_TRUTH_SOURCE.md", "CURRENT_DOCUMENTATION_INVENTORY.md", "Do not hardcode test pass counts"],
  "docs/STRATEGY_SIM_V2_REALITY_CHECK.md": ["EXECUTED", "test:strategy-sim-v2"]
};

for (const [file, needles] of Object.entries(mustContain)) {
  if (!existsSync(join(ROOT, file))) {
    errors.push(`missing file for truth check: ${file}`);
    continue;
  }
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) errors.push(`${file} missing required text: ${needle}`);
  }
}

const currentFacingDirs = ["docs"];
const stalePatterns = [
  { re: /Worldbook V2 is not complete\.?/i, msg: "Use: Worldbook V2 engineering foundation is complete; product closure is not complete." },
  { re: /Full Worldbook V2 is not complete\.?/i, msg: "Use engineering/product split for Worldbook V2." },
  { re: /Strategy V2 is not complete\.?/i, msg: "Use: Strategy Sim V2 engineering foundation is complete; product closure is not complete." },
  { re: /Strategy V2 incomplete/i, msg: "Use engineering/product split for Strategy Sim V2." },
  { re: /Worldbook V2 incomplete/i, msg: "Use engineering/product split for Worldbook V2." },
  { re: /V2 Entry Closure \(sealed\)/i, msg: "Update to current truth-source alignment wording." },
  { re: /当前能力以最新 Unreleased \/ V1/i, msg: "Use current truth-source docs instead." },
  { re: /待 Hermes 执行后补充真实结果/i, msg: "Fill in reality check with actual execution results." },
  { re: /test:unit \| 399 PASS/i, msg: "Do not hardcode test pass counts in docs." },
  { re: /test:integration \| 72 PASS/i, msg: "Do not hardcode test pass counts in docs." }
];

function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (rel.includes("/archive")) continue;
      walk(rel, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

for (const file of ["README.md", "AI-GUIDE.md", "CHANGELOG.md", ...walk("docs")]) {
  if (!existsSync(join(ROOT, file))) continue;
  const text = read(file);
  for (const pattern of stalePatterns) {
    if (pattern.re.test(text)) errors.push(`${file} has stale unqualified status phrase. ${pattern.msg}`);
  }
}

if (errors.length) {
  console.error("truth-source sync check failed:");
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.error("warnings:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log(`truth-source sync check passed for ${VERSION}`);
