import { createForgeInput } from "./creation-forge-schema.js";

const TARGET_SIGNALS = {
  character: ["角色", "人物", "性格", "persona", "first_mes"],
  worldbook: ["世界", "设定", "world", "lore", "大陆", "魔法", "科技"],
  tabletop: ["跑团", "骰子", "检定", "桌游", "主持人", "trpg"],
  "mystery-puzzle": ["谜题", "解谜", "推理", "线索", "谜底"],
  "strategy-sim": ["策略", "阵营", "资源", "回合", "外交", "战争"],
  "murder-mystery": ["剧本杀", "案件", "凶手", "嫌疑人", "证词", "真相"],
};

export function analyzeForgeInput(input = {}, options = {}) {
  const result = createForgeInput(input);
  const text = (input.text || "").toLowerCase();
  for (const [type, signals] of Object.entries(TARGET_SIGNALS)) {
    if (signals.some(s => text.includes(s))) result.detectedTargets.push(type);
  }
  if (result.detectedTargets.length === 0) result.detectedTargets = ["worldbook"];
  result.confidence = result.detectedTargets.length > 1 ? "medium" : "low";
  result.userIntentSummary = `分析输入: ${(input.text||"").slice(0, 50)}`;
  return result;
}

export function detectForgeTargets(input = {}, options = {}) {
  return analyzeForgeInput(input, options).detectedTargets;
}

export function createForgeIntakeSummary(input = {}, options = {}) {
  const intake = analyzeForgeInput(input, options);
  return { targets: intake.detectedTargets, confidence: intake.confidence };
}
