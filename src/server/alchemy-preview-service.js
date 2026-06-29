import { createHash, randomUUID } from "node:crypto";

export const ALCHEMY_PREVIEW_MODES = new Set(["import", "co_create", "polish", "structure", "quick_create", "localize_existing"]);
export const ALCHEMY_REFINE_MODES = new Set(["co_create", "polish", "structure"]);
export const ALCHEMY_PREVIEW_TARGETS = new Set([
  "mixed", "worldbook", "character", "location", "faction", "rule", "plot", "opening", "world_draft",
  "world_module", "strategy_sim_spec", "tabletop_module", "detective_case", "scriptkill_case", "candidate_only"
]);

const PREVIEW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 120000;
const MAX_GOAL_LENGTH = 4000;
const MAX_INSTRUCTION_LENGTH = 12000;
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
const SOURCE_EXCERPT_LENGTH = 500;

export class AlchemyPreviewError extends Error {
  constructor(status, code, userMsg) {
    super(userMsg);
    Object.assign(this, { status, code, userMsg });
  }
}

function fail(status, code, message) {
  throw new AlchemyPreviewError(status, code, message);
}

function clampConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.5;
}

function compactText(value, max = 1000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function scrubText(value) {
  return String(value ?? "")
    .replace(/\b(?:sk|pk|api)[-_][A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_SECRET]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/g, "[LOCAL_PATH]")
    .replace(/(?:^|\s)\/(?:Users|home|var|tmp)\/[^\s]+/g, " [LOCAL_PATH]");
}

function scrubValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") return scrubText(value).slice(0, 12000);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => scrubValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (/api.?key|secret|token|authorization/i.test(key)) continue;
    result[key] = scrubValue(item, depth + 1);
  }
  return result;
}

function mapType(typeId = "", target = "mixed") {
  if (target !== "mixed") return target === "world_draft" ? "worldbook" : target;
  return ({
    "worldbook-entry": "worldbook",
    organization: "faction",
    faction: "faction",
    timeline: "plot",
    event: "plot"
  }[typeId] || (ALCHEMY_PREVIEW_TARGETS.has(typeId) ? typeId : "other"));
}

function displayType(type) {
  return ({ worldbook: "世界书", character: "角色", location: "地点", faction: "组织 / 阵营", rule: "规则", plot: "剧情", opening: "开场", other: "其他" }[type] || type);
}

function primaryContent(data = {}, fallback = "") {
  for (const key of ["content", "description", "summary", "background", "personality", "text"]) {
    if (data[key]) return typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]);
  }
  return fallback || JSON.stringify(data);
}

function normalizeSourceRefs(item, chunks, fallbackExcerpt) {
  const refs = [];
  for (const index of Array.isArray(item?._sourceChunks) ? item._sourceChunks.slice(0, 8) : []) {
    const chunk = chunks.find(entry => Number(entry.index) === Number(index));
    if (!chunk) continue;
    refs.push({
      label: chunk.heading ? `段落 ${Number(index) + 1}：${compactText(chunk.heading, 80)}` : `段落 ${Number(index) + 1}`,
      excerpt: compactText(chunk.text, SOURCE_EXCERPT_LENGTH)
    });
  }
  if (!refs.length) {
    const excerpt = item?.sourceSnippet || fallbackExcerpt;
    if (excerpt) refs.push({ label: "输入素材", excerpt: compactText(excerpt, SOURCE_EXCERPT_LENGTH) });
  }
  return scrubValue(refs);
}

export function normalizePreviewItem(item = {}, { target = "mixed", chunks = [], fallbackExcerpt = "" } = {}) {
  const type = mapType(item.typeId || item.type, target);
  const fields = scrubValue(item.fields || item.data || {});
  const title = scrubText(item.title || item.entity || fields?.name || fields?.title || `${displayType(type)}候选`);
  const content = scrubText(item.content || primaryContent(fields, item.summary || fallbackExcerpt));
  const missing = Array.isArray(item.missingFields) ? item.missingFields : [];
  const warnings = [
    ...(Array.isArray(item.warnings) ? item.warnings : []),
    ...(item._error ? ["处理该条目时发生错误，请人工检查。"] : []),
    ...(item._empty ? ["未能从素材中提取完整字段。"] : [])
  ];
  return {
    id: PREVIEW_ID_RE.test(String(item.id || "")) ? item.id : randomUUID(),
    type,
    title: compactText(title, 240),
    summary: compactText(item.summary || content || title, 600),
    content: compactText(content || title, 12000),
    confidence: clampConfidence(item.confidence),
    sourceRefs: normalizeSourceRefs(item, chunks, fallbackExcerpt),
    fields,
    suggestions: scrubValue(item.suggestions || missing.map(field => `补充字段：${field}`)),
    warnings: scrubValue(warnings),
    selected: item.selected !== false && item.ignored !== true
  };
}

