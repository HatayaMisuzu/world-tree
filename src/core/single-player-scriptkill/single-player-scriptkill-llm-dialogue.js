// single-player-scriptkill-llm-dialogue.js
// Controlled LLM dialogue for simulated players.
// LLM never receives full hidden book unless already allowed by knowledge boundary.

import { buildLLMTaskPrompt } from "../prompts/llm-task-gateway.js";
import { sanitizeForLlm, sanitizeText } from "../prompts/prompt-hidden-sanitizer.js";

export function buildScriptKillSpeechPrompt({
  role = {},
  simulatedPlayer = {},
  boundary = {},
  userText = "",
  channel = "public",
  phase = null,
  publicContext = {}
} = {}) {
  const taskId = channel === "private" ? "scriptkill-private-talk" : "scriptkill-public-talk";
  const publicPayload = sanitizeForLlm({
    role: publicRoleView(role),
    simulatedPlayer: publicPlayerView(simulatedPlayer),
    boundary,
    userText,
    channel,
    phase: phase ? { phaseId: phase.phaseId, title: phase.title || phase.name || "" } : null,
    publicContext
  });

  const packet = buildLLMTaskPrompt({
    modeId: "murder-mystery",
    dataMode: "worldbook",
    worldSubType: "murder-mystery",
    taskId,
    userInput: userText || "公开发言",
    extraContext: publicPayload
  });

  return {
    ...packet,
    promptText: [
      packet.promptText,
      "",
      "【Single Player ScriptKill Simulated Speech Rules】",
      "你只扮演当前模拟玩家的角色发言。",
      "只能使用 knowledge boundary 允许的信息。",
      "不得透露未公开线索、私密角色本、最终真相、系统字段。",
      "不得替真实玩家行动，不得推进阶段，不得交换线索。",
      "输出一句到一小段自然中文发言，不要 JSON。",
      "",
      "【Public Payload】",
      JSON.stringify(publicPayload, null, 2)
    ].join("\n")
  };
}

function publicRoleView(role = {}) {
  return {
    roleId: role.roleId,
    roleName: role.roleName,
    publicPersona: role.publicPersona || role.description || "",
    publicGoal: role.publicGoal || "",
    knownPublicFacts: role.knownPublicFacts || []
  };
}

function publicPlayerView(player = {}) {
  return {
    assignedRoleId: player.assignedRoleId,
    visibleName: player.visibleName,
    playerStyle: player.playerStyle
  };
}

export function createScriptKillLlmDialogueClient({ callLLMByRole, config = {}, apiKey = "" } = {}) {
  return {
    async speak(args = {}) {
      if (!callLLMByRole || !apiKey) return "";
      const prompt = buildScriptKillSpeechPrompt(args);
      const result = await callLLMByRole("writer", prompt.promptText, config, apiKey, {
        temperature: prompt.contract.temperature,
        max_tokens: prompt.contract.maxTokens,
        orchestrationPrefix: "Single-player ScriptKill controlled simulated speech. Do not reveal hidden role book, truth, unopened clues, or system details."
      });
      return sanitizeText(result?.parsedContent || result?.rawResponse || "", 1200).trim();
    }
  };
}
