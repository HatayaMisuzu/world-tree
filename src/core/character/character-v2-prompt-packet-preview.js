/**
 * Character Capsule V2 prompt packet preview.
 * Pure functions only: no LLM call, no prompt injection, no persistence.
 */

const PROMPT_PACKET_PREVIEW_SCHEMA_VERSION = "character-capsule.v2.prompt-packet-preview.1";

function asText(value) {
  return String(value ?? "").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clip(value, max = 600) {
  const text = asText(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function block(type, title, content, options = {}) {
  return {
    type,
    title,
    content,
    priority: options.priority || "normal",
    advancedOnly: options.advancedOnly === true,
    previewOnly: true
  };
}

export function buildCharacterV2PromptPacketPreview(runtimeContext = {}, options = {}) {
  const blocks = [];

  blocks.push(block(
    "role_identity",
    "角色身份",
    `${runtimeContext.displayName || "未命名角色"}：${runtimeContext.normalSummary?.subtitle || "Text-first 角色"}`,
    { priority: "high" }
  ));

  if (runtimeContext.runtimeContract) {
    blocks.push(block(
      "runtime_contract",
      "角色运行契约",
      [
        runtimeContext.runtimeContract.summary,
        ...asArray(runtimeContext.runtimeContract.outputGuidance).map(x => `- ${x}`),
        ...asArray(runtimeContext.runtimeContract.blocks).map(x => `禁止：${x}`)
      ].filter(Boolean).join("\n"),
      { priority: "high" }
    ));
  }

  if (runtimeContext.cognitionBoundary) {
    blocks.push(block(
      "cognition_boundary",
      "陪伴式常识认知",
      [
        runtimeContext.cognitionBoundary.summary,
        `默认可理解：${asArray(runtimeContext.cognitionBoundary.commonKnowledgeExamples).join("、")}`,
        `深度受限：${asArray(runtimeContext.cognitionBoundary.depthLimitedExamples).join("、")}`,
        `元技术阻断：${asArray(runtimeContext.cognitionBoundary.blockedMetaExamples).join("、")}`
      ].filter(Boolean).join("\n"),
      { priority: "high" }
    ));
  }

  if (runtimeContext.relationship) {
    blocks.push(block(
      "relationship_baseline",
      "关系基线",
      [
        runtimeContext.relationship.label || "熟悉但不过界的陪伴关系",
        `重大变化需确认：${asArray(runtimeContext.relationship.requiresConfirmationFor).join("、")}`
      ].filter(Boolean).join("\n"),
      { priority: "high" }
    ));
  }

  if (runtimeContext.performanceFingerprint) {
    blocks.push(block(
      "performance_fingerprint",
      "角色表现指纹",
      [
        `状态：${runtimeContext.performanceFingerprint.status || "seed"}`,
        `避免滥用：${asArray(runtimeContext.performanceFingerprint.overuseGuard).join("；")}`
      ].filter(Boolean).join("\n"),
      { priority: "normal" }
    ));
  }

  blocks.push(block(
    "safety_flags",
    "安全运行边界",
    "本包只生成预览，不启用 LLM 注入，不写 memory / relationship / canon / proposal。",
    { priority: "critical", advancedOnly: true }
  ));

  const packet = {
    schemaVersion: PROMPT_PACKET_PREVIEW_SCHEMA_VERSION,
    characterId: runtimeContext.characterId || "",
    displayName: runtimeContext.displayName || "未命名角色",
    previewOnly: true,
    readOnly: true,
    llmInjectionEnabled: false,
    mayWriteCanon: false,
    mayWriteProposal: false,
    mayWriteLongTermMemory: false,
    mayWriteRelationship: false,
    tokenBudgetHint: {
      mode: "preview_only",
      maxBlocks: Number(options.maxBlocks || 12),
      note: "This is not a live prompt budget."
    },
    blocks: blocks.slice(0, Number(options.maxBlocks || 12)),
    normalSummary: {
      title: "Prompt Packet Preview 已生成",
      subtitle: "仅用于高级预览，尚未注入 LLM。",
      safeForNormalUi: true
    }
  };

  return packet;
}

export function validateCharacterV2PromptPacketPreview(packet = {}) {
  const errors = [];
  if (packet.schemaVersion !== PROMPT_PACKET_PREVIEW_SCHEMA_VERSION) errors.push("schemaVersion mismatch");
  if (!packet.characterId) errors.push("missing characterId");
  if (packet.previewOnly !== true) errors.push("prompt packet preview must be previewOnly");
  if (packet.readOnly !== true) errors.push("prompt packet preview must be readOnly");
  if (packet.llmInjectionEnabled !== false) errors.push("V2-3 must not enable LLM injection");
  if (packet.mayWriteCanon || packet.mayWriteProposal || packet.mayWriteLongTermMemory || packet.mayWriteRelationship) {
    errors.push("prompt packet preview must not allow writes");
  }
  if (!Array.isArray(packet.blocks) || packet.blocks.length === 0) errors.push("missing prompt blocks");
  return { ok: errors.length === 0, errors };
}

export function summarizeCharacterV2PromptPacketPreview(packet = {}) {
  return {
    available: packet.schemaVersion === PROMPT_PACKET_PREVIEW_SCHEMA_VERSION,
    characterId: packet.characterId || "",
    displayName: packet.displayName || "未命名角色",
    blockCount: Array.isArray(packet.blocks) ? packet.blocks.length : 0,
    previewOnly: true,
    llmInjectionEnabled: false,
    safeForNormalUi: true
  };
}

export { PROMPT_PACKET_PREVIEW_SCHEMA_VERSION };
