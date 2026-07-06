import { normalizeWorldbookEntries } from "../cards.js";

// --------------- M2 触发式条目系统 ---------------
// 完整实现 v12.19 世界书匹配引擎
// 支持三种匹配模式：精确（exact）/ 语义（semantic）/ 向量化（vector）

// ---- 向量化匹配辅助函数 ----
// 基于词频余弦近似实现，无需外部依赖。完整向量嵌入需要外部库时由调用方传入 vectors。

/** 将文本转为词频对象 { token: count } */
function tokenFreq(text) {
  const tf = {};
  for (const t of vectorTokens(text)) {
    tf[t] = (tf[t] || 0) + 1;
  }
  return tf;
}

function vectorTokens(text) {
  const normalized = String(text || "").toLowerCase();
  const latinTokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !/[\u4e00-\u9fff]/u.test(w));
  const cjkTokens = [];
  for (const segment of normalized.match(/[\u4e00-\u9fff]+/gu) || []) {
    if (segment.length === 1) cjkTokens.push(segment);
    for (let i = 0; i < segment.length - 1; i++) cjkTokens.push(segment.slice(i, i + 2));
  }
  return [...latinTokens, ...cjkTokens];
}

/** 稀疏向量余弦相似度 */
function cosineSparse(a, b) {
  const keys = Object.keys(a).length < Object.keys(b).length ? Object.keys(a) : Object.keys(b);
  let dot = 0;
  for (const k of keys) dot += (a[k] || 0) * (b[k] || 0);
  const norm = (x) => Math.sqrt(Object.values(x).reduce((s, v) => s + v * v, 0));
  const n = norm(a) * norm(b);
  return n ? dot / n : 0;
}

function _vectorMatch(entry, query, vectors, queryVector = null) {
  if (!vectors || !vectors[entry.id]) return 0;
  const entryVec = vectors[entry.id];
  if (!entryVec) return 0;
  // 外部传入的数组 embedding（扩展入口）
  if (Array.isArray(entryVec)) {
    const queryVec = Array.isArray(queryVector) ? queryVector : vectors.__query;
    if (!Array.isArray(queryVec) || queryVec.length !== entryVec.length) return 0;
    const dot = queryVec.reduce((sum, v, i) => sum + v * (entryVec[i] || 0), 0);
    const normQ = Math.sqrt(queryVec.reduce((s, v) => s + v * v, 0));
    const normE = Math.sqrt(entryVec.reduce((s, v) => s + v * v, 0));
    if (normQ === 0 || normE === 0) return 0;
    return dot / (normQ * normE);
  }
  // 词频对象（buildVectorIndex 的输出格式）
  const queryFreq = tokenFreq(query);
  return cosineSparse(queryFreq, entryVec);
}

// ---- 向量索引构建 ----
export function buildVectorIndex(entries = [], contentField = "content") {
  const vectors = {};
  for (const entry of entries) {
    const key = entry.id || entry.keys?.[0] || `entry-${Math.random().toString(36).slice(2, 8)}`;
    vectors[key] = tokenFreq(`${entry.title || ""} ${entry.keys || ""} ${entry[contentField] || ""}`);
  }
  return vectors;
}

// ---- 向量重建/统计 ----
export function vectorStats(entries = []) {
  const active = entries.filter((e) => e.enabled !== false && e.mode !== "disable");
  const withVectors = active.filter((e) => e.matchMode === "vector" || e.matchMode === "向量化");
  return {
    total: active.length,
    vectorEnabled: withVectors.length,
    buildRequired: withVectors.length > 0,
    topN: options => ({ default: options?.default || 5 })
  };
}

