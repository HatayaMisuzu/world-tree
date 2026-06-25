/**
 * Character Capsule V2 runtime context bridge.
 * Pure functions only: no filesystem, no LLM, no canon/proposal/memory writes.
 *
 * TRUE FINAL PATCH:
 * - Consumes input.longTermState safely.
 * - Exposes only summarized confirmed long-term memory/relationship/canon.
 * - Never exposes auditLog in normal UI summary.
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

function safeSummaryLines(uiSummary, cognitionBoundary, runtimeContract, performanceFingerprint, longTerm) {
  const lines = [];
  if (Array.isArray(uiSummary?.lines)) lines.push(...uiSummary.lines.slice(0, 6));
  if (cognitionBoundary?.summary) lines.push(`认知边界：${clip(cognitionBoundary.summary, 160)}`);
  if (runtimeContract?.summary) lines.push(`运行契约：${clip(runtimeContract.summary, 160)}`);
  if (performanceFingerprint?.status) lines.push(`表现指纹：${performanceFingerprint.status === "seed" ? "已建立种子，待后续编辑完善" : "已可用"}`);
  if (longTerm?.available) {
    const parts = [];
    if (longTerm.memoryConfirmedCount) parts.push(`${longTerm.memoryConfirmedCount} 条已确认记忆`);
    if (longTerm.canonConfirmedCount) parts.push(`${longTerm.canonConfirmedCount} 条已确认 canon`);
    if (longTerm.relationshipConfirmed?.label || longTerm.relationshipConfirmed?.baseline) {
      parts.push(`关系：${longTerm.relationshipConfirmed.label || longTerm.relationshipConfirmed.baseline}`);
    }
    if (parts.length) lines.push(`长期状态：${parts.join("；")}`);
  }
  return [...new Set(lines)].slice(0, 8);
}

function buildAdvancedPromptPreview({ runtimeContract, cognitionBoundary, performanceFingerprint, relationship, longTerm }) {
  return {
    advancedOnly: true,
    llmInjectionEnabled: false,
    note: "This preview is for future Character Engine wiring only. It must not write canon/proposal/memory/relationship.",
    blocks: [
      runtimeContract ? { type: "runtime_contract", content: runtimeContract.summary || runtimeContract } : null,
      cognitionBoundary ? { type: "cognition_boundary", content: cognitionBoundary.summary || cognitionBoundary } : null,
      performanceFingerprint ? { type: "performance_fingerprint", content: performanceFingerprint } : null,
      relationship ? { type: "relationship_baseline", content: relationship } : null,
      longTerm?.available ? { type: "long_term_summary", content: sanitizeLongTermForAdvancedPreview(longTerm) } : null,
    ].filter(Boolean)
  };
}

function normalizeLongTermState(longTermState = null) {
  if (!longTermState || typeof longTermState !== "object") {
    return {
      available: false,
      memoryConfirmedCount: 0,
      memoryPendingCount: 0,
      relationshipPendingCount: 0,
      canonConfirmedCount: 0,
      canonProposalCount: 0,
      qualityIssueCount: 0,
      confirmedMemorySummary: [],
      relationshipConfirmed: null,
      canonSummary: []
    };
  }

  const memoryConfirmed = asArray(longTermState.memory?.confirmed);
  const memoryPending = asArray(longTermState.memory?.pending);
  const relationshipPending = asArray(longTermState.relationship?.pending);
  const canonConfirmed = asArray(longTermState.canon?.confirmed);
  const canonProposals = asArray(longTermState.canon?.proposals);
  const qualityIssues = asArray(longTermState.quality?.issues);
  const relationshipConfirmed = longTermState.relationship?.confirmed || null;

  return {
    available: true,
    schemaVersion: longTermState.schemaVersion || "",
    memoryConfirmedCount: memoryConfirmed.length,
    memoryPendingCount: memoryPending.length,
    relationshipPendingCount: relationshipPending.length,
    canonConfirmedCount: canonConfirmed.length,
    canonProposalCount: canonProposals.length,
    qualityIssueCount: qualityIssues.length,
    confirmedMemorySummary: memoryConfirmed.slice(0, 8).map((m) => ({
      memoryId: m.memoryId || "",
      type: m.type || "event_memory",
      content: clip(m.content || m.excerpt || "", 160),
      confidence: m.confidence ?? null,
      tags: asArray(m.tags).slice(0, 6),
      acceptedAt: m.acceptedAt || null
    })),
    relationshipConfirmed: relationshipConfirmed ? {
      baseline: relationshipConfirmed.baseline || "neutral",
      stage: relationshipConfirmed.stage || "initial",
      label: relationshipConfirmed.label || relationshipConfirmed.baseline || "neutral",
      trustScore: relationshipConfirmed.trustScore ?? null,
      familiarityScore: relationshipConfirmed.familiarityScore ?? null,
      boundaryFlags: asArray(relationshipConfirmed.boundaryFlags).slice(0, 8),
      lastChangedAt: relationshipConfirmed.lastChangedAt || null
    } : null,
    canonSummary: canonConfirmed.slice(0, 8).map((c) => ({
      canonId: c.canonId || c.proposalId || "",
      category: c.category || "general",
      content: clip(c.content || "", 160),
      acceptedAt: c.acceptedAt || null
    }))
  };
}

function sanitizeLongTermForAdvancedPreview(longTerm) {
  return {
    memoryConfirmedCount: longTerm.memoryConfirmedCount,
    relationshipConfirmed: longTerm.relationshipConfirmed,
    canonConfirmedCount: longTerm.canonConfirmedCount,
    qualityIssueCount: longTerm.qualityIssueCount,
    confirmedMemorySummary: longTerm.confirmedMemorySummary,
    canonSummary: longTerm.canonSummary
  };
}

export function buildCharacterV2RuntimeContext(input = {}) {
  const manifest = input.manifest || {};
  const profile = input.profile || {};
  const uiSummary = input.uiSummary || {};
  const runtimeContract = input.runtimeContract || null;
  const cognitionBoundary = input.cognitionBoundary || null;
  const performanceFingerprint = input.performanceFingerprint || null;
  const longTerm = normalizeLongTermState(input.longTermState || null);

  // Prefer confirmed long-term relationship when present; fall back to seed.
  const relationship = longTerm.relationshipConfirmed || input.relationship || null;
  const memorySeed = input.memorySeed || null;

  const characterId = asText(manifest.characterId || profile.characterId || input.characterId);
  const displayName = asText(manifest.displayName || profile.identity?.name || uiSummary.title || input.displayName || "未命名角色");

  const normalSummary = {
    title: displayName,
    subtitle: clip(uiSummary.subtitle || profile.identity?.oneLineSummary || "Text-first 角色运行上下文已就绪"),
    badges: ["V2 Runtime", "Read-only", "未注入 LLM"],
    lines: safeSummaryLines(uiSummary, cognitionBoundary, runtimeContract, performanceFingerprint, longTerm),
    safeForNormalUi: true
  };

  const seedMemoryCount = Array.isArray(memorySeed?.memories) ? memorySeed.memories.length : 0;

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
      manifestSchemaVersion: manifest.schemaVersion || "",
      longTermSchemaVersion: input.longTermState?.schemaVersion || ""
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
      label: relationship.label || relationship.baseline || "熟悉但不过界的陪伴关系",
      stage: relationship.stage || "",
      trustScore: relationship.trustScore ?? null,
      familiarityScore: relationship.familiarityScore ?? null,
      requiresConfirmationFor: asArray(relationship.requiresConfirmationFor)
    } : null,
    memory: {
      available: seedMemoryCount > 0 || longTerm.memoryConfirmedCount > 0,
      seedCount: seedMemoryCount,
      confirmedCount: longTerm.memoryConfirmedCount,
      count: seedMemoryCount + longTerm.memoryConfirmedCount,
      confirmedSummary: longTerm.confirmedMemorySummary,
      note: longTerm.memoryConfirmedCount > 0
        ? "Long-term confirmed memories are available read-only."
        : (memorySeed?.note || "No confirmed long-term memory found.")
    },
    longTerm,
    normalSummary,
    advancedSummary: {
      promptPreview: buildAdvancedPromptPreview({ runtimeContract, cognitionBoundary, performanceFingerprint, relationship, longTerm }),
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
  if (context.llmInjectionEnabled !== false) errors.push("V2 runtime context must not enable direct LLM injection");
  if (context.mayWriteCanon || context.mayWriteProposal || context.mayWriteLongTermMemory || context.mayWriteRelationship) {
    errors.push("runtime context must not write canon/proposal/memory/relationship");
  }
  if (context.normalSummary?.safeForNormalUi !== true) errors.push("normal summary must be safe for normal UI");
  if (context.advancedSummary?.hiddenFromNormalUi !== true) errors.push("advanced summary must be hidden from normal UI");
  if (JSON.stringify(context.normalSummary || {}).includes("auditLog")) errors.push("normal summary must not expose auditLog");
  return { ok: errors.length === 0, errors };
}

export function summarizeCharacterV2RuntimeContext(context = {}) {
  return {
    available: context.available === true,
    characterId: context.characterId || "",
    displayName: context.displayName || "未命名角色",
    normalSummary: context.normalSummary || { title: context.displayName || "未命名角色", lines: [], safeForNormalUi: true },
    longTerm: context.longTerm ? {
      available: context.longTerm.available === true,
      memoryConfirmedCount: context.longTerm.memoryConfirmedCount || 0,
      canonConfirmedCount: context.longTerm.canonConfirmedCount || 0,
      relationshipLabel: context.longTerm.relationshipConfirmed?.label || context.longTerm.relationshipConfirmed?.baseline || ""
    } : { available: false, memoryConfirmedCount: 0, canonConfirmedCount: 0, relationshipLabel: "" },
    readOnly: true,
    llmInjectionEnabled: false
  };
}

export { RUNTIME_CONTEXT_SCHEMA_VERSION };
