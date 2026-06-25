/**
 * Character Capsule V2 runtime context bridge.
 * Pure functions only: no filesystem, no LLM, no canon/proposal/memory writes.
 */

const RUNTIME_CONTEXT_SCHEMA_VERSION = "character-capsule.v2.runtime-context.1";

function asText(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clip(value, max = 260) {
  const text = asText(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function safeSummaryLines(uiSummary, cognitionBoundary, runtimeContract, performanceFingerprint) {
  const lines = [];
  if (Array.isArray(uiSummary?.lines)) lines.push(...uiSummary.lines.slice(0, 6));
  if (cognitionBoundary?.summary) lines.push(`认知边界：${clip(cognitionBoundary.summary, 160)}`);
  if (runtimeContract?.summary) lines.push(`运行契约：${clip(runtimeContract.summary, 160)}`);
  if (performanceFingerprint?.status) lines.push(`表现指纹：${performanceFingerprint.status === "seed" ? "已建立种子，待后续编辑完善" : "已可用"}`);
  return [...new Set(lines)].slice(0, 8);
}

function buildAdvancedPromptPreview({ runtimeContract, cognitionBoundary, performanceFingerprint, relationship }) {
  return {
    advancedOnly: true,
    llmInjectionEnabled: false,
    note: "This preview is for future Character Engine wiring only. It must not be injected into LLM prompts in V2-2.",
    blocks: [
      runtimeContract ? { type: "runtime_contract", content: runtimeContract.summary || runtimeContract } : null,
      cognitionBoundary ? { type: "cognition_boundary", content: cognitionBoundary.summary || cognitionBoundary } : null,
      performanceFingerprint ? { type: "performance_fingerprint", content: performanceFingerprint } : null,
      relationship ? { type: "relationship_baseline", content: relationship } : null
    ].filter(Boolean)
  };
}

export function buildCharacterV2RuntimeContext(input = {}) {
  const manifest = input.manifest || {};
  const profile = input.profile || {};
  const uiSummary = input.uiSummary || {};
  const runtimeContract = input.runtimeContract || null;
  const cognitionBoundary = input.cognitionBoundary || null;
  const performanceFingerprint = input.performanceFingerprint || null;
  const relationship = input.relationship || null;
  const memorySeed = input.memorySeed || null;

  const characterId = asText(manifest.characterId || profile.characterId || input.characterId);
  const displayName = asText(manifest.displayName || profile.identity?.name || uiSummary.title || input.displayName || "未命名角色");

  const normalSummary = {
    title: displayName,
    subtitle: clip(uiSummary.subtitle || profile.identity?.oneLineSummary || "Text-first 角色运行上下文已就绪"),
    badges: ["V2 Runtime", "Read-only", "未注入 LLM"],
    lines: safeSummaryLines(uiSummary, cognitionBoundary, runtimeContract, performanceFingerprint),
    safeForNormalUi: true
  };

  const context = {
    schemaVersion: RUNTIME_CONTEXT_SCHEMA_VERSION,
    available: Boolean(characterId && displayName),
    readOnly: true,
    llmInjectionEnabled: false,
    mayWriteCanon: false,
    mayWriteProposal: false,
    mayWriteLongTermMemory: false,
    mayWriteRelationship: false,
    characterId,
    displayName,
    source: {
      textFirst: manifest.textFirst !== false,
      multimodal: manifest.multimodal === true,
      profileSchemaVersion: profile.schemaVersion || "",
      manifestSchemaVersion: manifest.schemaVersion || ""
    },
    runtimeContract: runtimeContract ? {
      mode: runtimeContract.mode || "in_character_text_first",
      summary: runtimeContract.summary || "",
      blocks: asArray(runtimeContract.blocks),
      outputGuidance: asArray(runtimeContract.outputGuidance)
    } : null,
    cognitionBoundary: cognitionBoundary ? {
      mode: cognitionBoundary.mode || "companion_common_sense",
      summary: cognitionBoundary.summary || "",
      commonKnowledgeExamples: asArray(cognitionBoundary.commonKnowledgeExamples).slice(0, 12),
      depthLimitedExamples: asArray(cognitionBoundary.depthLimitedExamples).slice(0, 12),
      blockedMetaExamples: asArray(cognitionBoundary.blockedMetaExamples).slice(0, 12)
    } : null,
    performanceFingerprint: performanceFingerprint ? {
      status: performanceFingerprint.status || "seed",
      source: performanceFingerprint.source || "unknown",
      overuseGuard: asArray(performanceFingerprint.overuseGuard).slice(0, 8)
    } : null,
    relationship: relationship ? {
      baseline: relationship.baseline || "familiar_companion",
      label: relationship.label || "熟悉但不过界的陪伴关系",
      requiresConfirmationFor: asArray(relationship.requiresConfirmationFor)
    } : null,
    memory: memorySeed ? {
      available: true,
      count: Array.isArray(memorySeed.memories) ? memorySeed.memories.length : 0,
      note: memorySeed.note || "V2-2 does not write long-term memory."
    } : { available: false, count: 0, note: "No memory seed found." },
    normalSummary,
    advancedSummary: {
      promptPreview: buildAdvancedPromptPreview({ runtimeContract, cognitionBoundary, performanceFingerprint, relationship }),
      hiddenFromNormalUi: true
    }
  };

  return context;
}

export function validateCharacterV2RuntimeContext(context = {}) {
  const errors = [];
  if (context.schemaVersion !== RUNTIME_CONTEXT_SCHEMA_VERSION) errors.push("runtime context schemaVersion mismatch");
  if (!context.characterId) errors.push("missing characterId");
  if (!context.displayName) errors.push("missing displayName");
  if (context.readOnly !== true) errors.push("runtime context must be read-only");
  if (context.llmInjectionEnabled !== false) errors.push("V2-2 must not enable LLM injection");
  if (context.mayWriteCanon || context.mayWriteProposal || context.mayWriteLongTermMemory || context.mayWriteRelationship) {
    errors.push("V2-2 runtime context must not write canon/proposal/memory/relationship");
  }
  if (context.normalSummary?.safeForNormalUi !== true) errors.push("normal summary must be safe for normal UI");
  if (context.advancedSummary?.hiddenFromNormalUi !== true) errors.push("advanced summary must be hidden from normal UI");
  return { ok: errors.length === 0, errors };
}

export function summarizeCharacterV2RuntimeContext(context = {}) {
  return {
    available: context.available === true,
    characterId: context.characterId || "",
    displayName: context.displayName || "未命名角色",
    normalSummary: context.normalSummary || { title: context.displayName || "未命名角色", lines: [], safeForNormalUi: true },
    advancedSummary: context.advancedSummary || { hiddenFromNormalUi: true },
    readOnly: true,
    llmInjectionEnabled: false
  };
}

export { RUNTIME_CONTEXT_SCHEMA_VERSION };
