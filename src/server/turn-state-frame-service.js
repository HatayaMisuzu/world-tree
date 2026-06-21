import { createHash, randomUUID } from "node:crypto";

const SECRET_KEY_RE = /api.?key|secret|token|authorization|cookie|password/i;
const RUNTIME_ONLY_KEY_RE = /debug|proposal|session/i;
const EXECUTABLE_KEY_RE = /^(?:raw)?(?:html|css|js|javascript|script|style)$/i;
const ALLOWED_CARD_TYPES = new Set(["stat_bar", "inventory_grid", "status_list"]);

function scrubText(value, max = 4000) {
  return String(value ?? "")
    .replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:\\[^\s<>:"|?*]+|\/(?:Users|home|var|tmp)\/[^\s]+/g, "[LOCAL_PATH]")
    .replace(/<\/?(?:script|style)[^>]*>/gi, "")
    .slice(0, max);
}

export function scrubStateValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") return scrubText(value, 12000);
  if (Array.isArray(value)) return value.slice(0, 200).map(item => scrubStateValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 200)) {
    if (SECRET_KEY_RE.test(key) || RUNTIME_ONLY_KEY_RE.test(key) || EXECUTABLE_KEY_RE.test(key)) continue;
    output[key] = scrubStateValue(item, depth + 1);
  }
  return output;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function scalarEntries(value, prefix = "", output = [], depth = 0) {
  if (depth > 5 || output.length >= 100) return output;
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    if (prefix) output.push([prefix, value]);
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0, 30).forEach((item, index) => scalarEntries(item, `${prefix}[${index}]`, output, depth + 1));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value).slice(0, 60).forEach(([key, item]) => scalarEntries(item, prefix ? `${prefix}.${key}` : key, output, depth + 1));
  }
  return output;
}

function labelFor(path) {
  return path.split(".").pop()?.replace(/\[\d+\]/g, "") || path;
}

export function diffConfirmedState(beforeState = {}, afterState = {}, { sourceMessageId = "" } = {}) {
  const before = new Map(scalarEntries(beforeState));
  const after = new Map(scalarEntries(afterState));
  const changes = [];
  for (const [target, next] of after) {
    const previous = before.get(target);
    if (Object.is(previous, next)) continue;
    const [categoryRaw] = target.split(".");
    const category = ["characters", "world", "inventory", "quests", "mechanisms"].includes(categoryRaw) ? ({ characters: "character", quests: "quest" }[categoryRaw] || categoryRaw) : "world";
    const numeric = typeof previous === "number" && typeof next === "number";
    const delta = numeric ? next - previous : undefined;
    changes.push(scrubStateValue({
      id: randomUUID(),
      type: previous === undefined ? "new" : numeric ? (delta > 0 ? "increase" : delta < 0 ? "decrease" : "set") : "changed",
      category, target, label: labelFor(target), before: previous ?? null, after: next,
      ...(numeric ? { delta } : {}), reason: "已确认运行状态发生变化。", confidence: 1,
      ...(sourceMessageId ? { sourceMessageId } : {}), applied: true
    }));
  }
  return changes.slice(0, 100);
}

