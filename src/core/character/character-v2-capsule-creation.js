/**
 * Character Capsule V2-1 creation core.
 * Pure functions only: no IO, no LLM, no proposal/canon writes.
 */

const DEFAULT_RELATIONSHIP_BASELINE = "familiar_companion";
const CAPSULE_SCHEMA_VERSION = "character-capsule.v2-draft.1";
const MAX_SUMMARY_CHARS = 240;
const ALLOWED_SOURCE_TYPES = new Set([
  "plain_text",
  "manual",
  "character_card_v1_json",
  "character_card_v2_json",
  "character_md",
  "prompt_card_md",
  "world_tree_profile",
  "creation_skill_artifact",
  "creation_forge_artifact"
]);

function asText(value) {
  return String(value ?? "").trim();
}

function clip(value, max = MAX_SUMMARY_CHARS) {
  const text = asText(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function slugFragment(value) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "character";
}

function normalizeSourceType(sourceType) {
  const type = asText(sourceType || "plain_text");
  return ALLOWED_SOURCE_TYPES.has(type) ? type : "plain_text";
}

function normalizeAvatar(avatar) {
  if (!avatar) return null;
  const label = clip(avatar.label || avatar.name || "手动头像", 80);
  const mime = asText(avatar.mime || avatar.type || "");
  const dataUri = asText(avatar.dataUri || avatar.url || "");
  const warnings = [];

  if (dataUri && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUri) && !/^https?:\/\//.test(dataUri)) {
    warnings.push("头像只作为 UI 展示资产；当前未识别为安全的图片 data URI 或 URL。仍不会参与角色理解。");
  }

  return {
    label,
    mime,
    ref: dataUri ? dataUri.slice(0, 256) : "",
    uiOnly: true,
    participatesInPrompt: false,
    participatesInCognition: false,
    metadataParsed: false,
    warnings
  };
}

function extractName(input) {
  const explicit = asText(input.name || input.displayName || input.characterName);
  if (explicit) return explicit.slice(0, 80);
  const text = asText(input.text || input.rawText || input.description);
  const nameMatch = text.match(/(?:角色名|名字|姓名|name)[:：]\s*([^\n，,。]+)/i);
  if (nameMatch) return nameMatch[1].trim().slice(0, 80);
  return "未命名角色";
}

export function normalizeCharacterCapsuleInput(input = {}) {
  const sourceType = normalizeSourceType(input.sourceType || input.type);
  const text = asText(input.text || input.rawText || input.description || input.content);
  const name = extractName(input);
  const avatar = normalizeAvatar(input.avatar || input.manualAvatar);
  const warnings = [];

  if (!text && name === "未命名角色") {
    warnings.push("缺少角色文本或角色名，无法生成有效角色草案。请至少提供角色名或一段设定。");
  }
  if (avatar?.warnings?.length) warnings.push(...avatar.warnings);

  return {
    sourceType,
    name,
    text,
    avatar,
    userGoal: clip(input.userGoal || input.intent || "", 200),
    language: asText(input.language || "zh-CN"),
    createdBy: "character-capsule-v2-1",
    warnings
  };
}

function createRelationshipSeed() {
  return {
    baseline: DEFAULT_RELATIONSHIP_BASELINE,
    label: "熟悉但不过界的陪伴关系",
    allows: ["自然聊天", "基本关心", "轻微打趣", "熟悉用户日常"],
    forbids: ["默认恋爱", "默认暧昧", "默认身体亲密", "默认完全信任", "默认知道用户隐私"],
    requiresConfirmationFor: ["恋爱关系", "亲密关系", "重大依赖", "核心关系阶段变更"]
  };
}

function createRuntimeContractSeed() {
  return {
    mode: "in_character_text_first",
    summary: "角色始终以角色身份回应，不自称 AI/大模型，不讨论 prompt、token、API、模块或系统实现。",
    blocks: ["ai_identity_leak", "model_technical_chat", "prompt_disclosure", "module_disclosure", "assistant_mode_drift"],
    outputGuidance: ["保持人称稳定", "保持角色语气", "可自然包含小动作、表情、神态", "不知道时以角色方式回应"]
  };
}

function createCognitionBoundarySeed() {
  return {
    mode: "companion_common_sense",
    summary: "角色默认熟悉用户日常生活与大众常识，但不默认知道冷门、专业、技术或元系统知识。",
    commonKnowledgeExamples: ["微信", "手机", "拍照", "长城", "著名城市", "著名汽车品牌"],
    depthLimitedExamples: ["冷门中国文学", "汽车技术细节", "法律/医学专业细节", "程序架构"],
    blockedMetaExamples: ["DeepSeek 技术细节", "LLM prompt", "token", "API", "World Tree 模块"]
  };
}

