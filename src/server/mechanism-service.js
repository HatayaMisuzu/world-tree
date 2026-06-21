import { createHash, randomUUID } from "node:crypto";

const SECRET_KEY_RE = /api.?key|secret|token|authorization|cookie/i;
const EXECUTABLE_KEY_RE = /^(?:raw)?(?:html|css|js|javascript|script|style)$/i;
const LOCAL_PATH_RE = /\b[A-Za-z]:\\[^\s<>:"|?*]+|\/(?:Users|home|var|tmp)\/[^\s]+/g;

function scrubText(value, max = 4000) {
  return String(value ?? "")
    .replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(LOCAL_PATH_RE, "[LOCAL_PATH]")
    .replace(/<\/?(?:script|style)[^>]*>/gi, "")
    .slice(0, max);
}

export function scrubMechanismValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") return scrubText(value, 12000);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => scrubMechanismValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (SECRET_KEY_RE.test(key) || EXECUTABLE_KEY_RE.test(key)) continue;
    output[key] = scrubMechanismValue(item, depth + 1);
  }
  return output;
}

const TYPE_DEFAULTS = Object.freeze({
  affinity: { kind: "number", min: 0, max: 100, defaultValue: 0, preferredType: "relationship_panel" },
  exploration: { kind: "progress", min: 0, max: 100, defaultValue: 0, preferredType: "stat_bar" },
  inventory: { kind: "inventory", defaultItems: [], preferredType: "inventory_grid" },
  quest: { kind: "progress", min: 0, max: 100, defaultValue: 0, preferredType: "status_list" },
  reputation: { kind: "number", min: -100, max: 100, defaultValue: 0, preferredType: "stat_bar" },
  meter: { kind: "number", min: 0, max: 100, defaultValue: 0, preferredType: "stat_bar" },
  flag: { kind: "flags", preferredType: "status_list" },
  counter: { kind: "number", min: 0, defaultValue: 0, preferredType: "status_list" },
  custom: { kind: "custom", preferredType: "status_list" }
});

const TEMPLATE_DEFS = [
  ["affinity.basic.v1", "基础好感度机制", "affinity", "角色关系", "记录角色之间的好感、信任、亲密或敌意变化。", ["好感度", "信任", "亲密", "敌意", "关系值"], ["角色关系与信任变化"]],
  ["exploration.location.v1", "地点探索度机制", "exploration", "探索", "记录地点探索进度、地图发现和区域解锁。", ["探索度", "探索进度", "地点解锁", "地图", "城堡"], ["旧城堡探索度"]],
  ["inventory.simple.v1", "简易背包机制", "inventory", "物品资源", "记录物品的获得、使用、消耗与数量。", ["背包", "物品", "道具", "获得", "使用", "消耗", "钥匙"], ["获得钥匙或消耗药水"]],
  ["quest.progress.v1", "任务进度机制", "quest", "任务", "记录主线、支线、委托与目标进度。", ["任务", "主线", "支线", "目标", "委托"], ["进入东塔任务"]],
  ["meter.pollution_stability.v1", "污染/稳定度机制", "meter", "状态数值", "记录污染、稳定度、侵蚀、理智与能量等连续数值。", ["污染", "稳定度", "侵蚀", "理智", "能量", "数值"], ["梦境稳定度与污染值"]],
  ["reputation.faction.v1", "势力声望机制", "reputation", "阵营", "记录阵营、势力或地区对玩家的评价。", ["声望", "阵营", "势力", "评价"], ["城邦声望"]],
  ["time.simple.v1", "时间系统", "counter", "时间", "以回合、天数或阶段记录时间推进。", ["时间", "天数", "回合", "昼夜"], ["冒险天数"]],
  ["resource.counter.v1", "资源计数机制", "counter", "资源", "记录金币、材料、次数等可增减资源。", ["资源", "次数", "计数", "金币", "材料"], ["行动次数"]]
];

export const MECHANISM_TEMPLATES = Object.freeze(TEMPLATE_DEFS.map(([templateId, name, type, category, description, keywords, examples], priority) => {
  const defaults = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.custom;
  return Object.freeze({
    templateId, name, type, category, description, keywords, examples,
    defaultDraft: {
      name: name.replace(/机制$/, ""), type, description, scope: "world",
      stateSchema: { ...defaults, preferredType: undefined },
      visualHint: { preferredType: defaults.preferredType, showToPlayer: true }
    },
    visualHint: { preferredType: defaults.preferredType, showToPlayer: true },
    updatedAt: "2026-06-21T00:00:00.000Z",
    priority
  });
}));

function normalizeName(value, fallback) {
  const clean = scrubText(value, 120).replace(/[：:，,。；;\s]+$/g, "").trim();
  return clean || fallback;
}

function subjectBefore(sentence, keyword, fallback) {
  const index = sentence.indexOf(keyword);
  const prefix = index >= 0 ? sentence.slice(0, index) : "";
  const cleaned = prefix
    .replace(/^(?:玩家|系统)?(?:可以|能够|会|将|拥有|具有)?/u, "")
    .replace(/(?:会根据.*|会随着.*|根据.*|随着.*|拥有|具有|有|的)$/u, "")
    .split(/[，,、]/).pop()?.trim();
  return normalizeName(cleaned, fallback);
}

function draftFor(type, name, description, source = "input", sourceRef = {}) {
  const defaults = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.custom;
  const stateSchema = { ...defaults };
  delete stateSchema.preferredType;
  return scrubMechanismValue({
    id: randomUUID(), source, sourceRef, name: normalizeName(name, "未命名机制"), type,
    description: scrubText(description, 500), scope: "world", stateSchema,
    visualHint: { preferredType: defaults.preferredType, showToPlayer: true },
    selected: true, warnings: []
  });
}

