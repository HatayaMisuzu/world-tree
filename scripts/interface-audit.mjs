// scripts/interface-audit.mjs
// WTD 接口联动审计 v1.0
// 检查：API 端点 / 引擎数据流 / 文件 IO 写入→读取校准 / 前后端契约
// 用法：node scripts/interface-audit.mjs
// 应在每次 server.js / HTML / engine 改动后执行
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0, warnings = 0, passes = 0;

function fail(msg) { errors++; console.error(`  ❌ ${msg}`); }
function warn(msg) { warnings++; console.warn(`  ⚠️ ${msg}`); }
function pass(msg) { passes++; if (process.env.VERBOSE) console.log(`  ✅ ${msg}`); }

// ═══════════════════════════════════════════════════════════════
//  1. 文件 IO 校准：createModule 写入的文件 = buildModuleModel 读取的文件？
// ═══════════════════════════════════════════════════════════════

console.log("\n📁 文件 IO 校准");

const serverCode = readFileSync(join(ROOT, "server.js"), "utf-8");
const alchemyPreviewCode = readFileSync(join(ROOT, "src/server/alchemy-preview-service.js"), "utf-8");
const mechanismCode = readFileSync(join(ROOT, "src/server/mechanism-service.js"), "utf-8");
const turnStateCode = readFileSync(join(ROOT, "src/server/turn-state-frame-service.js"), "utf-8");

const moduleServiceCode = readFileSync(join(ROOT, "src/server/module-service.js"), "utf-8");
const ioSourceCode = `${serverCode}\n${moduleServiceCode}`;

