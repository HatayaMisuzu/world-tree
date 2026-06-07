// 🆕 v0.7.4.1 数据归家：overlay 根从 _desktop_engine 改为 data/engine
export const OVERLAY_ROOT = "data/engine";
export const ENGINE_VERSION = "world-tree-v12.19-desktop-full";

// ---- 写入签名 ----
export function signWrite(data, operation = "merge") {
  return {
    ...(data || {}),
    _writtenBy: "world-tree-desktop",
    _writtenAt: new Date().toISOString(),
    _engineVersion: ENGINE_VERSION,
    _operation: operation
  };
}

export function stripSignature(data) {
  if (!data || typeof data !== "object") return data;
  const clean = { ...data };
  delete clean._writtenBy;
  delete clean._writtenAt;
  delete clean._engineVersion;
  delete clean._operation;
  return clean;
}

export function moduleOverlayPath(moduleKey = "unloaded", dataMode = "worldbook") {
  const modeDir = String(dataMode || "worldbook").replace(/[^\w.-]/g, "-");
  const modDir = String(moduleKey || "unloaded").replace(/[^\w.-]/g, "-");
  return `${OVERLAY_ROOT}/runs/${modeDir}/modules/${modDir}`;
}

export function archiveOverlayPath(dataMode = "worldbook") {
  const modeDir = String(dataMode || "worldbook").replace(/[^\w.-]/g, "-");
  return `${OVERLAY_ROOT}/runs/${modeDir}/archives`;
}

export function auditRootPath() {
  return `${OVERLAY_ROOT}/audit`;
}

export function overlayFiles(moduleKey, dataMode) {
  const root = moduleOverlayPath(moduleKey, dataMode);
  return {
    root,
    runtime: `${root}/runtime-overlay.json`,
    canon: `${root}/canon-overlay.json`,
    characters: `${root}/characters-overlay.json`,
    worldbook: `${root}/worldbook-overlay.json`,
    sceneChain: `${root}/scene-chain.json`,
    memory: `${root}/memory-store.json`,
    commandLog: `${root}/command-log.jsonl`,
    patchLog: `${root}/patch-log.jsonl`,
    auditLog: `${root}/audit-log.jsonl`,
    backups: `${root}/backups`
  };
}

export function buildOverlayWriteSet(moduleKey, overlayPatch, dataMode = "worldbook") {
  const files = overlayFiles(moduleKey, dataMode);
  return [
    { path: files.runtime, mode: "merge-json", value: signWrite(overlayPatch.runtime || {}, "merge") },
    { path: files.canon, mode: "merge-json", value: signWrite(overlayPatch.canon || {}, "merge") },
    { path: files.characters, mode: "merge-json", value: signWrite(overlayPatch.characters || {}, "merge") },
    { path: files.worldbook, mode: "merge-json", value: signWrite(overlayPatch.worldbook || {}, "merge") },
    { path: files.memory, mode: "append-json-array", value: overlayPatch.memory || [] },
    { path: files.sceneChain, mode: "merge-json", value: signWrite({ prediction: overlayPatch.prediction || {}, updatedAt: overlayPatch.createdAt }, "merge") },
    { path: files.patchLog, mode: "append-jsonl", value: overlayPatch },
    { path: files.auditLog, mode: "append-jsonl", value: { audit: overlayPatch.audit, ruleCheck: overlayPatch.ruleCheck, at: new Date().toISOString() } }
  ];
}

// ---- 三级写入权限 ----
export const WRITE_LEVELS = {
  AUTO: { level: "auto", confirmRequired: false, label: "自动执行" },
  CONFIRM: { level: "confirm", confirmRequired: true, label: "弹框确认" },
  MANUAL_ONLY: { level: "manual", confirmRequired: false, label: "仅导出补丁" }
};

