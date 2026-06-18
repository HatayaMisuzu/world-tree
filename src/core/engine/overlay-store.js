export const OVERLAY_ROOT = "runtime/overlay";
export const ENGINE_VERSION = "world-tree-v0.2.1";

export const OVERLAY_FILES = Object.freeze({
  RUNTIME: "runtime-overlay.json",
  CANON: "canon-overlay.json",
  CHARACTERS: "characters-overlay.json",
  WORLDBOOK: "worldbook-overlay.json",
  SCENE_CHAIN: "scene-chain.json",
  MEMORY: "memory-store.json",
  COMMAND_LOG: "command-log.jsonl",
  PATCH_LOG: "patch-log.jsonl",
  AUDIT_LOG: "audit-log.jsonl",
  PENDING: "pending.jsonl",
  MANUAL: "manual.jsonl"
});

export const WRITE_POLICY = Object.freeze({
  AUTO: { level: "auto", confirmRequired: false, label: "auto" },
  CONFIRM: { level: "confirm", confirmRequired: true, label: "confirm" },
  MANUAL_ONLY: { level: "manual", confirmRequired: false, label: "manual_only" }
});

export const WRITE_LEVELS = WRITE_POLICY;

const PENDING_QUEUES = new Map();
const MAX_PENDING_AGE = 3;

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

export function moduleOverlayPath() {
  return OVERLAY_ROOT;
}

export function archiveOverlayPath() {
  return `${OVERLAY_ROOT}/archives`;
}

export function auditRootPath() {
  return OVERLAY_ROOT;
}

export function overlayFiles() {
  const root = OVERLAY_ROOT;
  return {
    root,
    runtime: `${root}/${OVERLAY_FILES.RUNTIME}`,
    canon: `${root}/${OVERLAY_FILES.CANON}`,
    characters: `${root}/${OVERLAY_FILES.CHARACTERS}`,
    worldbook: `${root}/${OVERLAY_FILES.WORLDBOOK}`,
    sceneChain: `${root}/${OVERLAY_FILES.SCENE_CHAIN}`,
    memory: `${root}/${OVERLAY_FILES.MEMORY}`,
    commandLog: `${root}/${OVERLAY_FILES.COMMAND_LOG}`,
    patchLog: `${root}/${OVERLAY_FILES.PATCH_LOG}`,
    auditLog: `${root}/${OVERLAY_FILES.AUDIT_LOG}`,
    pending: `${root}/${OVERLAY_FILES.PENDING}`,
    manual: `${root}/${OVERLAY_FILES.MANUAL}`,
    backups: `${root}/backups`
  };
}

function operation(file, op, payload, policy) {
  return {
    file,
    path: `${OVERLAY_ROOT}/${file}`,
    op,
    mode: op,
    payload,
    value: payload,
    policy: policy.level,
    writePolicy: policy.level
  };
}

export function buildOverlayWriteSet(moduleKey, overlayPatch, dataMode = "worldbook") {
  void moduleKey;
  void dataMode;
  const patch = overlayPatch || {};
  return [
    operation(OVERLAY_FILES.RUNTIME, "merge-json", signWrite(patch.runtime || patch._engineState || {}, "merge"), WRITE_POLICY.AUTO),
    operation(OVERLAY_FILES.CANON, "merge-json", signWrite(patch.canon || {}, "merge"), WRITE_POLICY.AUTO),
    operation(OVERLAY_FILES.CHARACTERS, "merge-json", signWrite(patch.characters || {}, "merge"), WRITE_POLICY.CONFIRM),
    operation(OVERLAY_FILES.WORLDBOOK, "merge-json", signWrite(patch.worldbook || {}, "merge"), WRITE_POLICY.CONFIRM),
    operation(OVERLAY_FILES.MEMORY, "append-json-array", Array.isArray(patch.memory) ? patch.memory : (patch.memory ? [patch.memory] : []), WRITE_POLICY.AUTO),
    operation(OVERLAY_FILES.SCENE_CHAIN, "merge-json", signWrite({ prediction: patch.prediction || {}, updatedAt: patch.createdAt }, "merge"), WRITE_POLICY.CONFIRM),
    operation(OVERLAY_FILES.PATCH_LOG, "append-jsonl", patch, WRITE_POLICY.AUTO),
    operation(OVERLAY_FILES.AUDIT_LOG, "append-jsonl", { audit: patch.audit, ruleCheck: patch.ruleCheck, at: new Date().toISOString() }, WRITE_POLICY.AUTO)
  ];
}

