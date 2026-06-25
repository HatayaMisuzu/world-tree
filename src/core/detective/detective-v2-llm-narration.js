// detective-v2-llm-narration.js
// Controlled LLM narration helpers for Detective V2.
// LLM only narrates public facts or drafts case blueprint. It never decides truth.

import { buildLLMTaskPrompt, parseJsonLoose } from "../prompts/llm-task-gateway.js";
import { sanitizeForLlm, sanitizeText, assertNoHiddenKeys } from "../prompts/prompt-hidden-sanitizer.js";

const DETECTIVE_FORBIDDEN_PUBLIC_KEYS = [
  "truthLedger",
  "hiddenMeaning",
  "deceptionReason",
  "isCulprit",
  "hiddenNotes",
  "solutionChain",
  "realTimeline"
];

export function publicDetectivePayload(value = {}) {
  const sanitized = sanitizeForLlm(value);
  return stripForbiddenDetectiveKeys(sanitized);
}

function stripForbiddenDetectiveKeys(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripForbiddenDetectiveKeys);
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (DETECTIVE_FORBIDDEN_PUBLIC_KEYS.includes(key)) continue;
    out[key] = stripForbiddenDetectiveKeys(child);
  }
  return out;
}

export function buildDetectiveInvestigationNarrationPrompt({ location = {}, discoveredEvidence = [], target = "" } = {}) {
  const publicPayload = publicDetectivePayload({ location, discoveredEvidence, target });
  const packet = buildLLMTaskPrompt({
    modeId: "mystery-puzzle",
    dataMode: "worldbook",
    worldSubType: "mystery-puzzle",
    taskId: "detective-investigation-narration",
    userInput: target || "调查当前地点",
    extraContext: publicPayload
  });

  return {
    ...packet,
    promptText: [
      packet.promptText,
      "",
      "【Detective Investigation Narration Rules】",
      "只把已公开地点信息和本次已发现证据写成玩家可见调查叙述。",
      "不得新增证据、不得提前揭露真相、不得解释 hiddenMeaning。",
      "如果没有发现新证据，也要给出自然但克制的调查反馈。",
      "输出中文正文，不要 JSON。",
      "",
      "【Public Payload】",
      JSON.stringify(publicPayload, null, 2)
    ].join("\n")
  };
}

export function buildDetectiveInterrogationPrompt({
  character = {},
  publicTestimonies = [],
  question = "",
  presentedEvidence = []
} = {}) {
  const publicPayload = publicDetectivePayload({ character, publicTestimonies, question, presentedEvidence });
  const packet = buildLLMTaskPrompt({
    modeId: "murder-mystery",
    dataMode: "worldbook",
    worldSubType: "murder-mystery",
    taskId: "detective-interrogation-response",
    userInput: question || "询问嫌疑人",
    extraContext: publicPayload
  });

  return {
    ...packet,
    promptText: [
      packet.promptText,
      "",
      "【Detective Interrogation Rules】",
      "你只扮演该角色基于公开证词能说出的回答。",
      "不得透露凶手身份、deceptionReason、hiddenNotes、truthLedger。",
      "不得新增证词或凭空承认罪行。",
      "如果问题触及角色不知道/不能说的信息，用角色口吻回避、紧张、含糊或要求证据。",
      "输出一段自然中文对话，可带少量动作描写。",
      "",
      "【Public Payload】",
      JSON.stringify(publicPayload, null, 2)
    ].join("\n")
  };
}

export function buildDetectiveCaseBlueprintPrompt({ premise = "", genre = "" } = {}) {
  const packet = buildLLMTaskPrompt({
    modeId: "murder-mystery",
    dataMode: "worldbook",
    worldSubType: "murder-mystery",
    taskId: "detective-case-blueprint",
    userInput: premise,
    extraContext: { genre }
  });

  return {
    ...packet,
    promptText: [
      packet.promptText,
      "",
      "【Detective Case Blueprint Rules】",
      "根据 premise 生成可验证的案件蓝图 JSON。",
      "不要声称已经保存或创建案件。",
      "必须包含足够调查路径，不要 speedrun 一问就破案。",
      "输出 JSON，不要 markdown。",
      "",
      "【Required JSON Shape】",
      JSON.stringify({
        title: "string",
        genre: "string",
        premise: "string",
        victim: { name: "string", publicDescription: "string" },
        suspects: [{ name: "string", publicRole: "string", motiveCandidate: "string", alibiClaim: "string" }],
        locations: [{ title: "string", publicDescription: "string", evidenceTitles: ["string"] }],
        evidence: [{ title: "string", publicText: "string", supports: ["string"], doesNotRevealDirectly: true }],
        truthDesign: { culprit: "string", method: "string", motive: "string", requiredEvidenceCount: 3 },
        fairnessNotes: ["string"]
      }, null, 2)
    ].join("\n")
  };
}

export function createDetectiveV2LlmClient({ callLLMByRole, config = {}, apiKey = "" } = {}) {
  async function callPrompt(role, prompt, options = {}) {
    if (!callLLMByRole || !apiKey) return "";
    const result = await callLLMByRole(role, prompt.promptText, config, apiKey, {
      temperature: prompt.contract.temperature,
      max_tokens: prompt.contract.maxTokens,
      ...(options || {})
    });
    return String(result?.parsedContent || result?.rawResponse || "").trim();
  }

  return {
    async narrateInvestigation(args = {}) {
      const prompt = buildDetectiveInvestigationNarrationPrompt(args);
      const text = await callPrompt("writer", prompt);
      return text || "";
    },

    async narrateInterrogation(args = {}) {
      const prompt = buildDetectiveInterrogationPrompt(args);
      const text = await callPrompt("writer", prompt);
      return text || "";
    },

    async generateCaseBlueprint(args = {}) {
      const prompt = buildDetectiveCaseBlueprintPrompt(args);
      const raw = await callPrompt("writer", prompt);
      const parsed = parseJsonLoose(raw);
      return parsed.ok ? parsed.value : null;
    }
  };
}

export function assertDetectiveLlmPayloadSafe(payload = {}) {
  const hidden = assertNoHiddenKeys(payload);
  const text = JSON.stringify(payload || {});
  const leaked = DETECTIVE_FORBIDDEN_PUBLIC_KEYS.filter((key) => text.includes(key));
  return { ok: hidden.ok && leaked.length === 0, hiddenKeys: hidden.hiddenKeys, leaked };
}
