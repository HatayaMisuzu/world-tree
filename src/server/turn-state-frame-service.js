import { createHash, randomUUID } from "node:crypto";

const SECRET_KEY_RE = /api.?key|secret|token|authorization|cookie|password/i;
const RUNTIME_ONLY_KEY_RE = /debug|proposal|session|^(?:_?raw|metadata)$/i;
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
    if (category === "inventory") {
      const source = Array.isArray(values.items) ? values.items : Object.entries(values).map(([name, value]) => (
        value && typeof value === "object" ? { name, ...value } : { name, count: value }
      ));
      if (source.length) cards.push({ type: "inventory_grid", id: "state-inventory", title: "背包", items: source.map((item, index) => ({
        id: item.id || `inventory-${index}`, name: item.name || item.label || `物品 ${index + 1}`,
        count: Number.isFinite(Number(item.count ?? item.quantity)) ? Number(item.count ?? item.quantity) : 1,
        tag: item.tag || item.category || ""
      })) });
      continue;
    }
    const scalar = scalarEntries(values).slice(0, 24);
    for (const [path, value] of scalar.filter(([, value]) => typeof value === "number").slice(0, 12)) {
      const change = changes.find(item => item.target === `${category}.${path}`);
      cards.push({ type: "stat_bar", id: `state-${category}-${path}`, title: labelFor(path), value,
        min: Number.isFinite(Number(change?.min)) ? Number(change.min) : Math.min(0, value),
        max: Number.isFinite(Number(change?.max)) ? Number(change.max) : Math.max(100, value),
        ...(change?.delta !== undefined ? { delta: change.delta } : {}), label: category });
    }
    const items = scalar.filter(([, value]) => typeof value !== "number").slice(0, 12).map(([path, value]) => {
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

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target = {}, source = {}) {
  const output = isRecord(target) ? { ...target } : {};
  if (!isRecord(source)) return output;
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(output[key])) output[key] = deepMerge(output[key], value);
    else output[key] = value;
  }
  return output;
}

function mergeCategories(state, source = {}) {
  const safe = scrubStateValue(source || {});
  if (!isRecord(safe)) return state;
  const aliases = {
    characterState: "characters", characters: "characters",
    worldState: "world", world: "world", runtime: "world",
    inventory: "inventory", quests: "quests", mechanisms: "mechanisms"
  };
  let categorized = false;
  for (const [sourceKey, targetKey] of Object.entries(aliases)) {
    if (!isRecord(safe[sourceKey])) continue;
    state[targetKey] = deepMerge(state[targetKey], safe[sourceKey]);
    categorized = true;
  }
  if (!categorized) state.world = deepMerge(state.world, safe);
  return state;
}

function mergeParsedSections(state, parsedSections = {}) {
  if (!isRecord(parsedSections)) return state;
  const sectionMap = { "角色": "characters", "角色状态": "characters", "世界": "world", "背包": "inventory", "物品": "inventory", "任务": "quests", "机制": "mechanisms" };
  for (const [name, value] of Object.entries(parsedSections)) {
    if (!isRecord(value)) continue;
    if (name === "状态建议") {
      if (value.confirmed !== true && value.applied !== true) continue;
      const confirmedValue = { ...value };
      delete confirmedValue.confirmed;
      delete confirmedValue.applied;
      delete confirmedValue.reason;
      delete confirmedValue.confirmedState;
      mergeCategories(state, value.confirmedState || confirmedValue);
    } else if (name === "状态") mergeCategories(state, value);
    else if (sectionMap[name]) state[sectionMap[name]] = deepMerge(state[sectionMap[name]], value);
    else if (isRecord(value.confirmedState)) mergeCategories(state, value.confirmedState);
  }
  return state;
}

function applyMechanismChanges(state, changes = []) {
  for (const change of Array.isArray(changes) ? changes : []) {
    if (!change || change.applied !== true || typeof change.target !== "string") continue;
    const parts = change.target.split(".").filter(Boolean);
    if (!parts.length) continue;
    const category = ["characters", "world", "inventory", "quests", "mechanisms"].includes(parts[0]) ? parts.shift() : "mechanisms";
    let cursor = state[category];
    while (parts.length > 1) {
      const key = parts.shift();
      cursor[key] = isRecord(cursor[key]) ? cursor[key] : {};
      cursor = cursor[key];
    }
    if (parts.length) cursor[parts[0]] = scrubStateValue(change.after ?? change.value);
  }
  return state;
}

export function buildConfirmedAfterState({ previousState = {}, engineState = {}, parsedSections = {}, overlayPatch = {}, mechanismCache = {}, appliedMechanismChanges = [] } = {}) {
  const state = deepMerge(emptyConfirmedState(), scrubStateValue(previousState || {}));
  mergeCategories(state, engineState);
  mergeParsedSections(state, parsedSections);
  const overlay = scrubStateValue(overlayPatch || {});
  if (isRecord(overlay)) {
    mergeCategories(state, overlay.runtime || {});
    if (isRecord(overlay.characters)) state.characters = deepMerge(state.characters, overlay.characters);
    if (isRecord(overlay.world)) state.world = deepMerge(state.world, overlay.world);
    if (isRecord(overlay.worldState)) state.world = deepMerge(state.world, overlay.worldState);
    if (isRecord(overlay.inventory)) state.inventory = deepMerge(state.inventory, overlay.inventory);
    if (isRecord(overlay.quests)) state.quests = deepMerge(state.quests, overlay.quests);
    if (isRecord(overlay.mechanisms)) state.mechanisms = deepMerge(state.mechanisms, overlay.mechanisms);
  }
  state.mechanisms = deepMerge(state.mechanisms, mechanismCache.confirmedState || {});
  applyMechanismChanges(state, appliedMechanismChanges);
  return scrubStateValue(state) || emptyConfirmedState();
}

export function buildConfirmedState({ engineState = {}, mechanismCache = {} } = {}) {
  return buildConfirmedAfterState({ engineState, mechanismCache });
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