function fileFromOperation(operation = {}) {
  if (operation.file) return String(operation.file);
  const path = String(operation.path || "").replaceAll("\\", "/");
  return path.split("/").pop() || "";
}

export function classifyWriteLevel(operation = {}) {
  const file = fileFromOperation(operation);
  const explicit = operation.policy || operation.writePolicy || operation.level;
  if (explicit === WRITE_POLICY.AUTO.level) return WRITE_POLICY.AUTO;
  if (explicit === WRITE_POLICY.CONFIRM.level) return WRITE_POLICY.CONFIRM;
  if (explicit === WRITE_POLICY.MANUAL_ONLY.level || explicit === "manual_only") return WRITE_POLICY.MANUAL_ONLY;

  if ([OVERLAY_FILES.PATCH_LOG, OVERLAY_FILES.AUDIT_LOG, OVERLAY_FILES.COMMAND_LOG, OVERLAY_FILES.MEMORY, OVERLAY_FILES.RUNTIME, OVERLAY_FILES.CANON].includes(file)) {
    return WRITE_POLICY.AUTO;
  }
  if ([OVERLAY_FILES.CHARACTERS, OVERLAY_FILES.WORLDBOOK, OVERLAY_FILES.SCENE_CHAIN].includes(file)) {
    return WRITE_POLICY.CONFIRM;
  }
  return WRITE_POLICY.MANUAL_ONLY;
}

function summarizePendingChange(op) {
  const file = fileFromOperation(op);
  if (file === OVERLAY_FILES.CHARACTERS) return "character overlay change";
  if (file === OVERLAY_FILES.WORLDBOOK) return "worldbook overlay change";
  if (file === OVERLAY_FILES.SCENE_CHAIN) return "scene-chain overlay change";
  if (file === OVERLAY_FILES.RUNTIME) return "runtime overlay change";
  if (file === OVERLAY_FILES.CANON) return "canon overlay change";
  return "overlay change";
}

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
    file: fileFromOperation(operation),
    path: operation.path || `${OVERLAY_ROOT}/${fileFromOperation(operation)}`,
    mode: operation.mode || operation.op,
    op: operation.op || operation.mode,
    value: operation.value ?? operation.payload,
    payload: operation.payload ?? operation.value,
    policy: classifyWriteLevel(operation).level,
    summary: summarizePendingChange(operation)
  };
  queue.push(entry);
  return entry;
}

export function listPending(moduleKey) {
  return [...(PENDING_QUEUES.get(moduleKey) || [])];
}

export function tickPending(moduleKey, currentRound = 0) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const round = Number.isFinite(Number(currentRound)) ? Number(currentRound) : 0;
  for (const item of queue) item.age = Math.max(0, round - (Number(item.createdRound) || 0));
  const next = queue.filter((item) => item.age <= MAX_PENDING_AGE);
  PENDING_QUEUES.set(moduleKey, next);
  return [...next];
}

export function adoptPending(moduleKey, pendingId) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const idx = queue.findIndex((item) => item.id === pendingId);
  if (idx === -1) return null;
  const [adopted] = queue.splice(idx, 1);
  PENDING_QUEUES.set(moduleKey, queue);
  return adopted;
}

export function rejectPending(moduleKey, pendingId) {
  const queue = PENDING_QUEUES.get(moduleKey) || [];
  const idx = queue.findIndex((item) => item.id === pendingId);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  PENDING_QUEUES.set(moduleKey, queue);
  return true;
}

export function splitWriteSet(writeSet = []) {
  const auto = [];
  const pending = [];
  const manual = [];
  for (const op of writeSet) {
    const level = classifyWriteLevel(op);
    if (level.level === WRITE_POLICY.AUTO.level) auto.push(op);
    else if (level.level === WRITE_POLICY.CONFIRM.level) pending.push(op);
    else manual.push(op);
  }
  return { auto, pending, manual };
}

export function resetPendingStore(moduleKey = null) {
  if (moduleKey) PENDING_QUEUES.delete(moduleKey);
  else PENDING_QUEUES.clear();
}