export function matchEntries(worldbook, input = "", options = {}) {
  const mode = options.mode || "both";
  const limit = options.limit || 10;
  const scanMessages = options.scanMessages || [];
  const sceneName = options.sceneName || "";
  const previousSceneName = options.previousScene || "";
  const sceneChanged = sceneName && previousSceneName && sceneName !== previousSceneName;
  const entries = normalizeWorldbookEntries(worldbook?.entries || worldbook || [])
    .filter((entry) => entry.enabled && entry.mode !== "disable")
    .map((entry) => ({ ...entry, inject: false, matchType: "", reason: "", matchedKeys: [], hitCount: 0 }));

  for (const entry of entries) {
    if (entry.mode === "persistent" || entry.mode === "常驻") {
      entry.inject = true;
      entry.matchType = "persistent";
      entry.reason = "persistent";
      continue;
    }
    applyEntryMatch(entry, buildWorldbookScanTextForEntry(entry, input, scanMessages), mode, options);
  }

  for (const entry of entries) {
    if (entry.inject) continue;
    if (sceneChanged && (entry.triggerType === "场景变化" || entry.triggerType === "scene" || entry.triggerType === "both" || entry.triggerType === "两者")) {
      const sceneKeywords = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
      const sceneHit = sceneKeywords.some((key) => sceneName.toLowerCase().includes(String(key).toLowerCase()));
      if (sceneHit) { entry.inject = true; entry.matchType = "scene"; entry.reason = "sceneChanged"; }
    }
  }

  const initialInjected = entries.filter((entry) => entry.inject);
  if (options.recursiveDepth !== 0 && initialInjected.length) {
    const recursiveText = initialInjected.map((entry) => `${entry.title || ""}\n${entry.content || ""}`).join("\n");
    for (const entry of entries) {
      if (entry.inject || entry.mode === "persistent" || entry.mode === "常驻") continue;
      if (applyEntryMatch(entry, recursiveText, mode, options)) {
        entry.matchType = `recursive:${entry.matchType || "exact"}`;
        entry.reason = `recursive:${entry.reason || "matched"}`;
      }
    }
  }

  for (const entry of entries) {
    if (!entry.inject || entry.matchType === "persistent") continue;
    const prob = entry.probability ?? entry.triggerProb ?? 100;
    if (prob >= 100) continue;
    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll > prob) { entry.inject = false; entry.dropReason = `probability:${prob}`; }
  }

  return entries
    .filter((entry) => entry.inject)
    .sort(compareWorldbookEntries)
    .slice(0, limit);
}

// ---- 内部辅助 ----
function buildWorldbookScanText(input = "", messages = []) {
  return [input, ...(Array.isArray(messages) ? messages : [])].map((item) => String(item || "")).filter(Boolean).join("\n").toLowerCase();
}

function buildWorldbookScanTextForEntry(entry = {}, input = "", messages = []) {
  const depth = entry.depth || entry.scanDepth || "中距";
  const rangeMap = { "近距": 3, "中距": 5, "远程": 10, "全局": 999, "near": 3, "mid": 5, "far": 10, "global": 999 };
  const range = depth === "全局" || depth === "global" ? 999 : (rangeMap[depth] || 5);
  const history = Array.isArray(messages) ? messages.slice(-range) : [];
  return buildWorldbookScanText(input, history);
}

function applyEntryMatch(entry, scanText, mode, options = {}) {
  const keys = allEntryKeys(entry);
  if (!keys.length) return false;
  const matchLogic = entry.logic || entry.match || "any";
  const matched = keys.filter((key) => matchWorldbookKey(key, scanText));
  const exactHit = matchLogic === "all" || matchLogic === "全部"
    ? matched.length === keys.length
    : matched.length > 0;
  if (exactHit) {
    entry.inject = true;
    entry.matchType = "exact";
    entry.matchedKeys = matched;
    entry.hitCount = matched.length;
    entry.reason = `exact:${matched.join(",")}`;
    return true;
  }
  if (mode !== "exact" && _supportsSemantic(entry)) {
    const semantic = _semanticStats(entry, scanText);
    if (semantic.hit) {
      entry.inject = true;
      entry.matchType = "semantic";
      entry.semanticScore = semantic.score;
      entry.hitCount = semantic.hitCount || 1;
      entry.reason = `semantic:${semantic.score.toFixed(2)}`;
      return true;
    }
  }
  if (_supportsVector(mode, entry)) {
    const vs = _vectorMatch(entry, scanText, options.vectors, options.queryVector);
    if (vs > (options.vectorThreshold || 0.5)) {
      entry.inject = true;
      entry.matchType = "vector";
      entry.vectorScore = vs;
      entry.hitCount = Math.max(1, entry.hitCount || 0);
      entry.reason = `vector:${vs.toFixed(2)}`;
      return true;
    }
  }
  return false;
}