function heuristicItems(text, target, guessTypes) {
  const excerpt = compactText(text, 2000);
  let types = target === "mixed" ? guessTypes(text).slice(0, 5).map(type => mapType(type)) : [mapType(target, target)];
  types = [...new Set(types.filter(type => type !== "other"))];
  if (!types.length) types = ["worldbook"];
  return types.map((type, index) => normalizePreviewItem({
    type,
    title: `${displayType(type)}候选 ${index + 1}`,
    summary: excerpt,
    content: excerpt,
    confidence: 0.35,
    fields: type === "worldbook" ? { title: `${displayType(type)}候选 ${index + 1}`, content: excerpt } : { name: `${displayType(type)}候选 ${index + 1}`, description: excerpt },
    warnings: ["当前未使用 LLM，条目由基础关键词规则生成，请人工检查。"]
  }, { target: "mixed", fallbackExcerpt: excerpt }));
}

function detectConflicts(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.type}:${item.title.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.values()].filter(group => group.length > 1).map(group => ({
    id: randomUUID(),
    severity: "medium",
    title: `可能重复：${group[0].title}`,
    description: "多个候选条目具有相同类型和标题。",
    suggestion: "提交前请确认是否需要合并。",
    relatedItemIds: group.map(item => item.id)
  }));
}

function suggestMissingFields(items) {
  const requirements = {
    character: [["name", "角色名称"], ["description", "角色的核心身份或背景"]],
    location: [["name", "地点名称"], ["description", "地点的环境和作用"]],
    faction: [["name", "组织名称"], ["description", "组织目标和立场"]],
    rule: [["name", "规则名称"], ["description", "规则的约束与代价"]],
    plot: [["title", "剧情线名称"], ["description", "起因、目标或冲突"]],
    opening: [["title", "场景名称"], ["content", "开场事件和角色动机"]],
    worldbook: [["title", "条目标题"], ["content", "可供叙事使用的设定内容"]]
  };
  const missing = [];
  for (const item of items) {
    for (const [field, label] of requirements[item.type] || []) {
      if (item.fields?.[field]) continue;
      missing.push({
        id: randomUUID(),
        target: item.id,
        question: `请补充${label}。`,
        reason: `${item.title} 缺少 ${field} 字段。`,
        priority: field === "name" || field === "title" ? "high" : "medium"
      });
    }
  }
  return missing.slice(0, 40);
}

function buildSuggestions(mode, items, missingFields, conflicts) {
  const suggestions = [];
  if (missingFields.length) suggestions.push({ id: randomUUID(), type: "continue", text: `补充 ${missingFields.length} 个缺失信息后再提交。`, actionHint: "在继续处理框中回答缺口问题。" });
  if (conflicts.length) suggestions.push({ id: randomUUID(), type: "merge", text: "检查可能重复或冲突的条目。", actionHint: "编辑标题或取消选择重复项。" });
  if (mode === "co_create") suggestions.push({ id: randomUUID(), type: "continue", text: "继续说明世界规则、角色动机和核心冲突。", actionHint: "输入补充要求并继续处理。" });
  if (items.length) suggestions.push({ id: randomUUID(), type: "commit", text: "确认内容后，将选中条目加入审核队列。", actionHint: "加入审核队列不会直接写入正式世界。" });
  return suggestions;
}

function countItems(items) {
  const counts = { total: items.length, character: 0, location: 0, faction: 0, rule: 0, plot: 0, worldbook: 0, other: 0 };
  for (const item of items) counts[item.type in counts ? item.type : "other"] += 1;
  return counts;
}

function validateCreateInput(body = {}) {
  if (typeof body.text !== "string" || !body.text.trim()) fail(400, "ALCHEMY_TEXT_REQUIRED", "请输入要处理的素材或灵感。");
  if (body.text.length > MAX_TEXT_LENGTH) fail(400, "ALCHEMY_TEXT_TOO_LONG", "文本过长，请分段处理。");
  if (body.userGoal !== undefined && typeof body.userGoal !== "string") fail(400, "ALCHEMY_GOAL_INVALID", "用户目标必须是文本。");
  if (String(body.userGoal || "").length > MAX_GOAL_LENGTH) fail(400, "ALCHEMY_GOAL_TOO_LONG", "用户目标过长，请精简后重试。");
  const mode = body.mode || "import";
  const target = body.target || "mixed";
  if (!ALCHEMY_PREVIEW_MODES.has(mode)) fail(400, "ALCHEMY_MODE_INVALID", "炼金模式无效。");
  if (!ALCHEMY_PREVIEW_TARGETS.has(target)) fail(400, "ALCHEMY_TARGET_INVALID", "目标类型无效。");
  return { mode, target };
}

