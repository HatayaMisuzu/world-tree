const SECTION_RE = /^【([^】]+)】\s*$/gm;

function parseScalar(value) {
  const text = String(value || "").trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const array = text.match(/^\[(.*)]$/);
  if (array) return array[1].split(",").map((item) => item.trim()).filter(Boolean);
  return text.replace(/^["']|["']$/g, "");
}

export function parseLooseYaml(text = "") {
  const lines = String(text || "").split(/\r?\n/);
  const root = {};
  let currentKey = "";
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("- ")) {
      if (!currentKey) currentKey = "items";
      if (!Array.isArray(root[currentKey])) root[currentKey] = [];
      root[currentKey].push(parseScalar(trimmed.slice(2)));
      continue;
    }
    const match = trimmed.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match) {
      if (!Array.isArray(root.text)) root.text = [];
      root.text.push(trimmed);
      continue;
    }
    const key = match[1].trim();
    const value = match[2].trim();
    currentKey = key;
    root[key] = value ? parseScalar(value) : root[key] || [];
  }
  return root;
}

export function parseMarkedOutput(rawText = "") {
  const matches = [...String(rawText || "").matchAll(SECTION_RE)];
  if (!matches.length) return { narrative: rawText, sections: {}, errors: [] };
  const sections = {};
  const errors = [];
  const narrative = rawText.slice(0, matches[0].index).trim();
  for (let index = 0; index < matches.length; index += 1) {
    const name = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? rawText.length;
    const body = rawText.slice(start, end).trim();
    try {
      sections[name] = parseLooseYaml(body);
      sections[name]._raw = body;
    } catch (error) {
      errors.push({ section: name, message: error.message });
      sections[name] = { _raw: body };
    }
  }
  return { narrative, sections, errors };
}

export function sectionsToOverlayPatch(parsed, input = "") {
  const patch = {
    createdAt: new Date().toISOString(),
    input,
    runtime: {},
    canon: {},
    characters: {},
    worldbook: {},
    memory: [],
    prediction: {},
    parseErrors: parsed.errors || []
  };
  if (parsed.sections["状态"]) patch.runtime = parsed.sections["状态"];
  if (parsed.sections["正史"]) patch.canon = parsed.sections["正史"];
  if (parsed.sections["角色"]) patch.characters = parsed.sections["角色"];
  if (parsed.sections["世界书提案"]) patch.worldbook = parsed.sections["世界书提案"];
  if (parsed.sections["记忆"]) patch.memory = parsed.sections["记忆"].items || parsed.sections["记忆"].text || [];
  if (parsed.sections["场景预测"]) patch.prediction = parsed.sections["场景预测"];
  if (parsed.sections["邻近激活"]) {
    const activation = parsed.sections["邻近激活"];
    const ids = activation.activate ? String(activation.activate).split(/[,，\\s]+/).filter(Boolean) :
                Array.isArray(activation.items) ? activation.items : [];
    patch.activationRequests = ids;
  }
  return patch;
}

// ═══════════════════════════════════════════════════════════════
//  双段式流程新标记段解析（Phase 6）
//  解析 Writer 输出的 【叙事】【状态建议】【情绪反馈】
// ═══════════════════════════════════════════════════════════════

/**
 * 从原始文本中提取【叙事】段（用户可见正文）
 * 兼容模式：有【叙事】标记则取标记内内容，无则全文为叙事
 * @param {string} rawText
 * @returns {string} 用户可见的叙事正文
 */
export function extractVisibleNarrative(rawText = "") {
  const text = String(rawText || "");
  const match = text.match(/【叙事】\s*\n?([\s\S]*?)(?=\n【[^】]+】|$)/);
  return match ? match[1].trim() : text.trim();
}

/**
 * 从 sections 中提取【状态建议】段的状态变更
 * @param {Object} sections - parseMarkedOutput 的结果
 * @returns {Object} { cluesAdded, relationshipDelta, sceneState }
 */
export function parseStateSuggestions(sections = {}) {
  const raw = sections["状态建议"];
  if (!raw) return { cluesAdded: [], relationshipDelta: [], sceneState: [] };

  const result = {
    cluesAdded: Array.isArray(raw.cluesAdded) ? raw.cluesAdded :
                Array.isArray(raw.newClues) ? raw.newClues :
                Array.isArray(raw.items) ? raw.items : [],
    relationshipDelta: Array.isArray(raw.relationshipDelta) ? raw.relationshipDelta :
                       Array.isArray(raw.relationshipChanges) ? raw.relationshipChanges : [],
    sceneState: Array.isArray(raw.sceneState) ? raw.sceneState :
                Array.isArray(raw.sceneStateChanges) ? raw.sceneStateChanges : []
  };
  return result;
}

/**
 * 从 sections 中提取【情绪反馈】段的情绪调整建议
 * @param {Object} sections - parseMarkedOutput 的结果
 * @returns {Object|null} { engagement, tension, fatigue, curiosity } deltas
 */
export function parseEmotionFeedback(sections = {}) {
  const raw = sections["情绪反馈"];
  if (!raw) return null;

  // 直接返回解析后的键值对（parseLooseYaml 已经做了）
  const result = {};
  for (const key of ["engagement", "tension", "fatigue", "curiosity"]) {
    if (raw[key] != null) result[key] = Number(raw[key]);
  }
  return Object.keys(result).length ? result : null;
}