export function sanitizeVisualPacket(packet = {}) {
  const cards = [];
  for (const raw of Array.isArray(packet.cards) ? packet.cards.slice(0, 40) : []) {
    if (!raw || !ALLOWED_CARD_TYPES.has(raw.type)) continue;
    if (Object.keys(raw).some(key => /html|css|script|javascript/i.test(key))) continue;
    if (raw.type === "stat_bar") {
      const min = Number.isFinite(Number(raw.min)) ? Number(raw.min) : 0;
      const max = Number.isFinite(Number(raw.max)) ? Number(raw.max) : 100;
      const value = Number.isFinite(Number(raw.value)) ? Math.max(min, Math.min(max, Number(raw.value))) : min;
      cards.push(scrubStateValue({ type: raw.type, id: raw.id || randomUUID(), title: raw.title || "状态", value, min, max, ...(Number.isFinite(Number(raw.delta)) ? { delta: Number(raw.delta) } : {}), label: raw.label || "", hint: raw.hint || "" }));
    }
    if (raw.type === "inventory_grid") {
      cards.push(scrubStateValue({ type: raw.type, id: raw.id || randomUUID(), title: raw.title || "背包", items: (Array.isArray(raw.items) ? raw.items : []).slice(0, 60).map((item, index) => ({ id: item.id || `item-${index}`, name: item.name || "物品", count: Number.isFinite(Number(item.count)) ? Number(item.count) : 0, ...(Number.isFinite(Number(item.delta)) ? { delta: Number(item.delta) } : {}), tag: item.tag || "" })) }));
    }
    if (raw.type === "status_list") {
      cards.push(scrubStateValue({ type: raw.type, id: raw.id || randomUUID(), title: raw.title || "状态", items: (Array.isArray(raw.items) ? raw.items : []).slice(0, 60).map(item => ({ label: item.label || "状态", value: String(item.value ?? ""), ...(item.delta !== undefined ? { delta: String(item.delta) } : {}), ...(["new", "changed", "up", "down"].includes(item.status) ? { status: item.status } : {}) })) }));
    }
  }
  return { version: "visual-dsl.v1", mode: packet.mode === "detailed" ? "detailed" : "simple", cards };
}

function visualFromState(afterState = {}, changes = []) {
  const cards = [];
  for (const [category, values] of Object.entries(afterState)) {
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;
    const items = scalarEntries(values).slice(0, 12).map(([path, value]) => {
      const change = changes.find(item => item.target === `${category}.${path}`);
      return { label: labelFor(path), value: String(value ?? ""), ...(change?.delta !== undefined ? { delta: change.delta > 0 ? `+${change.delta}` : String(change.delta), status: change.delta > 0 ? "up" : "down" } : change ? { status: change.type === "new" ? "new" : "changed" } : {}) };
    });
    if (items.length) cards.push({ type: "status_list", id: `state-${category}`, title: ({ characters: "角色", world: "世界", inventory: "背包", quests: "任务", mechanisms: "机制" }[category] || category), items });
  }
  return sanitizeVisualPacket({ version: "visual-dsl.v1", mode: "simple", cards });
}

export function emptyConfirmedState() {
  return { characters: {}, world: {}, inventory: {}, quests: {}, mechanisms: {} };
}

export function buildConfirmedState({ engineState = {}, mechanismCache = {} } = {}) {
  const state = scrubStateValue(engineState || {});
  return {
    characters: scrubStateValue(state.characterState || state.characters || {}),
    world: scrubStateValue(state.worldState || state.world || {}),
    inventory: scrubStateValue(state.inventory || {}),
    quests: scrubStateValue(state.quests || {}),
    mechanisms: scrubStateValue({ ...(state.mechanisms || {}), ...(mechanismCache.confirmedState || {}) })
  };
}

export function createTurnStateFrame({ turnId, round, userMessageId, assistantMessageId, moduleKey, saveId = "main", beforeState = null, afterState = null, engineState = {}, mechanismCache = {}, worldbookHash = "", createdAt = new Date().toISOString() } = {}) {
  const safeAfter = scrubStateValue(afterState || buildConfirmedState({ engineState, mechanismCache })) || emptyConfirmedState();
  for (const key of Object.keys(emptyConfirmedState())) if (!safeAfter[key] || typeof safeAfter[key] !== "object") safeAfter[key] = {};
  const safeBefore = scrubStateValue(beforeState || emptyConfirmedState());
  const changes = diffConfirmedState(safeBefore, safeAfter, { sourceMessageId: assistantMessageId });
  return scrubStateValue({
    id: randomUUID(), turnId, round, userMessageId, assistantMessageId, moduleKey, saveId,
    ...(worldbookHash ? { worldbookHash } : {}), createdAt,
    beforeStateHash: hash(safeBefore), afterStateHash: hash(safeAfter), afterState: safeAfter,
    changes, visual: visualFromState(safeAfter, changes)
  });
}
