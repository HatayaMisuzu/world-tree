#!/usr/bin/env node
// Determinism acceptance (PRD v0.3 §5/§7, S2 gate).
//   1. replay:   N turns (default 30) x 2 runs with a deterministic stub LLM; per-turn state hashes must match.
//   2. resume:   run K turns, stop the server (save), start a new server on the same data dir (load),
//                continue to N; per-turn hashes must equal the uninterrupted run.
//   3. grep:     rules layer (src/core/engine, src/core/data, src/core/world-engine.js) has no
//                Math.random / Date.now (allowlist below, each with a reason).
// Never calls a real model: the only LLM is a local 127.0.0.1 stub started by this script.
// Usage: node scripts/determinism-check.mjs [--turns 30] [--resume-at 20] [--only grep|replay|resume] [--json]
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { api, createTempDataDir, removeTempDir, startWorldTreeServer } from "../tests/integration/helpers/server-process.js";

const ROOT = resolve(".");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const TURNS = Number(opt("turns", 30));
const RESUME_AT = Number(opt("resume-at", Math.max(1, TURNS - 10)));
const ONLY = opt("only", "");
const DEMO = process.env.WT_DET_EXAMPLE_ID || "demo-world-cloud-steam-city";

// ---------- 3. static grep ----------
export const RULES_LAYER = ["src/core/engine", "src/core/data", "src/core/world-engine.js"];
// file -> reason. Keep this list short; every entry is reported.
export const GREP_ALLOWLIST = {};
function walk(p, re = /\.m?js$/, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f), re, out);
  else if (re.test(p)) out.push(p);
  return out;
}
export function grepRulesLayer(root = ROOT) {
  const hits = [];
  const allowed = [];
  for (const rel of RULES_LAYER) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const r = relative(root, file).split("\\").join("/");
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/Math\.random|Date\.now/.test(code)) (GREP_ALLOWLIST[r] ? allowed : hits).push(`${r}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  return { ok: hits.length === 0, hits, allowed };
}

// ---------- stub LLM ----------
function sha(s) { return createHash("sha256").update(s).digest("hex"); }
export const stubLog = [];
async function startStubLlm() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(404); res.end("{}"); return; }
      const parsed = JSON.parse(body || "{}");
      const msgs = parsed.messages || [];
      // wall-clock timestamps in the prompt are excluded (PRD §7: hash excludes wall clock); everything else keys the reply
      const last = String(msgs.filter(m => m.role === "user").at(-1)?.content || "").replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "<ISO>");
      const h = parseInt(sha(last).slice(0, 8), 16);
      if (process.env.WT_DET_DUMP) { stubLog.push({ h, last }); }
      const content = parsed.response_format?.type === "json_object"
        ? JSON.stringify({ intent: "action", emotionalSubtext: "调查", engagementDelta: (h % 3) - 1, tensionDelta: (h >> 3) % 3 - 1,
            fatigueDelta: 0, curiosityDelta: 1, pacingSuggestion: "hold", pressureSuggestion: "low", eventIntensitySuggestion: "light",
            sceneGoal: "推进云上蒸汽城调查", suggestedMustInclude: ["雾铃塔"], suggestedMustNotInclude: [], emotionalTarget: { increase: ["curiosity"], decrease: [] } })
        : `【叙事】\n雾铃塔的钟声在黄铜港上空回荡（稿${h % 7}）。米拉压低声音解释第七锚塔的压力记录被人改过，她愿意带你穿过锅炉廊查看原始阀门。远处巡云船的汽笛提醒你，云墙正在靠近，下一步的选择会决定你先追查工会、港务局，还是匿名委托本身。\n【状态】\nscene: ${["黄铜港", "锅炉廊", "第七锚塔"][h % 3]}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, stop: async () => { server.close(); await once(server, "close"); } };
}

// ---------- normalized state hash ----------
const VOLATILE_KEYS = new Set(["exportedAt", "updatedAt", "createdAt", "savedAt", "at", "timestamp", "ts", "time", "startedAt", "finishedAt",
  "elapsed", "elapsedMs", "durationMs", "latencyMs", "lastUpdated", "generatedAt", "recordedAt", "adoptedAt", "committedAt", "rejectedAt", "reversedAt"]);
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) if (!VOLATILE_KEYS.has(k)) o[k] = canon(v[k]);
    return o;
  }
  if (typeof v === "string") return v.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "<ISO>");
  return v;
}
function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }
export function worldStateForHash(worldDir) {
  const rt = join(worldDir, "runtime");
  const state = readJson(join(rt, "state.json")) || {};
  const files = {};
  // every json/jsonl under runtime/ (rule state, overlay, pending queues, memory, telemetry, turn frames)
  // except: chat transcript + its backups (LLM text, not rule state) and token usage.
  const skip = /(^|\/)(chat\.jsonl|usage\.jsonl|backups\/)|\.tmp$|\.lock$/i;
  if (existsSync(rt)) for (const f of walk(rt, /\.jsonl?$/)) {
    const r = relative(worldDir, f).split("\\").join("/");
    if (skip.test(r)) continue;
    if (/\.json$/.test(r)) files[r] = readJson(f);
    else if (/\.jsonl$/.test(r)) files[r] = readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return l; } });
  }
  return canon({ state, files });
}
export function hashState(obj) { return sha(JSON.stringify(obj)); }

