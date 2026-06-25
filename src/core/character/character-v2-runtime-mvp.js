/**
 * Character Capsule V2 Runtime MVP.
 * Combines runtime context, prompt preview, first-turn scaffold, and candidate hooks.
 */

import {
  buildCharacterV2PromptPacketPreview,
  validateCharacterV2PromptPacketPreview,
  summarizeCharacterV2PromptPacketPreview
} from "./character-v2-prompt-packet-preview.js";

import {
  buildCharacterV2RuntimeCandidates,
  validateCharacterV2RuntimeCandidates
} from "./character-v2-runtime-candidates.js";

const RUNTIME_MVP_SCHEMA_VERSION = "character-capsule.v2.runtime-mvp.1";

function asText(value) {
  return String(value ?? "").trim();
}

function clip(value, max = 260) {
  const text = asText(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function buildCharacterV2FirstTurnDraftTemplate(runtimeContext = {}, options = {}) {
  const displayName = runtimeContext.displayName || "角色";
  return {
    previewOnly: true,
    llmInjectionEnabled: false,
    characterId: runtimeContext.characterId || "",
    displayName,
    template: [
      `以「${displayName}」的角色身份回应。`,
      "保持熟悉但不过界的陪伴关系。",
      "理解用户日常常识，但不要装懂冷门/专业/元技术问题。",
      "可包含少量动作、神态、停顿；避免重复动作和口癖。",
      "如果用户询问模型、prompt、token、API、模块等，以角色口吻自然转开。"
    ],
    inputSlots: {
      userInput: options.userInput || "",
      sceneHint: options.sceneHint || "",
      relationshipHint: runtimeContext.relationship?.label || "熟悉但不过界的陪伴关系"
    },
    note: "This is a draft scaffold only, not generated character dialogue."
  };
}

export function buildCharacterV2RuntimeMvp(runtimeContext = {}, options = {}) {
  const promptPacketPreview = buildCharacterV2PromptPacketPreview(runtimeContext, options);
  const promptValidation = validateCharacterV2PromptPacketPreview(promptPacketPreview);
  const firstTurnDraftTemplate = buildCharacterV2FirstTurnDraftTemplate(runtimeContext, options);
  const candidates = buildCharacterV2RuntimeCandidates({
    runtimeContext,
    userInput: options.userInput || "",
    assistantDraft: options.assistantDraft || ""
  });
  const candidateValidation = validateCharacterV2RuntimeCandidates(candidates);

  const errors = [
    ...promptValidation.errors,
    ...candidateValidation.errors
  ];

  return {
    schemaVersion: RUNTIME_MVP_SCHEMA_VERSION,
    available: runtimeContext.available === true && errors.length === 0,
    characterId: runtimeContext.characterId || "",
    displayName: runtimeContext.displayName || "未命名角色",
    previewOnly: true,
    readOnly: true,
    llmInjectionEnabled: false,
    mayWriteCanon: false,
    mayWriteProposal: false,
    mayWriteLongTermMemory: false,
    mayWriteRelationship: false,
    runtimeContextSummary: {
      available: runtimeContext.available === true,
      readOnly: runtimeContext.readOnly === true,
      llmInjectionEnabled: false
    },
    promptPacketPreview,
    promptPacketSummary: summarizeCharacterV2PromptPacketPreview(promptPacketPreview),
    firstTurnDraftTemplate,
    candidates,
    normalSummary: {
      title: "Character Runtime MVP 已就绪",
      subtitle: `${runtimeContext.displayName || "角色"} 可以进入 V2 运行准备状态。`,
      badges: ["Runtime MVP", "Preview-only", "未注入 LLM"],
      lines: [
        "Prompt Packet Preview：已生成，仅高级可见",
        "First-turn Draft Template：已生成，仅作为草案骨架",
        "Memory / Relationship / Quality Candidate Hooks：已就绪但不自动写入",
        "安全边界：不写 canon/proposal/memory/relationship"
      ],
      safeForNormalUi: true
    },
    advancedSummary: {
      hiddenFromNormalUi: true,
      promptPreviewAvailable: true,
      candidateHooksAvailable: true,
      firstTurnTemplateAvailable: true,
      errors
    }
  };
}

export function validateCharacterV2RuntimeMvp(mvp = {}) {
  const errors = [];
  if (mvp.schemaVersion !== RUNTIME_MVP_SCHEMA_VERSION) errors.push("runtime MVP schemaVersion mismatch");
  if (!mvp.characterId) errors.push("missing characterId");
  if (mvp.previewOnly !== true) errors.push("runtime MVP must be previewOnly");
  if (mvp.readOnly !== true) errors.push("runtime MVP must be readOnly");
  if (mvp.llmInjectionEnabled !== false) errors.push("V2-3 must not enable LLM injection");
  if (mvp.mayWriteCanon || mvp.mayWriteProposal || mvp.mayWriteLongTermMemory || mvp.mayWriteRelationship) {
    errors.push("runtime MVP must not allow writes");
  }
  if (mvp.normalSummary?.safeForNormalUi !== true) errors.push("normal summary must be safe");
  if (mvp.advancedSummary?.hiddenFromNormalUi !== true) errors.push("advanced summary must be hidden from normal UI");
  return { ok: errors.length === 0, errors };
}

export { RUNTIME_MVP_SCHEMA_VERSION };
