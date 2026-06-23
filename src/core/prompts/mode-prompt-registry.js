// mode-prompt-registry.js — Upgraded with Prompt Orchestration Layer v1
// Backward-compatible: old API preserved, new orchestrator available

import { buildPromptOrchestrationPacket } from "./prompt-builder.js";
import { resolveBlocks } from "./prompt-blocks.js";

// ── Legacy profiles (kept for backward compat) ──
const PROFILES = {
  "grand_world_v1": { profileId: "grand_world_v1", modeId: "world-rpg", modeMeaning: "grand_world", rules: ["不得硬套等级/职业/装备/经验值/打怪升级", "输出grand_world_output_packet_v1", "重大变化走pending proposal", "保持探索感/事件推进/关系反馈/阶段感"] },
  "character_v1": { profileId: "character_v1", modeId: "character", modeMeaning: "character", rules: ["保持角色设定/表达风格/人物边界", "输出character_output_packet_v1", "不可随意改写核心设定"] },
  "tabletop_v1": { profileId: "tabletop_v1", modeId: "tabletop", modeMeaning: "solo_tabletop_narrative", rules: ["用户是唯一真实玩家", "AI扮演主持人/NPC/轻量裁判", "可做轻量检定/失败代价/时钟", "不做完整DND"] },
  "mystery_puzzle_v1": { profileId: "mystery_puzzle_v1", modeId: "mystery-puzzle", modeMeaning: "solo_mystery_puzzle", rules: ["不得直接泄露答案锁", "提示必须分级", "输出mystery_puzzle_output_packet_v1"] },
  "strategy_sim_v1": { profileId: "strategy_sim_v1", modeId: "strategy-sim", modeMeaning: "solo_strategy_sim", rules: ["AI模拟其他阵营", "资源/回合/外交结构化", "不做复杂4X", "输出strategy_sim_output_packet_v1"] },
  "murder_mystery_v1": { profileId: "murder_mystery_v1", modeId: "murder-mystery", modeMeaning: "solo_murder_mystery", rules: ["真相锁system_only", "嫌疑人只知自己信息", "输出murder_mystery_output_packet_v1"] },
  "creation_forge_v1": { profileId: "creation_forge_v1", modeId: "creation-forge", modeMeaning: "artifact_factory", rules: ["你是资产生产工厂", "未经确认不创建项目", "输出creation_forge_output_packet_v1"] },
  "quick_setting_v1": { profileId: "quick_setting_v1", modeId: "quick-setting", modeMeaning: "quick_setting", rules: ["保持简洁", "输出quick_setting_output_packet_v1"] }
};

const GLOBAL_RULES = ["你是World Tree模式执行器", "不得把草稿当正史", "不得直接修改shared真相源", "涉及世界状态/关系/时间线/真相/答案锁时生成pending proposal", "不得泄露隐藏信息"];

// ── Legacy API (backward compat) ──
export function listModePromptProfiles() { return Object.values(PROFILES).map(p => ({ profileId: p.profileId, modeId: p.modeId })); }
export function getModePromptProfile(profileId) { return PROFILES[profileId] ? { ...PROFILES[profileId], globalRules: GLOBAL_RULES } : null; }
export function hasModePromptProfile(profileId) { return Boolean(PROFILES[profileId]); }

export function buildModePrompt(inputPacket = {}, options = {}) {
  const profile = getModePromptProfile(options.profileId || "grand_world_v1");
  if (!profile) return "";
  return [...profile.globalRules, ...(profile.rules || []), `用户输入: ${inputPacket.userInput?.text || ""}`].join("\n");
}

/**
 * Safe prompt builder. Now delegates to orchestrator for richer output.
 * Falls back to legacy if orchestrator fails.
 */
export function buildModePromptResult(inputPacket = {}, options = {}) {
  const profileId = options.profileId || "";
  const profile = getModePromptProfile(profileId);
  if (!profile) {
    return { ok: false, prompt: "", errors: [{ code: "PROMPT_PROFILE_MISSING", profileId }] };
  }
  // Try orchestrator first
  try {
    const packet = buildPromptOrchestrationPacket({
      modeId: profile.modeId,
      taskId: "writer",
      userInput: inputPacket.userInput?.text || "",
      generationType: "normal"
    });
    if (packet.ok && packet.promptText) {
      return { ok: true, prompt: packet.promptText, profileId, orchestrated: true, debug: packet.debug };
    }
  } catch { /* fall through to legacy */ }
  // Legacy fallback
  return {
    ok: true,
    prompt: [...GLOBAL_RULES, ...(profile.rules || []), `用户输入: ${inputPacket.userInput?.text || ""}`].join("\n"),
    profileId
  };
}

export function validateModePromptProfile(profile = {}) { return { ok: Boolean(profile.profileId && profile.modeId), errors: profile.profileId ? [] : ["missing profileId"] }; }

// ── New Orchestration API ──
export function getOrchestratedPrompt(modeId, taskId = "writer", userInput = "", generationType = "normal") {
  return buildPromptOrchestrationPacket({ modeId, taskId, userInput, generationType });
}

export function getModeBlocks(modeId) {
  return resolveBlocks({ modeId, taskId: "" });
}

export { PROFILES as MODE_PROFILES };