const ACTIONS = [
  "我检查旧锚链齿轮，询问附近有没有人听见雾铃塔第七次敲响。",
  "我去找米拉·阀匠，请她带我看第七锚塔的压力记录。",
  "我沿着锅炉廊查看原始阀门，留意是否有被动过的痕迹。",
  "我向港务局的值班员打听匿名委托的来历。",
  "我回顾雾铃塔、齿轮和压力记录之间的联系。"
];
const inputFor = i => `${ACTIONS[i % ACTIONS.length]}（第${i + 1}步）`;

async function startServer(dataDir, llm) {
  const server = await startWorldTreeServer({ dataDir, env: { OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" } });
  await api(server, "/api/config", { method: "POST", body: JSON.stringify({ llmProvider: "openai-compatible", llmBaseUrl: llm.baseUrl, llmModel: "stub", llmThinking: "auto", llmTimeoutMs: 30000 }) });
  await api(server, "/api/secrets/llm", { method: "POST", body: JSON.stringify({ id: "det-stub", label: "stub", value: "stub-key" }) });
  return server;
}

async function playTurns(server, dataDir, moduleKey, from, to, messages, hashes, samples) {
  const worldDir = join(dataDir, "engine", "worlds", String(moduleKey).replace(/^world:/, ""));
  for (let i = from; i < to; i += 1) {
    const input = inputFor(i);
    const chat = await api(server, "/api/llm/chat", { method: "POST", body: JSON.stringify({
      input, moduleKey, modeId: "world-rpg", dataMode: "worldbook",
      engineState: { dataMode: "worldbook", emotionState: { engagement: 6, tension: 5, fatigue: 4, curiosity: 7 } },
      messages: messages.slice(-8) }) });
    if (chat.body?.status !== "ok") throw new Error(`turn ${i + 1}: status=${chat.body?.status} code=${chat.body?.code || ""} ${chat.body?.errorMsg || ""}`);
    messages.push({ role: "user", content: input }, { role: "assistant", content: String(chat.body.narrative || "") });
    const st = worldStateForHash(worldDir);
    hashes.push(hashState(st));
    samples.push(st);
  }
}

async function run({ turns, resumeAt = null, llm }) {
  stubLog.push({ run: true });
  const dataDir = await createTempDataDir("world-tree-det-");
  let server = await startServer(dataDir, llm);
  const hashes = []; const samples = []; const messages = [];
  try {
    const install = await api(server, "/api/examples/install", { method: "POST", body: JSON.stringify({ id: DEMO }) });
    if (install.body?.status !== "ok") throw new Error(`install failed: ${install.status}`);
    const moduleKey = install.body.module.id;
    if (resumeAt) {
      await playTurns(server, dataDir, moduleKey, 0, resumeAt, messages, hashes, samples);
      await server.stop();
      server = await startServer(dataDir, llm); // fresh process: state comes only from disk
      await playTurns(server, dataDir, moduleKey, resumeAt, turns, messages, hashes, samples);
    } else {
      await playTurns(server, dataDir, moduleKey, 0, turns, messages, hashes, samples);
    }
    return { hashes, samples };
  } finally {
    await server.stop().catch(() => {});
    if (process.env.WT_DET_KEEP) console.log(`kept data dir: ${dataDir}`); else await removeTempDir(dataDir).catch(() => {});
  }
}

function diffs(a, b, path = "", out = []) {
  if (out.length >= 12 || JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffs(a[k], b[k], `${path}.${k}`, out);
    return out;
  }
  out.push({ path, a: JSON.stringify(a)?.slice(0, 160), b: JSON.stringify(b)?.slice(0, 160) });
  return out;
}
function compare(name, x, y) {
  const n = Math.max(x.hashes.length, y.hashes.length);
  for (let i = 0; i < n; i += 1) if (x.hashes[i] !== y.hashes[i]) return { name, ok: false, turns: n, firstMismatchTurn: i + 1, diff: diffs(x.samples[i], y.samples[i]) };
  return { name, ok: true, turns: n, finalHash: x.hashes.at(-1) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const results = [];
  if (!ONLY || ONLY === "grep") {
    const g = grepRulesLayer();
    results.push({ name: "grep", ok: g.ok, hits: g.hits, allowlisted: g.allowed });
  }
  if (!ONLY || ONLY === "replay" || ONLY === "resume") {
    const llm = await startStubLlm();
    try {
      const a = await run({ turns: TURNS, llm });
      if (!ONLY || ONLY === "replay") { const b = await run({ turns: TURNS, llm }); results.push(compare(`replay ${TURNS}x2`, a, b)); }
      if (!ONLY || ONLY === "resume") { const c = await run({ turns: TURNS, resumeAt: RESUME_AT, llm }); results.push(compare(`resume@${RESUME_AT} vs continuous`, a, c)); }
    } finally { await llm.stop(); }
  }
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.turns ? ` turns=${r.turns}` : ""}${r.finalHash ? ` final=${r.finalHash.slice(0, 16)}` : ""}${r.firstMismatchTurn ? ` firstMismatchTurn=${r.firstMismatchTurn}` : ""}`);
    if (r.hits?.length) r.hits.forEach(h => console.log(`  HIT ${h}`));
    if (r.allowlisted?.length) console.log(`  allowlisted: ${r.allowlisted.length} line(s) in ${Object.keys(GREP_ALLOWLIST).join(", ")}`);
    for (const d of r.diff || []) console.log(`  diff ${d.path}\n    A=${d.a}\n    B=${d.b}`);
  }
  if (args.includes("--json")) console.log(JSON.stringify(results.map(({ samples, ...r }) => r), null, 2));
  if (process.env.WT_DET_DUMP) (await import("node:fs")).writeFileSync(process.env.WT_DET_DUMP, JSON.stringify(stubLog));
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
}
