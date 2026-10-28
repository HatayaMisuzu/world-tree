#!/usr/bin/env node
// scripts/reach.mjs — read-only module reachability report.
// Usage: node scripts/reach.mjs [--root <dir>] [--json] [--chain <file> ...] [--show-unreachable]
// Classifies every JS source file as: product / test-only / script-only / unreachable.
// Edges: static import/export-from, require('lit'), import('lit'); non-literal import() is warned.
// Product entries: package.json main/bin, server.js, <script src> in *.html (and JS they import).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const ROOT = resolve(opt("--root") || process.cwd());
const asJson = argv.includes("--json");
const chainsFor = argv.flatMap((a, i) => (argv[i - 1] === "--chain" ? [a] : []));
const SKIP_DIRS = new Set(["node_modules", ".git", "userData", "data", "coverage"]);
const JS_EXT = new Set([".js", ".mjs", ".cjs"]);
const rel = (p) => relative(ROOT, p).split(sep).join("/");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const allFiles = walk(ROOT);
const jsFiles = allFiles.filter((f) => JS_EXT.has(extname(f)));

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null; // bare package
  const base = spec.startsWith("/") ? join(ROOT, spec) : resolve(dirname(fromFile), spec);
  const cands = [base, ...[...JS_EXT].map((x) => base + x), ...[...JS_EXT].map((x) => join(base, "index" + x))];
  return cands.find((c) => existsSync(c) && statSync(c).isFile()) || null;
}

const STATIC_RE = /\b(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?["']([^"'\n]+)["']/g;
const REQUIRE_RE = /\brequire\(\s*["']([^"'\n]+)["']\s*\)/g;
const DYN_RE = /\bimport\(\s*([^)]*?)\s*[,)]/g;
const warnings = [];
const edgeCache = new Map();
function edges(file) {
  if (edgeCache.has(file)) return edgeCache.get(file);
  const src = readFileSync(file, "utf8");
  const lineOf = (idx) => src.slice(0, idx).split("\n").length;
  const out = [];
  const add = (spec, idx, kind) => {
    const t = resolveSpec(file, spec);
    if (t) out.push({ to: t, line: lineOf(idx), kind });
    else if (spec.startsWith(".")) warnings.push(`UNRESOLVED ${rel(file)}:${lineOf(idx)} ${kind} "${spec}"`);
  };
  for (const m of src.matchAll(STATIC_RE)) add(m[1], m.index, "import");
  for (const m of src.matchAll(REQUIRE_RE)) add(m[1], m.index, "require");
  for (const m of src.matchAll(DYN_RE)) {
    const arg = m[1].trim();
    const lit = /^(["'`])([^"'`$]*)\1$/.exec(arg);
    if (lit) add(lit[2], m.index, "dynamic-import");
    else if (arg) warnings.push(`NON_LITERAL_DYNAMIC_IMPORT ${rel(file)}:${lineOf(m.index)} import(${arg.slice(0, 80)})`);
  }
  edgeCache.set(file, out);
  return out;
}

function htmlScripts(htmlFile) {
  const src = readFileSync(htmlFile, "utf8");
  const out = [];
  for (const m of src.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) {
    const t = resolveSpec(htmlFile, m[1].startsWith("/") ? m[1] : "./" + m[1]);
    if (t) out.push(t);
  }
  return out;
}

function productEntries() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const list = [];
  const push = (p) => { const r = p && resolveSpec(join(ROOT, "x"), "./" + p.replace(/^\.\//, "")); if (r) list.push(r); };
  push(pkg.main); push("server.js");
  if (typeof pkg.bin === "string") push(pkg.bin); else Object.values(pkg.bin || {}).forEach(push);
  for (const h of allFiles.filter((f) => f.endsWith(".html") && !rel(f).startsWith("tests/") && !rel(f).startsWith("archive/"))) list.push(...htmlScripts(h));
  return [...new Set(list)];
}
const testEntries = jsFiles.filter((f) => /^tests\/.*\.test\.(m?js|cjs)$/.test(rel(f)));
const scriptEntries = jsFiles.filter((f) => /^scripts\/[^/]+\.(m?js|cjs)$/.test(rel(f)));

function bfs(entries) {
  const parent = new Map(entries.map((e) => [e, null]));
  const q = [...entries];
  while (q.length) {
    const f = q.shift();
    if (!JS_EXT.has(extname(f))) continue;
    for (const e of edges(f)) if (!parent.has(e.to)) { parent.set(e.to, { from: f, line: e.line, kind: e.kind }); q.push(e.to); }
  }
  return parent;
}
const P = bfs(productEntries()), T = bfs(testEntries), S = bfs(scriptEntries);
const chain = (map, f) => { const c = []; let cur = f; while (cur) { const p = map.get(cur); c.unshift(p ? `${rel(cur)} (${p.kind} @${rel(p.from)}:${p.line})` : rel(cur)); cur = p?.from; } return c; };

const classes = { product: [], "test-only": [], "script-only": [], "test+script-only": [], unreachable: [] };
const universe = jsFiles.filter((f) => !testEntries.includes(f) && !scriptEntries.includes(f));
for (const f of universe) {
  const r = rel(f);
  if (P.has(f)) classes.product.push(r);
  else if (T.has(f) && S.has(f)) classes["test+script-only"].push(r);
  else if (T.has(f)) classes["test-only"].push(r);
  else if (S.has(f)) classes["script-only"].push(r);
  else classes.unreachable.push(r);
}
const result = { root: ROOT, productEntries: productEntries().map(rel), counts: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length])), classes, warnings: [...new Set(warnings)], chains: {} };
for (const c of chainsFor) {
  const f = resolve(ROOT, c);
  result.chains[c] = P.has(f) ? { class: "product", chain: chain(P, f) } : T.has(f) ? { class: "test", chain: chain(T, f) } : S.has(f) ? { class: "script", chain: chain(S, f) } : { class: "unreachable", chain: [] };
}
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`root: ${ROOT}`);
  console.log(`product entries: ${result.productEntries.join(", ")}`);
  console.log(`counts: ${JSON.stringify(result.counts)}`);
  for (const k of ["test-only", "script-only", "test+script-only", "unreachable"]) { console.log(`\n## ${k} (${classes[k].length})`); classes[k].sort().forEach((x) => console.log("  " + x)); }
  if (argv.includes("--show-reachable")) { console.log(`\n## product (${classes.product.length})`); classes.product.sort().forEach((x) => console.log("  " + x)); }
  console.log(`\n## warnings (${result.warnings.length})`); result.warnings.forEach((w) => console.log("  " + w));
  for (const [k, v] of Object.entries(result.chains)) { console.log(`\n## chain ${k}: ${v.class}`); v.chain.forEach((x, i) => console.log(`  ${i ? "-> " : ""}${x}`)); }
}
