// tabletop-v2-llm-polish.js
// Optional LLM polish for Tabletop V2 narration.
// LLM must never decide roll/ruling/state.

import { buildLLMTaskPrompt } from "../prompts/llm-task-gateway.js";
import { sanitizeText } from "../prompts/prompt-hidden-sanitizer.js";

export function buildTabletopV2PolishPrompt({
  deterministicText = "",
  publicContext = {},
  constraints = {}
} = {}) {
  const packet = buildLLMTaskPrompt({
    modeId: "tabletop",
    dataMode: "worldbook",
    worldSubType: "tabletop",
    taskId: "tabletop-narration-polish",
    userInput: deterministicText,
    extraContext: {
      publicContext,
      constraints: {
        noReroll: true,
        noStateChange: true,
        noHiddenReveal: true,
        maxNewFacts: 0,
        ...constraints
      }
    }
  });

  return {
    ...packet,
    promptText: [
      packet.promptText,
      "",
      "【Tabletop V2 Polish Rules】",
      "你只能润色玩家可见叙事。",
      "不得改变投骰表达式、点数、结果、后果、场景、资源、线索或状态。",
      "不得新增 NPC 知识、隐藏线索、GM 真相或未来剧情。",
      "如果原文包含暗骰，只能写“暗骰已记录”或等价表达，不得猜测点数。",
      "输出自然中文正文，不要解释你改了什么。",
      "",
      "【Deterministic Narration To Polish】",
      sanitizeText(deterministicText, 3000)
    ].join("\n")
  };
}

export function createTabletopV2PolishClient({ callLLMByRole, config = {}, apiKey = "" } = {}) {
  return {
    async polish({ deterministicText = "", namespace = "tabletop-v2:llm", constraints = {}, publicContext = {} } = {}) {
      if (!callLLMByRole || !apiKey) return deterministicText;
      const prompt = buildTabletopV2PolishPrompt({ deterministicText, publicContext: { ...publicContext, namespace }, constraints });
      const result = await callLLMByRole("writer", prompt.promptText, config, apiKey, {
        temperature: prompt.contract.temperature,
        max_tokens: Math.min(prompt.contract.maxTokens, constraints.maxTokens || prompt.contract.maxTokens),
        orchestrationPrefix: "Tabletop V2 controlled narration polish. Do not alter ruling, dice, state, clues, or hidden information."
      });
      const text = String(result?.parsedContent || result?.rawResponse || "").trim();
      if (!text) return deterministicText;
      if (looksLikeRuleChange(text, deterministicText)) return deterministicText;
      return text;
    }
  };
}

export function looksLikeRuleChange(polished = "", original = "") {
  const p = String(polished || "");
  const o = String(original || "");
  const diceLike = /\b\d+d\d+\b|投骰|掷骰|暗骰|DC|成功|失败|大成功|大失败/i;
  if (diceLike.test(o)) {
    const originalDiceTerms = o.match(/\b\d+d\d+\b|暗骰|大成功|大失败|成功|失败/g) || [];
    for (const term of originalDiceTerms) {
      if (term && !p.includes(term)) return true;
    }
  }
  if (/新增线索|发现新线索|真相是|凶手是|hiddenTruth|truthLock/i.test(p)) return true;
  return false;
}