function publicPreview(preview) {
  const { input, storage, ...safe } = preview;
  return safe;
}

function reviewType(type) {
  return ({ worldbook: "worldbook-entry", plot: "timeline", opening: "worldbook-entry", other: "worldbook-entry" }[type] || type);
}

export function createAlchemyPreviewService({
  previewRoot,
  listModuleKeys = () => [],
  readJson,
  writeJson,
  exists,
  runAlchemy,
  guessTypes,
  enqueueReviewItems,
  now = () => new Date()
}) {
  function validatePreviewId(previewId) {
    if (typeof previewId !== "string" || !PREVIEW_ID_RE.test(previewId)) fail(400, "ALCHEMY_PREVIEW_ID_INVALID", "预览标识无效。");
    return previewId;
  }

  function pathFor(previewId, moduleKey = "") {
    return `${previewRoot(moduleKey)}/${validatePreviewId(previewId)}.json`;
  }

  async function save(preview) {
    await writeJson(pathFor(preview.id, preview.moduleKey), scrubValue(preview));
  }

  function load(previewId, moduleKey = "") {
    const id = validatePreviewId(previewId);
    const candidateRoots = moduleKey ? [previewRoot(moduleKey)] : [previewRoot("")];
    const modules = listModuleKeys();
    for (const key of modules) candidateRoots.push(previewRoot(key));
    for (const root of [...new Set(candidateRoots)]) {
      const filePath = `${root}/${id}.json`;
      if (!exists(filePath)) continue;
      const preview = readJson(filePath, null);
      if (!preview || preview.id !== id) break;
      if (Date.parse(preview.expiresAt) <= now().getTime()) fail(410, "ALCHEMY_PREVIEW_EXPIRED", "预览已过期，请重新生成。");
      return preview;
    }
    fail(404, "ALCHEMY_PREVIEW_NOT_FOUND", "预览不存在或已经被清理。");
  }

  async function create(body = {}, meta = {}) {
    const { mode, target } = validateCreateInput(body);
    const text = body.text.trim();
    const options = {
      autoRelations: body.options?.autoRelations !== false,
      detectConflicts: body.options?.detectConflicts !== false,
      suggestMissingFields: body.options?.suggestMissingFields !== false,
      preserveSource: body.options?.preserveSource === true
    };
    const result = await runAlchemy(text, { mode, target, userGoal: String(body.userGoal || ""), options });
    const chunks = Array.isArray(result?._chunks) ? result._chunks : [];
    const fallbackExcerpt = compactText(text, SOURCE_EXCERPT_LENGTH);
    let items = (result?.items || []).map(item => normalizePreviewItem(item, { target, chunks, fallbackExcerpt }));
    if (!items.length) items = heuristicItems(text, target, guessTypes);
    const conflicts = options.detectConflicts ? detectConflicts(items) : [];
    const missingFields = options.suggestMissingFields ? suggestMissingFields(items) : [];
    const suggestions = buildSuggestions(mode, items, missingFields, conflicts);
    const createdAt = now();
    const preview = {
      id: randomUUID(),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS).toISOString(),
      moduleKey: String(body.moduleKey || ""),
      mode,
      target,
      ...(meta.previousPreviewId ? { previousPreviewId: meta.previousPreviewId } : {}),
      creationMap: body.creationMap || body.plan || null,
      selectedTargets: Array.isArray(body.selectedTargets) ? body.selectedTargets : [],
      deliveryPlan: Array.isArray(body.deliveryPlan) ? body.deliveryPlan : [],
      sourcePolicy: {
        userSpecifiedPreserved: true,
        llmSuggestedMarked: true,
        userMustConfirmDelivery: true
      },
      summary: {
        title: ({ import: "素材导入预览", co_create: "协作创作预览", polish: "整理润色预览", structure: "结构预览" }[mode]),
        description: scrubText(items.length ? `已生成 ${items.length} 个候选条目，确认后可加入审核队列。` : "未生成候选条目。"),
        counts: countItems(items)
      },
      items,
      conflicts: scrubValue(conflicts),
      missingFields: scrubValue(missingFields),
      suggestions: scrubValue(suggestions),
      warnings: scrubValue([
        ...(result?._llmUsed ? [] : ["当前未配置可用 LLM，已使用本地规则生成基础预览。"]),
        ...(result?.error ? ["部分素材未能完成解析，请检查输入格式。"] : [])
      ]),
      stats: scrubValue({ ...(result?.stats || {}), inputLength: text.length, llmUsed: Boolean(result?._llmUsed), mode, target }),
      phases: scrubValue(result?.phases || []),
      input: {
        hash: createHash("sha256").update(text).digest("hex"),
        length: text.length,
        excerpt: scrubText(text.slice(0, 1000)),
        goalExcerpt: scrubText(String(body.userGoal || "").slice(0, 500))
      }
    };
    await save(preview);
    return { status: "ok", previewId: preview.id, ...(meta.previousPreviewId ? { previousPreviewId: meta.previousPreviewId } : {}), preview: publicPreview(preview) };
  }

  async function refine(body = {}) {
    const previous = load(body.previewId, String(body.moduleKey || ""));
    if (typeof body.instruction !== "string" || !body.instruction.trim()) fail(400, "ALCHEMY_REFINE_REQUIRED", "请输入继续处理的要求。");
    if (body.instruction.length > MAX_INSTRUCTION_LENGTH) fail(400, "ALCHEMY_REFINE_TOO_LONG", "继续处理要求过长，请精简后重试。");
    const mode = body.mode || (previous.mode === "import" ? "polish" : previous.mode);
    if (!ALCHEMY_REFINE_MODES.has(mode)) fail(400, "ALCHEMY_MODE_INVALID", "继续处理模式无效。");
    const selectedIds = Array.isArray(body.selectedItemIds) ? new Set(body.selectedItemIds.map(String)) : null;
    const sourceItems = previous.items.filter(item => !selectedIds || selectedIds.has(item.id));
    if (!sourceItems.length) fail(400, "ALCHEMY_REFINE_EMPTY", "没有选中的条目可继续处理。");
    const source = sourceItems.map(item => `${item.title}\n${item.content}`).join("\n\n").slice(0, MAX_TEXT_LENGTH - body.instruction.length - 200);
    const text = `${source}\n\n继续处理要求：${body.instruction.trim()}`;
    return create({
      text,
      moduleKey: previous.moduleKey,
      mode,
      target: previous.target,
      userGoal: body.instruction.trim(),
      options: body.options || {}
    }, { previousPreviewId: previous.id });
  }

  async function commit(body = {}) {
    if (body.action !== "enqueue_review") fail(400, "ALCHEMY_COMMIT_ACTION_INVALID", "不支持的提交操作。");
    const preview = load(body.previewId, String(body.moduleKey || ""));
    if (preview.committedAt) fail(409, "ALCHEMY_PREVIEW_ALREADY_COMMITTED", "该预览已经提交过，请勿重复加入审核队列。");
    const editedById = new Map();
    if (body.editedItems !== undefined && !Array.isArray(body.editedItems)) fail(400, "ALCHEMY_EDITED_ITEMS_INVALID", "编辑条目格式无效。");
    for (const edited of body.editedItems || []) {
      if (!edited || typeof edited !== "object" || typeof edited.id !== "string") fail(400, "ALCHEMY_EDITED_ITEMS_INVALID", "编辑条目格式无效。");
      const original = preview.items.find(item => item.id === edited.id);
      if (!original) fail(400, "ALCHEMY_EDITED_ITEM_UNKNOWN", "编辑条目不属于当前预览。");
      editedById.set(edited.id, normalizePreviewItem({ ...original, ...edited, id: original.id }, { target: "mixed" }));
    }
    const hasSelection = Array.isArray(body.selectedItemIds);
    const selectedIds = new Set((body.selectedItemIds || []).map(String));
    let selected = preview.items
      .map(item => editedById.get(item.id) || item)
      .filter(item => hasSelection ? selectedIds.has(item.id) : item.selected !== false);
    if (!selected.length) fail(400, "ALCHEMY_COMMIT_EMPTY", "没有选中的条目可加入审核队列。");
    const reviewPayload = selected.map(item => ({
      typeId: reviewType(item.type),
      typeName: displayType(item.type),
      entity: item.title,
      confidence: item.confidence,
      source: "alchemy-preview-commit",
      sourceSnippet: compactText(item.sourceRefs?.[0]?.excerpt || item.summary, 240),
      data: scrubValue({ ...item.fields, ...(!item.fields?.name && !item.fields?.title ? { title: item.title } : {}), content: item.content })
    }));
    const reviewItems = await enqueueReviewItems(reviewPayload, {
      source: "alchemy-preview-commit",
      moduleKey: preview.moduleKey,
      snippet: compactText(preview.summary?.description, 240)
    });
    preview.committedAt = now().toISOString();
    preview.committedItemIds = selected.map(item => item.id);
    await save(preview);
    return {
      status: "ok",
      previewId: preview.id,
      committedAt: preview.committedAt,
      reviewItems,
      stats: { enqueued: reviewItems.length, skipped: preview.items.length - selected.length }
    };
  }

  return { create, refine, commit, load, publicPreview };
}
