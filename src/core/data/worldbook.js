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
  const query = String(input || "").toLowerCase();
  const mode = options.mode || "both";
  const limit = options.limit || 10;
  const scanMessages = options.scanMessages || [];
  const sceneName = options.sceneName || "";
  const previousSceneName = options.previousScene || "";
  const sceneChanged = sceneName && previousSceneName && sceneName !== previousSceneName;

  return normalizeWorldbookEntries(worldbook?.entries || worldbook || [])
    .filter((entry) => entry.enabled && entry.mode !== "disable")
    // === 步骤1：常驻条目直接加入 ===
    .map((entry) => {
      if (entry.mode === "persistent" || entry.mode === "常驻") {
        entry.inject = true;
        entry.matchType = "persistent";
        entry.reason = "persistent";
        return entry;
      }
      entry.inject = false;
      entry.matchType = "";
      entry.reason = "";
      return entry;
    })
    .map((entry) => {
      if (entry.inject) return entry;

      const keys = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
      if (keys.length === 0) return entry;

      // === 步骤2：精确关键词匹配 ===
      const matchedExact = keys.filter((key) => {
        if (/^\/.*\/$/.test(key)) {
          try { const re = new RegExp(key.slice(1, -1)); return re.test(query); }
          catch { return false; }
        }
        return query.includes(String(key).toLowerCase());
      });

      const matchLogic = entry.logic || entry.match || "any";

      // AND 逻辑
      if (matchLogic === "all" || matchLogic === "全部") {
        const allHit = keys.every((key) => query.includes(String(key).toLowerCase()));
        if (!allHit) {
          // 语义回退
          if (mode !== "exact" && _supportsSemantic(entry)) {
            const semantic = _semanticStats(entry, query);
            if (semantic.hit) {
              entry.inject = true;
              entry.matchType = "semantic";
              entry.semanticScore = semantic.score;
              entry.reason = `semantic:${semantic.score.toFixed(2)}`;
            }
          }
          // 向量回退
          if (!entry.inject && _supportsVector(mode, entry)) {
            const vs = _vectorMatch(entry, query, options.vectors, options.queryVector);
            if (vs > (options.vectorThreshold || 0.5)) {
              entry.inject = true;
              entry.matchType = "vector";
              entry.vectorScore = vs;
              entry.reason = `vector:${vs.toFixed(2)}`;
            }
          }
          return entry;
        }
        entry.inject = true;
        entry.matchType = "exact";
        entry.matchedKeys = keys;
        entry.reason = `exact:${keys.join(",")}`;
        return entry;
      }

      // any 逻辑：任一命中
      if (matchedExact.length > 0) {
        entry.inject = true;
        entry.matchType = "exact";
        entry.matchedKeys = matchedExact;
        entry.reason = `exact:${matchedExact.join(",")}`;
        return entry;
      }

      // === 步骤3：语义回退 ===
      if (mode !== "exact" && _supportsSemantic(entry)) {
        const semantic = _semanticStats(entry, query);
        if (semantic.hit) {
          entry.inject = true;
          entry.matchType = "semantic";
          entry.semanticScore = semantic.score;
          entry.reason = `semantic:${semantic.score.toFixed(2)}`;
        }
      }

      // === 步骤3.5：向量化匹配（v12.18+）===
      if (!entry.inject && _supportsVector(mode, entry)) {
        const vs = _vectorMatch(entry, query, options.vectors, options.queryVector);
        if (vs > (options.vectorThreshold || 0.5)) {
          entry.inject = true;
          entry.matchType = "vector";
          entry.vectorScore = vs;
          entry.reason = `vector:${vs.toFixed(2)}`;
        }
      }

      return entry;
    })
    // === 步骤4：场景变化触发 ===
    .map((entry) => {
      if (entry.inject) return entry;
      if (sceneChanged && (entry.triggerType === "场景变化" || entry.triggerType === "scene" || entry.triggerType === "both" || entry.triggerType === "两者")) {
        const sceneKeywords = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
        const sceneHit = sceneKeywords.some((key) => sceneName.toLowerCase().includes(String(key).toLowerCase()));
        if (sceneHit) { entry.inject = true; entry.matchType = "scene"; entry.reason = "sceneChanged"; }
      }
      return entry;
    })
    // === 步骤5：扫描深度过滤 ===
    .map((entry) => {
      if (!entry.inject) return entry;
      const depth = entry.depth || entry.scanDepth || "中距";
      const rangeMap = { "近距": 3, "中距": 5, "远程": 10, "全局": 999, "near": 3, "mid": 5, "far": 10, "global": 999 };
      const range = rangeMap[depth] || 5;
      if (depth === "全局" || depth === "global" || !scanMessages.length) return entry;
      const recentText = scanMessages.slice(-range).map((m) => String(m || "").toLowerCase()).join(" ");
      const keys = Array.isArray(entry.keys) ? entry.keys : [entry.keys].filter(Boolean);
      const inRange = keys.some((key) => recentText.includes(String(key).toLowerCase()));
      if (!inRange) { entry.inject = false; entry.dropReason = `scanDepth:${depth}`; }
      return entry;
    })
    // === 步骤6：触发概率检查 ===
    .map((entry) => {
      if (!entry.inject) return entry;
      if (entry.matchType === "persistent") return entry;
      const prob = entry.probability ?? entry.triggerProb ?? 100;
      if (prob >= 100) return entry;
      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll > prob) { entry.inject = false; entry.dropReason = `probability:${prob}`; }
      return entry;
    })
    // === 步骤7：过滤+排序 ===
    .filter((entry) => entry.inject)
    .sort((a, b) => {
      const layerOrder = { "base": 0, "基底": 0, "context": 1, "情境": 1, "instant": 2, "即时": 2 };
      const layerA = layerOrder[a.layer || "context"] ?? 1;
      const layerB = layerOrder[b.layer || "context"] ?? 1;
      if (layerA !== layerB) return layerA - layerB;
      return (b.priority ?? 100) - (a.priority ?? 100);
    })
    .slice(0, limit);
}

// ---- 内部辅助 ----
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
