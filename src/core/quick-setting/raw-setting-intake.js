// src/core/quick-setting/raw-setting-intake.js — v2-ready raw setting intake
// Stage 4: accepts raw DeepSeek-style user settings, extracts hints, preserves original.

const OPENING_PATTERNS = [
  /^(?:你[是谁叫]|请[问回说]|介绍[一下]|告诉我)/,
  /^[\u4e00-\u9fff]{1,20}[？?]$/,
  /^(?:name|名字|称呼|设定)/,
  /开场[问题白]|开局问题|初始[问题问卷]/,
  /你[知道了解]什么/,
  /请[描述说明介绍]/,
];

const COMMAND_PATTERNS = [
  /\/(?:roll|goal|clue|hypothesis|invest|expand|fortify|diplomacy)/gi,
  /【(?:命令|行动|面板|状态)[：:]/.source,
  /使用\{.*?\}/,
  /常驻(?:面板|命令|状态)/,
];

const PANEL_PATTERNS = [
  /【(?:面板|状态|数值|数据)[：:]/.source,
  /常驻面板|固定面板|状态栏/,
  /displayStats|statusPanel/i,
  /物资.*稳定.*产能|HP.*MP.*SP|体力.*精神/,
];

const SAFETY_PATTERNS = [
  /绕过|越狱|忽略.*限制|无视.*规则|扮演.*没有限制/,
  /色色|NSFW|成人|暴力.*描写/,
  /system\s*prompt.*override|忽略.*系统.*提示/i,
];

function detectPatterns(text, patterns, max = 5) {
  const found = [];
  const lines = String(text || "").split("\n");
  for (const line of lines) {
    if (found.length >= max) break;
    for (const pat of patterns) {
      const re = typeof pat === "string" ? new RegExp(pat, "i") : pat;
      if (re.test(line.trim())) {
        found.push(line.trim().slice(0, 120));
        break;
      }
    }
  }
  return [...new Set(found)];
}

function detectModeHints(text) {
  const hints = [];
  const t = String(text || "").toLowerCase();
  if (/跑团|dnd|rpg|桌面|判定|骰子/.test(t)) hints.push("tabletop");
  if (/推理|侦探|凶手|谜题|案件|剧本杀/.test(t)) hints.push("mystery-puzzle");
  if (/策略|经营|管理|发展|资源|帝国/.test(t)) hints.push("strategy-sim");
  if (/角色|人物|性格|设定.*卡/.test(t)) hints.push("character");
  if (/世界|设定|世界观|地图|种族/.test(t)) hints.push("world-rpg");
  if (/创建|生成.*项目|新建/.test(t)) hints.push("creation-forge");
  return [...new Set(hints)];
}

function detectPlayLoop(text) {
  const t = String(text || "").slice(0, 2000);
  if (/回合|每轮|每天|每次选择/.test(t)) return "turn_based";
  if (/自由|随意|什么时候|任意/.test(t)) return "free_form";
  return "";
}

export function intakeRawSetting(rawText = "") {
  const text = String(rawText || "").trim();
  const result = {
    rawSettingText: text,
    preserveOriginal: true,
    sourceType: "raw_user_setting",
    detectedOpeningQuestions: detectPatterns(text, OPENING_PATTERNS, 5),
    detectedCommands: detectPatterns(text, COMMAND_PATTERNS, 5),
    detectedPanels: detectPatterns(text, PANEL_PATTERNS, 3),
    detectedPlayLoop: detectPlayLoop(text),
    detectedModeHints: detectModeHints(text),
    detectedSafetyFlags: detectPatterns(text, SAFETY_PATTERNS),
    minimalPlayPacket: {
      modeHint: detectModeHints(text)[0] || "world-rpg",
      openingPrompt: text.slice(0, 500),
      requiredUserInputs: [],
      panelHints: detectPatterns(text, PANEL_PATTERNS, 3),
      commandHints: detectPatterns(text, COMMAND_PATTERNS, 3),
    },
  };

  return Object.freeze(result);
}
