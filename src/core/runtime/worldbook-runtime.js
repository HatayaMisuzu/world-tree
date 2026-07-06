import { normalizeWorldbookEntries, worldbookEntriesFromModel } from "../cards.js";
import { buildVectorIndex, matchEntries } from "../data/worldbook.js";
import { budgetFor, estimateContextChars } from "../engine/context-budget.js";

export function prepareWorldbookInjection({
  model = null,
  worldbook = null,
  input = "",
  engineState = {},
  messages = [],
  limit = null,
  mode = "both",
  vectorThreshold = null
} = {}) {
  const budgetName = engineState?.contextBudget || "balanced";
  const budget = budgetFor(budgetName);
  const entryLimit = Number(limit || budget.worldbookEntries || 10);
  const maxChars = Number(budget.worldbookChars || Infinity);
  const entries = model
    ? worldbookEntriesFromModel(model, {})
    : normalizeWorldbookEntries(worldbook?.entries || worldbook || []);
  const historyRounds = Number(budget.historyTurns || 20);
  const scanMessages = normalizeMessages(messages).slice(-(historyRounds * 2));
  const vectors = buildVectorIndex(entries);
  const candidateLimit = Math.max(entryLimit * 4, entries.length, 20);
  const candidates = matchEntries({ entries }, input || "", {
    limit: candidateLimit,
    mode,
    scanMessages,
    sceneName: engineState?.sceneName || "",
    previousScene: engineState?.previousSceneName || engineState?.previousScene || "",
    vectors,
    queryVector: engineState?.queryVector || null,
    vectorThreshold: vectorThreshold ?? engineState?.vectorThreshold ?? 0.5
  }).map((entry) => enrichEntry(entry));

  const selected = [];
  const droppedByBudget = [];
  let usedChars = 0;
  for (const entry of candidates) {
    const cost = estimateEntryChars(entry);
    if (selected.length >= entryLimit) {
      droppedByBudget.push({ ...summarizeEntry(entry), cost, dropReason: "budget:entry-limit" });
      continue;
    }
    if (Number.isFinite(maxChars) && usedChars + cost > maxChars && selected.length > 0) {
      droppedByBudget.push({ ...summarizeEntry(entry), cost, dropReason: "budget:chars" });
      continue;
    }
    selected.push({ ...entry, budgetCost: cost, budgetUsedBefore: usedChars });
    usedChars += cost;
  }

  const candidateIds = new Set(candidates.map((entry) => entry.id));
  const misses = entries
    .filter((entry) => entry.enabled !== false && !candidateIds.has(entry.id))
    .slice(0, 24)
    .map((entry) => ({
      ...summarizeEntry(entry),
      missReason: explainMiss(entry, input, { scanMessages, engineState })
    }));

  return {
    injectedWorldbook: selected,
    diagnostics: {
      budgetName,
      budget: {
        worldbookEntries: entryLimit,
        worldbookChars: maxChars,
        historyTurns: historyRounds,
        historyMessages: scanMessages.length,
        usedChars
      },
      input: String(input || ""),
      activeEntryCount: entries.filter((entry) => entry.enabled !== false).length,
      candidateCount: candidates.length,
      selected: selected.map((entry) => ({ ...summarizeEntry(entry), budgetCost: entry.budgetCost })),
      droppedByBudget,
      misses,
      scanMessages: scanMessages.length
    }
  };
}

export function estimateEntryChars(entry = {}) {
  return estimateContextChars(`${entry.title || ""}\n${entry.keys || ""}\n${entry.content || ""}`);
}

function normalizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => typeof message === "string" ? message : message?.content)
    .filter(Boolean)
    .map(String);
}

function enrichEntry(entry = {}) {
  const reason = entry.reason || reasonFromMatch(entry);
  return { ...entry, reason };
}

function reasonFromMatch(entry = {}) {
  if (entry.matchType === "persistent") return "persistent";
  if (entry.matchType === "exact") return `exact:${(entry.matchedKeys || entry.keys || []).join(",")}`;
  if (entry.matchType === "semantic") return `semantic:${Number(entry.semanticScore || 0).toFixed(2)}`;
  if (entry.matchType === "vector") return `vector:${Number(entry.vectorScore || 0).toFixed(2)}`;
  if (entry.matchType === "scene") return "sceneChanged";
  return entry.matchType || "matched";
}

function summarizeEntry(entry = {}) {
  return {
    id: entry.id || "",
    title: entry.title || entry.name || entry.keys?.[0] || "Untitled",
    keys: entry.keys || [],
    layer: entry.layer || "context",
    priority: entry.priority ?? 100,
    matchType: entry.matchType || "",
    reason: entry.reason || reasonFromMatch(entry),
    matchedKeys: entry.matchedKeys || [],
    semanticScore: entry.semanticScore,
    vectorScore: entry.vectorScore
  };
}

function explainMiss(entry = {}, input = "", { scanMessages = [], engineState = {} } = {}) {
  if (entry.enabled === false || entry.mode === "disable") return "disabled";
  const keys = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
  if (!keys.length && entry.mode !== "persistent") return "no-keys";
  const query = String(input || "").toLowerCase();
  const exact = keys.filter((key) => query.includes(String(key).toLowerCase()));
  if (!exact.length) return "no-trigger";
  const depth = entry.depth || entry.scanDepth || "mid";
  if (!["global", "全局"].includes(depth) && scanMessages.length) {
    const recent = scanMessages.join(" ").toLowerCase();
    if (!keys.some((key) => recent.includes(String(key).toLowerCase()))) return `scanDepth:${depth}`;
  }
  if (engineState?.sceneName && entry.triggerType === "scene") return "scene-not-changed";
  return "filtered";
}