export function classifyWriteLevel(operation = {}) {
  const path = operation.path || "";
  const mode = operation.mode || "merge-json";
  // AUTO: overlay 下的日志/记忆/临时文件
  if (path.includes("patch-log") || path.includes("audit-log") || path.includes("command-log")) return WRITE_LEVELS.AUTO;
  if (path.includes("memory-store")) return WRITE_LEVELS.AUTO;
  // CONFIRM: 角色/世界书/场景链的 overlay 写入
  if (path.includes("characters-overlay") || path.includes("worldbook-overlay") || path.includes("scene-chain")) return WRITE_LEVELS.CONFIRM;
  // MANUAL_ONLY: 任何非 overlay 路径或 _engine/ 路径
  if (!path.includes(OVERLAY_ROOT)) return WRITE_LEVELS.MANUAL_ONLY;
  if (path.includes("_engine/") || path.includes("_engine\\")) return WRITE_LEVELS.MANUAL_ONLY;
  // 默认：auto 级别（runtime/canon overlay）
  return WRITE_LEVELS.AUTO;
}

// ═══════════════════════════════════════════════════════════════
//  v0.8.0 采纳机制 — 待确认队列
//  CONFIRM 级别的写入暂存在 pending 队列中，用户确认后才落盘。
//  3 轮后自动清理未被采纳的条目。
// ═══════════════════════════════════════════════════════════════

// 内存中的待确认队列（每个 moduleKey 独立）
const PENDING_QUEUES = new Map();
const MAX_PENDING_AGE = 3; // 3 轮后自动清理

/** 生成人类可读的变更摘要 */
function summarizePendingChange(op) {
  const path = op.path || "";
  if (path.includes("characters-overlay")) return "角色数据变更";
  if (path.includes("worldbook-overlay")) return "世界书条目变更";
  if (path.includes("scene-chain")) return "场景链更新";
  if (path.includes("runtime-overlay")) return "运行时状态更新";
  if (path.includes("canon-overlay")) return "正史记录更新";
  return "数据变更";
}

/**
 * 添加一条待确认的写入操作
 */
export function addToPending(moduleKey, operation, options = {}) {
  if (!PENDING_QUEUES.has(moduleKey)) PENDING_QUEUES.set(moduleKey, []);
  const queue = PENDING_QUEUES.get(moduleKey);
  const createdRound = Number.isFinite(Number(options.round)) ? Number(options.round) : 0;
  const entry = {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    age: 0,
    createdRound,
    expiresAtRound: createdRound + MAX_PENDING_AGE,
    path: operation.path,
    mode: operation.mode,
    value: operation.value,
    summary: summarizePendingChange(operation)
  };
  queue.push(entry);
  return entry;
}

/**
 * 列出所有待确认项（同时增加 age 并清理过期项）
 */
export function listPending(moduleKey) {
  return [...(PENDING_QUEUES.get(moduleKey) || [])];
}

export function tickPending(moduleKey, currentRound = 0) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const round = Number.isFinite(Number(currentRound)) ? Number(currentRound) : 0;
  for (const item of queue) {
    item.age = Math.max(0, round - (Number(item.createdRound) || 0));
  }
  const next = queue.filter((item) => item.age <= MAX_PENDING_AGE);
  PENDING_QUEUES.set(moduleKey, next);
  return [...next];
}

/**
 * 采纳一条待确认项（返回被采纳的操作，供调用方实际写入）
 */
export function adoptPending(moduleKey, pendingId) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const idx = queue.findIndex((item) => item.id === pendingId);
  if (idx === -1) return null;
  const [adopted] = queue.splice(idx, 1);
  PENDING_QUEUES.set(moduleKey, queue);
  return adopted;
}

/**
 * 拒绝一条待确认项
 */
export function rejectPending(moduleKey, pendingId) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const idx = queue.findIndex((item) => item.id === pendingId);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  PENDING_QUEUES.set(moduleKey, queue);
  return true;
}

/**
 * 将一轮的写入操作分为「自动执行」和「待确认」两组
 */
export function splitWriteSet(writeSet = []) {
  const auto = [];
  const pending = [];
  const manual = [];
  for (const op of writeSet) {
    const level = classifyWriteLevel(op);
    if (level.level === "auto") auto.push(op);
    else if (level.level === "confirm") pending.push(op);
    else manual.push(op);
    // manual 级别直接丢弃
  }
  return { auto, pending, manual };
}

export function resetPendingStore(moduleKey = null) {
  if (moduleKey) PENDING_QUEUES.delete(moduleKey);
  else PENDING_QUEUES.clear();
}