export function extractMechanismDrafts(text = "", { previewId = "" } = {}) {
  const clean = scrubText(text, 120000).trim();
  if (!clean) return [];
  const sentences = clean.split(/[。！？!?\n]+/).map(value => value.trim()).filter(Boolean);
  const drafts = [];
  const seen = new Set();
  const add = (type, name, sentence) => {
    const key = `${type}:${name}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    drafts.push(draftFor(type, name, `从输入内容识别：${sentence}`, "input", {
      ...(previewId ? { previewId } : {}), excerpt: scrubText(sentence, 240)
    }));
  };

  for (const sentence of sentences) {
    const affinity = sentence.match(/(好感度|信任度?|亲密度?|敌意|关系值)/u)?.[1];
    if (affinity) add("affinity", `${subjectBefore(sentence, affinity, "角色")}${affinity}`, sentence);
    const exploration = sentence.match(/(探索度|探索进度|地点解锁|地图)/u)?.[1];
    if (exploration) add("exploration", exploration.includes("探索") ? `${subjectBefore(sentence, exploration, "地点")}${exploration}` : "地点探索度", sentence);
    if (/(背包|物品|道具|获得|使用|消耗)/u.test(sentence)) add("inventory", "简易背包", sentence);
    if (/(任务|主线|支线|目标|委托)/u.test(sentence)) add("quest", "任务进度", sentence);
    if (/(声望|阵营|势力|评价)/u.test(sentence)) add("reputation", "势力声望", sentence);
    const meter = sentence.match(/([\p{Script=Han}A-Za-z0-9_-]{0,12}稳定度)/u)?.[1]
      || sentence.match(/([\p{Script=Han}A-Za-z0-9_-]{0,8}(?:污染值?|侵蚀|理智|能量|数值))/u)?.[1];
    if (meter) add("meter", normalizeName(meter.replace(/^会随着/u, ""), "状态数值"), sentence);
    if (/(开关|是否|标记|已解锁)/u.test(sentence)) add("flag", "状态标记", sentence);
    if (/(次数|计数|天数|回合)/u.test(sentence)) add("counter", "进度计数", sentence);
  }
  return drafts.slice(0, 40);
}

function recommendationScore(template, text = "", existingTypes = []) {
  const haystack = String(text).toLowerCase();
  let score = Math.max(0, 20 - template.priority);
  if (template.keywords.some(keyword => haystack.includes(keyword.toLowerCase()))) score += 50;
  if (existingTypes.includes(template.type)) score += 25;
  return score;
}

export function listMechanismLibrary({ query = "", text = "", drafts = [] } = {}) {
  const combined = `${query} ${text}`.trim();
  const existingTypes = drafts.map(draft => draft.type);
  const templates = MECHANISM_TEMPLATES.map(template => scrubMechanismValue(template));
  const filtered = query
    ? templates.filter(template => `${template.name} ${template.category} ${template.description} ${template.keywords.join(" ")}`.toLowerCase().includes(String(query).toLowerCase()))
    : templates;
  const sorted = [...filtered].sort((a, b) => recommendationScore(b, combined, existingTypes) - recommendationScore(a, combined, existingTypes));
  return { templates: sorted, recommendations: sorted.filter(item => recommendationScore(item, combined, existingTypes) > 20).slice(0, 4) };
}

export function draftFromTemplate(templateId) {
  const template = MECHANISM_TEMPLATES.find(item => item.templateId === templateId);
  if (!template) return null;
  return draftFor(template.type, template.defaultDraft.name || template.name, template.description, "library", { templateId });
}

export function normalizeMechanismDraft(input = {}) {
  const type = TYPE_DEFAULTS[input.type] ? input.type : "custom";
  const source = ["input", "library", "manual"].includes(input.source) ? input.source : "manual";
  const normalized = draftFor(type, input.name, input.description, source, input.sourceRef || {});
  return scrubMechanismValue({
    ...normalized,
    id: /^[\w.-]{1,120}$/u.test(String(input.id || "")) ? String(input.id) : normalized.id,
    scope: ["world", "save", "session"].includes(input.scope) ? input.scope : "world",
    stateSchema: { ...normalized.stateSchema, ...(scrubMechanismValue(input.stateSchema || {})) },
    visualHint: { ...normalized.visualHint, ...(scrubMechanismValue(input.visualHint || {})), showToPlayer: input.visualHint?.showToPlayer !== false },
    selected: input.selected !== false,
    warnings: Array.isArray(input.warnings) ? input.warnings.slice(0, 20) : []
  });
}

export function commitMechanismDrafts(existing = {}, drafts = []) {
  const selected = drafts.filter(draft => draft?.selected !== false).map(normalizeMechanismDraft);
  const current = Array.isArray(existing.mechanisms) ? existing.mechanisms : [];
  const byKey = new Map(current.map(item => [`${item.type}:${item.name}`.toLowerCase(), scrubMechanismValue(item)]));
  for (const item of selected) byKey.set(`${item.type}:${item.name}`.toLowerCase(), { ...item, committedAt: new Date().toISOString(), confirmed: true });
  return {
    cache: { version: "mechanism-cache.v1", mechanisms: [...byKey.values()], updatedAt: new Date().toISOString(), hash: createHash("sha256").update(JSON.stringify([...byKey.values()])).digest("hex") },
    committed: selected.length,
    skipped: drafts.length - selected.length
  };
}