function createPerformanceFingerprintSeed(input) {
  const text = input.text || "";
  return {
    status: "seed",
    source: input.sourceType,
    voice: {
      catchphrases: [],
      speechHabits: [],
      addressStyle: [],
      representativeLines: []
    },
    nonverbal: {
      gestures: [],
      expressions: [],
      posture: [],
      silenceStyle: []
    },
    appearance: {
      anchors: [],
      outfitRules: [],
      doNotChange: []
    },
    extractionHints: text ? ["后续可从角色设定与对话样本中提取口癖、动作、表情、外貌锚点。"] : [],
    overuseGuard: ["不要每句话重复同一个动作", "不要机械复读口癖", "外貌锚点不得随意改写"]
  };
}

export function createCharacterCapsuleDraft(input = {}, options = {}) {
  const normalized = normalizeCharacterCapsuleInput(input);
  const now = options.now || new Date().toISOString();
  const characterId = asText(options.characterId) || `char_${slugFragment(normalized.name)}_${String(options.seed || "draft").slice(0, 8)}`;
  const validationWarnings = [...normalized.warnings];

  const draft = {
    schemaVersion: CAPSULE_SCHEMA_VERSION,
    status: "draft",
    requiresUserConfirmation: true,
    characterId,
    displayName: normalized.name,
    source: {
      type: normalized.sourceType,
      textExcerpt: clip(normalized.text, 500),
      userGoal: normalized.userGoal,
      confidence: normalized.text ? "medium" : "low",
      rawSourceMustBePreserved: true,
      inferredFieldsMustBeMarked: true
    },
    avatar: normalized.avatar,
    identity: {
      name: normalized.name,
      oneLineSummary: normalized.text ? clip(normalized.text, 120) : "待补充角色简介",
      sourceConfidence: normalized.name === "未命名角色" ? "low" : "user_or_imported"
    },
    relationship: createRelationshipSeed(),
    runtimeContract: createRuntimeContractSeed(),
    cognitionBoundary: createCognitionBoundarySeed(),
    performanceFingerprint: createPerformanceFingerprintSeed(normalized),
    advancedUi: {
      advancedSettingsVisible: false,
      debugVisible: false,
      promptPreviewVisible: false,
      moduleTraceVisible: false,
      qualityScoreVisible: false
    },
    persistencePolicy: {
      mayWriteCanon: false,
      mayWriteProposal: false,
      mayWriteLongTermMemory: false,
      mayCallLlm: false,
      mayParseImageMetadata: false
    },
    warnings: validationWarnings,
    createdAt: now,
    updatedAt: now
  };

  return {
    ok: validationWarnings.length === 0 || Boolean(normalized.text || normalized.name !== "未命名角色"),
    draft,
    summary: buildCharacterCapsuleSummary(draft),
    warnings: validationWarnings
  };
}

export function validateCharacterCapsuleDraft(draft) {
  const errors = [];
  const warnings = [];
  if (!draft || typeof draft !== "object") errors.push("角色草案为空或格式无效。");
  if (draft && draft.schemaVersion !== CAPSULE_SCHEMA_VERSION) warnings.push("角色草案 schemaVersion 与 V2-1 草案版本不一致。");
  if (!asText(draft?.displayName)) errors.push("缺少角色名。");
  if (draft?.requiresUserConfirmation !== true) errors.push("角色草案必须要求用户确认后才能保存。");
  if (draft?.relationship?.baseline !== DEFAULT_RELATIONSHIP_BASELINE) errors.push("默认关系必须是熟悉但不过界的陪伴关系。");
  if (draft?.persistencePolicy?.mayCallLlm) errors.push("创建草案阶段不得调用 LLM。");
  if (draft?.persistencePolicy?.mayWriteCanon) errors.push("创建草案阶段不得写 canon。");
  if (draft?.persistencePolicy?.mayWriteProposal) errors.push("创建草案阶段不得写 proposal。");
  if (draft?.avatar && draft.avatar.uiOnly !== true) errors.push("头像必须是 UI-only 资产。");
  if (draft?.advancedUi?.advancedSettingsVisible !== false) errors.push("高级设置默认必须隐藏。");
  return { ok: errors.length === 0, errors, warnings };
}

export function buildCharacterCapsuleSummary(draft) {
  if (!draft) return { title: "角色草案无效", lines: [], badges: [] };
  return {
    title: draft.displayName || "未命名角色",
    subtitle: draft.identity?.oneLineSummary || "待补充角色简介",
    badges: ["Text-first", "需确认", "高级设置隐藏"],
    lines: [
      "默认关系：熟悉但不过界的陪伴关系",
      "角色认知：熟悉日常常识，专业/技术/冷门知识按身份限制",
      "表现指纹：口癖、动作、表情、外貌锚点将在后续编辑中完善",
      draft.avatar ? "头像：已添加为 UI-only 展示资产" : "头像：可选，当前未添加"
    ],
    safeForNormalUi: true,
    omittedTechnicalDetails: ["prompt", "module trace", "OOC score", "token budget"]
  };
}

export { DEFAULT_RELATIONSHIP_BASELINE, CAPSULE_SCHEMA_VERSION };
