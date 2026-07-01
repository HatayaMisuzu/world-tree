import { readFileSync, existsSync } from "node:fs";

const allowed = new Set([
  "current_truth",
  "active_operating",
  "active_architecture",
  "active_product_contract",
  "current_evidence_report",
  "candidate_or_proposal",
  "historical_archive",
  "deprecated"
]);

function fail(message) {
  console.error(`[doc-lifecycle] FAIL: ${message}`);
  process.exitCode = 1;
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const registry = JSON.parse(readFileSync("docs/DOC_REGISTRY.json", "utf8"));

if (registry.version !== pkg.version) {
  fail(`registry version ${registry.version} does not match package version ${pkg.version}`);
}

const docs = Array.isArray(registry.documents) ? registry.documents : [];
const byPath = new Map(docs.map((doc) => [doc.path, doc]));

for (const doc of docs) {
  if (!allowed.has(doc.lifecycle)) fail(`invalid lifecycle ${doc.lifecycle} for ${doc.path}`);
  if (!existsSync(doc.path)) fail(`registered document missing: ${doc.path}`);
  if (doc.lifecycle === "deprecated" && !doc.replacement && !doc.notes) {
    fail(`deprecated doc must include replacement or notes: ${doc.path}`);
  }
}

for (const required of ["docs/PROJECT_TRUTH_SOURCE.md", "docs/CURRENT_PROJECT_STATE.md"]) {
  const doc = byPath.get(required);
  if (!doc || doc.lifecycle !== "current_truth") {
    fail(`${required} must be registered as current_truth`);
  }
}

for (const p of registry.truthSourcePriority || []) {
  const doc = byPath.get(p);
  if (doc && ["historical_archive", "deprecated"].includes(doc.lifecycle)) {
    fail(`truthSourcePriority cannot include ${doc.lifecycle}: ${p}`);
  }
}

for (const doc of docs.filter((item) => !["historical_archive", "deprecated"].includes(item.lifecycle))) {
  const text = readFileSync(doc.path, "utf8");
  if (text.includes("v0.4.1-v2-entry-closure.0")) {
    fail(`active document contains stale baseline string: ${doc.path}`);
  }
}

if (!process.exitCode) {
  console.log(`[doc-lifecycle] PASS: ${docs.length} registered documents checked`);
}
