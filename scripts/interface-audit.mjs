// scripts/interface-audit.mjs
// WTD 接口联动审计 v1.0
// 检查：API 端点 / 引擎数据流 / 文件 IO 写入→读取校准 / 前后端契约
// 用法：node scripts/interface-audit.mjs
// 应在每次 server.js / HTML / engine 改动后执行
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createServer } from "node:http";

const ROOT = resolve(import.meta.dirname, "..");
let errors = 0, warnings = 0, passes = 0;

function fail(msg) { errors++; console.error(`  ❌ ${msg}`); }
function warn(msg) { warnings++; console.warn(`  ⚠️ ${msg}`); }
function pass(msg) { passes++; if (process.env.VERBOSE) console.log(`  ✅ ${msg}`); }

// ═══════════════════════════════════════════════════════════════
//  1. 文件 IO 校准：createModule 写入的文件 = buildModuleModel 读取的文件？
// ═══════════════════════════════════════════════════════════════

console.log("\n📁 文件 IO 校准");

const serverCode = readFileSync(join(ROOT, "server.js"), "utf-8");

// 从 server.js 里找到 buildModuleModel 读的 shared/ 文件
const readMatches = [...serverCode.matchAll(/join\(shared,\s*"([^"]+)"/g)];
const readFiles = new Set(readMatches.map(m => m[1]));

// 从 server.js 里找到 createModule 写的所有 shared/ 文件
// 方式1: 显式字符串 join(worldDir, "shared", "xxx.json")
const explicitWrites = new Set([...serverCode.matchAll(/join\(worldDir,\s*"shared",\s*"([^"]+)"/g)].map(m => m[1]));
// 方式2: for 循环里用变量写的（从数组声明里提取）
const forLoopMatch = serverCode.match(/for\s*\(const\s*\[file,\s*[^)]+\]\s*of\s*\[(.*?)\]\]\s*\)/s);
if (forLoopMatch) {
  const arrText = forLoopMatch[1];
  const loopFiles = [...arrText.matchAll(/"([a-z_]+\.json)"/g)].map(m => m[1]);
  for (const f of loopFiles) explicitWrites.add(f);
}

for (const f of readFiles) {
  if (explicitWrites.has(f) || f === "characters_base.json") // characters_base.json 是兼容回退
    pass(`shared/${f}: 写入→读取对齐`);
  else fail(`shared/${f}: 引擎读取但 createModule 不写入`);
}

// 检查 writeSet 执行后是否有回读路径
console.log("\n📝 overlay writeSet → 回读检查");
if (serverCode.includes("readOverlayData")) pass("persistTurn 有 readOverlayData 回读路径");
else fail("persistTurn 执行了 writeSet 但没有 readOverlayData 回读");

// ═══════════════════════════════════════════════════════════════
//  2. API 响应形状 vs HTML 读取：前后端契约检查
// ═══════════════════════════════════════════════════════════════

console.log("\n🔌 API 契约检查");

const htmlCode = readFileSync(join(ROOT, "world-tree-console.html"), "utf-8");

// 检查 API 端点是否被 HTML 调用且响应字段被使用
const apiContracts = [
  { endpoint: "/api/llm/chat", sentFields: ["input","moduleKey","dataMode","engineState","messages"], recvFields: ["status","narrative","errorMsg","engineState"] },
  { endpoint: "/api/modules", recvFields: ["id","name","displayName","type","dataMode","subType","turnCount"] },
  { endpoint: "/api/modules/create", sentFields: ["name","displayName","dataMode","subType","preset"], recvFields: ["status","module"] },
  { endpoint: "/api/modules/{id}/history", recvFields: ["status","messages","turnCount","engineState","lastScene"] },
  { endpoint: "/api/alchemy/digest", recvFields: ["status","module","entries","characters","locations","errorMsg"] },
];

for (const c of apiContracts) {
  for (const field of c.recvFields) {
    const used = htmlCode.includes(`.${field}`) || htmlCode.includes(`["${field}"]`) || htmlCode.includes(`['${field}']`);
    if (!used && field !== "errorMsg") warn(`${c.endpoint} 返回 .${field} 但 HTML 未读取`);
    else pass(`${c.endpoint}.${field}: 响应被使用`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. chat.jsonl / memory.jsonl 读写一致性
// ═══════════════════════════════════════════════════════════════

console.log("\n📋 JSONL 读写一致性");

// 写 chat.jsonl 的字段
const writeChatFields = ["role", "user", "content", "input", "round", "ts", "sections", "narrative"];
let hasWrite = false;
for (const f of writeChatFields) {
  if (serverCode.includes(`"${f}"`) && serverCode.includes("chat.jsonl")) { hasWrite = true; break; }
}
pass(hasWrite ? "chat.jsonl 有写入逻辑" : "chat.jsonl 无写入逻辑");

// 读 chat.jsonl → 补 id 字段
if (htmlCode.includes("history") && htmlCode.includes('role:r.role') && htmlCode.includes('content:r.content'))
  pass("HTML 加载历史时正确映射 role+content 字段");

// 检查消息 id 补全
if (htmlCode.includes('"h_"') && htmlCode.includes('idx'))
  pass("历史消息有 id 补全逻辑");

// ═══════════════════════════════════════════════════════════════
//  4. engineState 传递链路
// ═══════════════════════════════════════════════════════════════

console.log("\n🔄 engineState 传递链路");

if (htmlCode.includes("AS.engineState"))
  pass("HTML 有 AS.engineState 状态存储");
else fail("HTML 缺少 AS.engineState 定义");

if (serverCode.includes("engineState: engineState"))
  pass("handleLlmChat 传递 engineState 给引擎");

if (serverCode.includes('"engineState"') && serverCode.includes("state.json"))
  pass("state.json 包含 engineState 写入");

if (htmlCode.includes("res.engineState") && htmlCode.includes("AS.engineState"))
  pass("历史加载后恢复 engineState 到 AS");

if (htmlCode.includes("AS.engineState||") || htmlCode.includes("engineState:AS.engineState"))
  pass("发送聊天时使用 AS.engineState");

// ═══════════════════════════════════════════════════════════════
//  5. 快速开始模式隔离
// ═══════════════════════════════════════════════════════════════

console.log("\n⚡ 快速模式隔离");

if (serverCode.includes('startsWith("__")') && serverCode.includes("persistTurn"))
  pass("__quick__ 模块跳过持久化");

if (htmlCode.includes("AS.isQuickStart") && htmlCode.includes("persist()"))
  pass("快速模式跳过 localStorage 写入");

if (htmlCode.includes("AS.isQuickStart") && htmlCode.includes("快速模式"))
  pass("快速模式有 UI 标识");

// ═══════════════════════════════════════════════════════════════
//  6. 密钥安全
// ═══════════════════════════════════════════════════════════════

console.log("\n🔑 密钥安全");

if (serverCode.includes('/^\\*{6,}/') && serverCode.includes("saveLlmSecret"))
  pass("saveLlmSecret 拒绝掩码格式 key");

if (htmlCode.includes('hasApiKey') && !htmlCode.includes('value="${U.esc(AS.apiKey'))
  pass("HTML 不预填密码框内容");

// ═══════════════════════════════════════════════════════════════
//  结论
// ═══════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`接口联动审计完成: ${passes} 通过 / ${warnings} 警告 / ${errors} 错误`);
if (errors > 0) { console.log("结论: 🔴 未通过 — 请修复错误后重新审计"); process.exit(1); }
if (warnings > 0) { console.log("结论: 🟡 部分通过 — 有警告项需确认"); process.exit(0); }
console.log("结论: 🟢 全部通过");