function allEntryKeys(entry = {}) {
  return [
    ...(Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean)),
    ...(Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : [entry.secondaryKeys].filter(Boolean)),
    ...(Array.isArray(entry.tags) ? entry.tags : [])
  ].map((key) => String(key || "").trim()).filter(Boolean);
}

function matchWorldbookKey(key = "", scanText = "") {
  const raw = String(key || "").trim();
  if (!raw) return false;
  const text = String(scanText || "");
  if (raw.startsWith("re:/")) {
    const last = raw.lastIndexOf("/");
    if (last > 3) {
      try { return new RegExp(raw.slice(4, last), raw.slice(last + 1) || "i").test(text); }
      catch { return false; }
    }
  }
  if (/^\/.*\/[a-z]*$/i.test(raw)) {
    const last = raw.lastIndexOf("/");
    try { return new RegExp(raw.slice(1, last), raw.slice(last + 1)).test(text); }
    catch { return false; }
  }
  if (raw.startsWith("w:")) {
    const word = escapeRegExp(raw.slice(2).toLowerCase());
    if (!word) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${word}($|[^\\p{L}\\p{N}_])`, "iu").test(text);
  }
  return text.includes(raw.toLowerCase());
}

function compareWorldbookEntries(a, b) {
  const layerOrder = { "base": 0, "基底": 0, "context": 1, "情境": 1, "instant": 2, "即时": 2 };
  const layerA = layerOrder[a.layer || "context"] ?? 1;
  const layerB = layerOrder[b.layer || "context"] ?? 1;
  if (layerA !== layerB) return layerA - layerB;
  if ((b.hitCount || 0) !== (a.hitCount || 0)) return (b.hitCount || 0) - (a.hitCount || 0);
  if ((b.priority ?? 100) !== (a.priority ?? 100)) return (b.priority ?? 100) - (a.priority ?? 100);
  return estimateEntryCost(a) - estimateEntryCost(b);
}

function estimateEntryCost(entry = {}) {
  return String(`${entry.title || ""}\n${entry.content || ""}`).length;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _supportsSemantic(entry) {
  return entry.matchMode === "semantic" || entry.matchMode === "语义" || entry.matchMode === "both" || entry.matchMode === "精确+语义" || entry.matchMode === "exact+semantic";
}

function _supportsVector(mode, entry) {
  return mode === "vector" || entry.matchMode === "vector" || entry.matchMode === "向量化";
}

function _semanticMatch(entry, query) {
  return _semanticStats(entry, query).hit;
}

function _semanticStats(entry, query) {
  // 中文2-gram分词 + 权重匹配
  const tokenize = (s) => {
    const cleaned = String(s || "").toLowerCase().replace(/[，。！？、：；\"\"''「」『』\s]/g, "");
    const tokens = [];
    // 中文2-gram
    for (let i = 0; i < cleaned.length - 1; i++) {
      const bigram = cleaned.slice(i, i + 2);
      if (/[\u4e00-\u9fff]/.test(bigram)) tokens.push(bigram);
    }
    // 英文单词
    const words = cleaned.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
    return [...tokens, ...words];
  };

  const contentTokens = tokenize(entry.content || "");
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return { hit: false, hitCount: 0, total: 0, score: 0 };

  const hitCount = queryTokens.filter((t) => contentTokens.some((ct) => ct === t || ct.includes(t))).length;
  // 至少命中2个token，或查询词只有一个时命中即可
  const hit = queryTokens.length >= 2 ? hitCount >= 2 : hitCount >= 1;
  return { hit, hitCount, total: queryTokens.length, score: hitCount / queryTokens.length };
}

export function proposeEntry({ keys = [], content = "", priority = 100, source = "llm" }) {
  return {
    id: `proposed-${Date.now()}`,
    keys,
    content,
    priority,
    source,
    status: "proposed",
    mode: "trigger",
    matchMode: "exact+semantic",
    allowExtension: false,
    createdAt: new Date().toISOString()
  };
}
