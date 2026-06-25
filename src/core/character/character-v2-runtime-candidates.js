/**
 * Character Capsule V2 runtime candidate hooks.
 * Pure functions only: candidates are suggestions, never writes.
 */

const RUNTIME_CANDIDATE_SCHEMA_VERSION = "character-capsule.v2.runtime-candidates.1";

function asText(value) {
  return String(value ?? "").trim();
}

function clip(value, max = 260) {
  const text = asText(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function makeCandidate(kind, reason, payload = {}, confidence = "low") {
  return {
    kind,
    reason,
    payload,
    confidence,
    status: "candidate",
    requiresUserConfirmation: true,
    autoWrite: false
  };
}

export function buildCharacterV2RuntimeCandidates(input = {}) {
  const userInput = asText(input.userInput);
  const assistantDraft = asText(input.assistantDraft);
  const runtimeContext = input.runtimeContext || {};
  const text = `${userInput}\n${assistantDraft}`;

  const memoryCandidates = [];
  const relationshipCandidates = [];
  const qualityCandidates = [];

  if (/记住|以后|别忘|我叫|我的名字|我喜欢|我不喜欢/.test(text)) {
    memoryCandidates.push(makeCandidate(
      "memory",
      "对话中出现可能值得记住的信息。",
      {
        excerpt: clip(text),
        characterId: runtimeContext.characterId || "",
        note: "仅生成候选，不写长期记忆。"
      },
      "medium"
    ));
  }

  if (/信任|喜欢你|讨厌你|关系|朋友|恋人|依赖|亲近|疏远|生气/.test(text)) {
    relationshipCandidates.push(makeCandidate(
      "relationship",
      "对话中出现可能影响关系阶段或态度的信息。",
      {
        excerpt: clip(text),
        baseline: runtimeContext.relationship?.baseline || "familiar_companion",
        note: "重大关系变化必须用户确认。"
      },
      "medium"
    ));
  }

  if (/作为AI|大模型|DeepSeek|ChatGPT|prompt|token|API|系统提示词|模块调用/.test(text)) {
    qualityCandidates.push(makeCandidate(
      "quality",
      "检测到可能导致角色跳出身份或暴露元技术的问题。",
      {
        issueType: "meta_or_ooc_risk",
        excerpt: clip(text),
        recommendedAction: "保持角色口吻转开，不暴露系统/模型/模块。"
      },
      "high"
    ));
  }

  return {
    schemaVersion: RUNTIME_CANDIDATE_SCHEMA_VERSION,
    characterId: runtimeContext.characterId || "",
    previewOnly: true,
    readOnly: true,
    autoWrite: false,
    mayWriteCanon: false,
    mayWriteProposal: false,
    mayWriteLongTermMemory: false,
    mayWriteRelationship: false,
    memoryCandidates,
    relationshipCandidates,
    qualityCandidates,
    normalSummary: {
      title: "候选系统已就绪",
      subtitle: "仅检测候选，不自动写入。",
      counts: {
        memory: memoryCandidates.length,
        relationship: relationshipCandidates.length,
        quality: qualityCandidates.length
      },
      safeForNormalUi: true
    },
    advancedOnly: {
      candidateDetailsVisibleOnlyWhenAdvancedOpen: true
    }
  };
}

export function validateCharacterV2RuntimeCandidates(envelope = {}) {
  const errors = [];
  if (envelope.schemaVersion !== RUNTIME_CANDIDATE_SCHEMA_VERSION) errors.push("schemaVersion mismatch");
  if (envelope.previewOnly !== true) errors.push("candidate envelope must be previewOnly");
  if (envelope.readOnly !== true) errors.push("candidate envelope must be readOnly");
  if (envelope.autoWrite !== false) errors.push("candidate envelope must not autoWrite");
  if (envelope.mayWriteCanon || envelope.mayWriteProposal || envelope.mayWriteLongTermMemory || envelope.mayWriteRelationship) {
    errors.push("candidate envelope must not allow writes");
  }
  for (const list of [envelope.memoryCandidates, envelope.relationshipCandidates, envelope.qualityCandidates]) {
    if (!Array.isArray(list)) errors.push("candidate lists must be arrays");
    else if (list.some(c => c.autoWrite !== false || c.requiresUserConfirmation !== true)) {
      errors.push("all candidates must require user confirmation and forbid autoWrite");
    }
  }
  return { ok: errors.length === 0, errors };
}

export { RUNTIME_CANDIDATE_SCHEMA_VERSION };