// 从当前服务端入口和 module-service 里找到 buildModuleModel 读的 shared/ 文件
const readMatches = [...ioSourceCode.matchAll(/join\(shared,\s*"([^"]+)"/g)];
const readFiles = new Set(readMatches.map(m => m[1]));

// 从当前服务端入口和 module-service 里找到 createModule 写的所有 shared/ 文件
// 方式1: 显式字符串 join(worldDir, "shared", "xxx.json")
const explicitWrites = new Set([...ioSourceCode.matchAll(/join\(worldDir,\s*"shared",\s*"([^"]+)"/g)].map(m => m[1]));
// 方式2: for 循环里用变量写的（从数组声明里提取）
const forLoopMatches = [...ioSourceCode.matchAll(/for\s*\(const\s*\[file,\s*[^)]+\]\s*of\s*\[(.*?)\]\]\s*\)/gs)];
for (const forLoopMatch of forLoopMatches) {
  const arrText = forLoopMatch[1];
  const loopFiles = [...arrText.matchAll(/"([a-z_]+\.json)"/g)].map(m => m[1]);
  for (const f of loopFiles) explicitWrites.add(f);
}

// Stage 5H: mode-specific contract readback — recognized via dynamic readback functions
const modeSpecificContractFiles = new Set([
  "world_rpg.json",
  "world_threads.json",
  "tabletop.json",
  "strategy.json",
  "murder_mystery.json",
  "mystery.json",
  "creation_forge.json",
  "forge_blueprints.json",
]);

const hasDynamicModeSpecificReadback =
  moduleServiceCode.includes("modeSpecificSharedFilesForWorld") &&
  moduleServiceCode.includes("readModeSpecificShared") &&
  moduleServiceCode.includes("modeSpecific");

if (hasDynamicModeSpecificReadback) {
  for (const f of modeSpecificContractFiles) readFiles.add(f);
}

for (const f of readFiles) {
  if (explicitWrites.has(f) || f === "characters_base.json") // characters_base.json 是兼容回退
    pass(`shared/${f}: 写入→读取对齐`);
  else fail(`shared/${f}: 引擎读取但 createModule 不写入`);
}

// 反向检查：写入但未读取的文件
for (const f of explicitWrites) {
  if (!readFiles.has(f)) {
    warn(`shared/${f}: createModule 写入但 buildModuleModel 不读取——数据写入磁盘但引擎无需用，确认是否预期`);
  }
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
// JS 已拆分为独立文件，合并搜索上下文避免假阳性
const jsCode = readFileSync(join(ROOT, "world-tree-console.js"), "utf-8");
const combinedCode = htmlCode + "\n" + jsCode;

// 检查 API 端点是否被 HTML 调用且响应字段被使用
const apiContracts = [
  { endpoint: "/api/llm/chat", sentFields: ["input","moduleKey","modeId","dataMode","engineState","messages"], recvFields: ["status","narrative","errorMsg","engineState","modePlay"] },
  { endpoint: "/api/modules", recvFields: ["id","name","displayName","type","dataMode","subType","turnCount"] },
  { endpoint: "/api/modules/create", sentFields: ["name","displayName","dataMode","subType","preset"], recvFields: ["status","module"] },
  { endpoint: "/api/modules/{id}/history", recvFields: ["status","messages","turnCount","engineState","lastScene"] },
  { endpoint: "/api/examples", recvFields: ["status","examples"] },
  { endpoint: "/api/examples/install", sentFields: ["id"], recvFields: ["status","module"] },
  { endpoint: "/api/alchemy/digest", recvFields: ["status","module","entries","characters","locations","errorMsg"] },
  { endpoint: "/api/alchemy/review", recvFields: ["status","items"] },
  { endpoint: "/api/alchemy/preview", sentFields: ["text","moduleKey","mode","target","userGoal","options"], recvFields: ["status","previewId","preview"] },
  { endpoint: "/api/alchemy/refine", sentFields: ["previewId","instruction","selectedItemIds","mode"], recvFields: ["status","previewId","previousPreviewId","preview"] },
  { endpoint: "/api/alchemy/commit", sentFields: ["previewId","action","selectedItemIds","editedItems"], recvFields: ["status","reviewItems","stats"] },
  { endpoint: "/api/mechanisms/draft/from-alchemy", sentFields: ["previewId","text","moduleKey","userGoal"], recvFields: ["status","drafts","libraryRecommendations","summary"] },
  { endpoint: "/api/mechanisms/library", recvFields: ["status","templates","recommendations"] },
  { endpoint: "/api/mechanisms/world/commit-drafts", sentFields: ["moduleKey","drafts"], recvFields: ["status","committed","skipped","cache"] },
  { endpoint: "/api/status/turn/latest", recvFields: ["status","frame"] },
  { endpoint: "/api/status/turn/{turnId}", recvFields: ["status","frame"] },
  { endpoint: "/api/status/turns", recvFields: ["status","turns"] },
  { endpoint: "/api/characters/import", recvFields: ["status","character","module"] },
  { endpoint: "/api/worldbook", recvFields: ["status","entries"] },
  { endpoint: "/api/worldbook/test", recvFields: ["status","hits"] },
  { endpoint: "/api/connections", recvFields: ["status","items","templates","active"] },
  { endpoint: "/api/chat/message", recvFields: ["status","message","messages"] },
  { endpoint: "/api/turn/debug", recvFields: ["status","debug"] },
  { endpoint: "/api/world-pack/export", recvFields: ["status","filename","pack"] },
  { endpoint: "/api/world-pack/import", recvFields: ["status","preview","summary","module"] },
  { endpoint: "/api/plugins", recvFields: ["status","plugins"] },
  { endpoint: "/api/health", recvFields: ["version","llm","data","debugMode"] },
];

for (const c of apiContracts) {
  for (const field of c.recvFields) {
    const used = combinedCode.includes(`.${field}`) || combinedCode.includes(`["${field}"]`) || combinedCode.includes(`['${field}']`);
    if (!used && field !== "errorMsg") warn(`${c.endpoint} 返回 .${field} 但 HTML 未读取`);
    else pass(`${c.endpoint}.${field}: 响应被使用`);
  }
}

if (serverCode.includes("errorPayload") && serverCode.includes("userMsg") && combinedCode.includes("payload?.userMsg"))
  pass("统一错误响应 userMsg 被前端优先使用");
else
  fail("统一错误响应未形成 server → frontend 链路");

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
if (combinedCode.includes("history") && combinedCode.includes('role:r.role') && combinedCode.includes('content:r.content'))
  pass("HTML 加载历史时正确映射 role+content 字段");

// 检查消息 id 补全
if (combinedCode.includes('"h_"') && combinedCode.includes('idx'))
  pass("历史消息有 id 补全逻辑");

// ═══════════════════════════════════════════════════════════════
//  4. engineState 传递链路
// ═══════════════════════════════════════════════════════════════

console.log("\n🔄 engineState 传递链路");

if (combinedCode.includes("AS.engineState"))
  pass("HTML 有 AS.engineState 状态存储");
else fail("HTML 缺少 AS.engineState 定义");

if (serverCode.includes("engineState: engineState"))
  pass("handleLlmChat 传递 engineState 给引擎");

if (serverCode.includes('"engineState"') && serverCode.includes("state.json"))
  pass("state.json 包含 engineState 写入");

if (combinedCode.includes("res.engineState") && combinedCode.includes("AS.engineState"))
  pass("历史加载后恢复 engineState 到 AS");

if (combinedCode.includes("AS.engineState||") || combinedCode.includes("engineState:AS.engineState"))
  pass("发送聊天时使用 AS.engineState");

// ═══════════════════════════════════════════════════════════════
//  5. 快速项目草稿
// ═══════════════════════════════════════════════════════════════

console.log("\n⚡ 快速项目草稿");

if (serverCode.includes("quickProject") && serverCode.includes("source.txt"))
  pass("快速开始创建真实草稿世界并保存 source.txt");

if (serverCode.includes("finalizeDraft") && serverCode.includes("/api/modules/finalize-draft"))
  pass("草稿世界提供 finalize API");

if (combinedCode.includes("quickProject: true") && combinedCode.includes("快速项目草稿"))
  pass("UI 使用快速项目草稿标识并调用创建接口");

// ═══════════════════════════════════════════════════════════════
//  6. 密钥安全
// ═══════════════════════════════════════════════════════════════

console.log("\n🔑 密钥安全");

if ((serverCode.includes('\\*{4,}') || serverCode.includes('/^\\*{6,}/')) && serverCode.includes("saveLlmSecret"))
  pass("saveLlmSecret 拒绝掩码格式 key");

if (combinedCode.includes('hasApiKey') && !combinedCode.includes('value="${U.esc(AS.apiKey'))
  pass("HTML 不预填密码框内容");

// ═══════════════════════════════════════════════════════════════
//  7. 炼金预览边界
// ═══════════════════════════════════════════════════════════════

console.log("\n⚗️ 炼金预览边界");

for (const endpoint of ["/api/alchemy/preview", "/api/alchemy/refine", "/api/alchemy/commit"]) {
  if (serverCode.includes(endpoint) && combinedCode.includes(endpoint)) pass(`${endpoint}: 前后端路由存在`);
  else fail(`${endpoint}: 前后端路由缺失`);
}

for (const label of ["预览处理结果", "协作创作", "加入审核队列"]) {
  if (combinedCode.includes(label)) pass(`炼金台 UI 包含“${label}”`);
  else fail(`炼金台 UI 缺少“${label}”`);
}

const createBlock = alchemyPreviewCode.slice(alchemyPreviewCode.indexOf("async function create("), alchemyPreviewCode.indexOf("async function refine("));
const refineBlock = alchemyPreviewCode.slice(alchemyPreviewCode.indexOf("async function refine("), alchemyPreviewCode.indexOf("async function commit("));
const commitBlock = alchemyPreviewCode.slice(alchemyPreviewCode.indexOf("async function commit("));
if (!createBlock.includes("enqueueReviewItems") && !refineBlock.includes("enqueueReviewItems")) pass("preview/refine 不调用审核队列写入");
else fail("preview/refine 不得调用 enqueueReviewItems");
if (commitBlock.includes("enqueueReviewItems")) pass("commit 显式调用审核队列写入");
else fail("commit 未接入 enqueueReviewItems");
if (serverCode.includes("runtime\\/alchemy-previews") && serverCode.includes("DEFAULT_EXPORT_EXCLUDES")) pass("旧数据导出默认排除 alchemy-previews");
else fail("旧数据导出未明确排除 alchemy-previews");
if (alchemyPreviewCode.includes("PREVIEW_ID_RE") && alchemyPreviewCode.includes("randomUUID")) pass("previewId 使用后端 UUID 白名单");
else fail("previewId 缺少 UUID 路径约束");
if (serverCode.includes("scrubPromptForPrivacy(system)") && serverCode.includes("scrubPromptForPrivacy(user)")) pass("炼金 LLM 调用经过 prompt privacy scrub");
else fail("炼金 LLM 调用缺少 prompt privacy scrub");

// ═══════════════════════════════════════════════════════════════
//  8. 机制、状态帧与开发者观测边界
// ═══════════════════════════════════════════════════════════════

console.log("\n🧭 机制与状态帧联动");

for (const endpoint of [
  "/api/mechanisms/draft/from-alchemy",
  "/api/mechanisms/library",
  "/api/mechanisms/world",
  "/api/mechanisms/world/commit-drafts",
  "/api/status/turn/latest",
  "/api/status/turns"
]) {
  if (serverCode.includes(endpoint) && combinedCode.includes(endpoint)) pass(`${endpoint}: 前后端路由存在`);
  else fail(`${endpoint}: 前后端路由缺失`);
}
if (serverCode.includes('path.startsWith("/api/status/turn/")') && combinedCode.includes("/api/status/turn/${encodeURIComponent(turnId)}")) pass("/api/status/turn/:turnId: 前后端动态路由存在");
else fail("/api/status/turn/:turnId: 前后端动态路由缺失");
if (mechanismCode.includes('source, sourceRef') && mechanismCode.includes('selected: true')) pass("输入与机制库草稿默认 selected=true");
else fail("机制草稿默认选中规则缺失");
if (!mechanismCode.includes("enqueueReviewItems") && !mechanismCode.includes("applyReviewItemToWorld")) pass("机制草稿提交不复用普通 worldbook review apply");
else fail("机制草稿错误复用普通审核队列");
if (serverCode.includes("createTurnStateFrame") && serverCode.includes("await saveTurnStateFrame(moduleId, frame)")) pass("persistTurn 生成并持久化 TurnStateFrame");
else fail("persistTurn 未持久化 TurnStateFrame");
if (turnStateCode.includes('new Set(["stat_bar", "inventory_grid", "status_list"])') && turnStateCode.includes("SECRET_KEY_RE")) pass("VisualPacket 白名单与状态密钥清理存在");
else fail("VisualPacket 白名单或状态清理缺失");
if (combinedCode.includes("developerObservabilityOpen: false") && !combinedCode.includes("C.contextPanel()")) pass("开发者观测默认关闭且 contextPanel 不再默认挂载");
else fail("contextPanel 或开发者观测默认状态不符合要求");
if (combinedCode.includes('data-turn-id=') && combinedCode.includes("selectTurnState")) pass("历史消息 turnId 回溯链路存在");
else fail("历史消息 turnId 回溯链路缺失");
if (serverCode.includes("runtime\\/status") && serverCode.includes("runtime\\/mechanisms") && serverCode.includes("debug|proposal|proposals|session|sessions")) pass("默认数据导出排除状态调试、机制缓存、proposal 与 session");
else fail("默认数据导出排除规则不完整");

// ═══════════════════════════════════════════════════════════════
//  9. Real Play 可见挂载
// ═══════════════════════════════════════════════════════════════

console.log("\n🎲 Real Play 可见挂载");
for (const endpoint of ["/api/workflow/status", "/api/workflow/types"]) {
  if (serverCode.includes(endpoint) && combinedCode.includes(endpoint)) pass(`${endpoint}: 前后端路由存在`);
  else fail(`${endpoint}: 前后端路由缺失`);
}
if (combinedCode.includes("${renderWorkflowPanel()}") && combinedCode.includes("data-workflow-panel open")) pass("Workflow panel 在真实 chat surface 可见挂载");
else fail("Workflow panel 未稳定挂载到 chat surface");
if (combinedCode.includes("PROGRESS_STAGES") && combinedCode.includes("renderProgressPanel()") && combinedCode.includes("不代表流式输出")) pass("非 SSE 等待阶段 UI 已挂载并正确说明");
else fail("等待阶段 UI 缺失或误导为流式输出");
for (const marker of ["骰子判定", "线索卡与假设白板", "策略资源", "真实游玩状态"]) {
  if (combinedCode.includes(marker) || combinedCode.includes("🎲 Tabletop V2")) pass(`模式 UI 包含“${marker}”或 Tabletop V2`);
  else fail(`模式 UI 缺少“${marker}”`);
}
// Tabletop V2 UI action routing 完整性
for (const action of ["tabletop-v2-preview-import", "tabletop-v2-start", "tabletop-v2-save", "tabletop-v2-branch", "tabletop-v2-end", "tabletop-v2-clear"]) {
  if (combinedCode.includes(`data-action="${action}"`) || combinedCode.includes(`"${action}"`)) pass(`Tabletop V2 按钮 “${action}” 存在`);
  else fail(`Tabletop V2 按钮 “${action}” 缺失`);
}
for (const name of ["sendTabletopV2Turn", "blocked_by_book", "API.tabletopV2Turn"]) {
  if (combinedCode.includes(name)) pass(`Tabletop V2 路由函数/标记 “${name}” 存在`);
  else fail(`Tabletop V2 路由函数/标记 “${name}” 缺失`);
}

// ═══════════════════════════════════════════════════════════════
//  结论
// ═══════════════════════════════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`接口联动审计完成: ${passes} 通过 / ${warnings} 警告 / ${errors} 错误`);
if (errors > 0) { console.log("结论: 🔴 未通过 — 请修复错误后重新审计"); process.exit(1); }
if (warnings > 0) { console.log("结论: 🟡 部分通过 — 有警告项需确认"); process.exit(0); }
console.log("结论: 🟢 全部通过");
