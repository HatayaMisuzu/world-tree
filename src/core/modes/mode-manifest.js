export const MODE_STATUS = Object.freeze({
  ACTIVE: "active",
  HIDDEN: "hidden",
  PLANNED: "planned",
  INTERNAL: "internal"
});

function mode(id, name, description, status, extra) {
  return Object.freeze({
    id,
    name,
    description,
    status,
    playerRole: extra.playerRole,
    aiRole: extra.aiRole,
    basedOn: extra.basedOn,
    dataModeHint: extra.dataModeHint,
    worldSubTypeHint: extra.worldSubTypeHint,
    defaultVisibility: false,
    notes: extra.notes || "架构声明；本阶段不创建 UI 入口。"
  });
}

export const MODE_MANIFEST = Object.freeze({
  "quick-setting": mode("quick-setting", "预设 / 设定", "用少量设定快速启动叙事。", MODE_STATUS.PLANNED, {
    playerRole: "设定提供者与行动者", aiRole: "轻量故事协作者", basedOn: ["preset"], dataModeHint: "preset", worldSubTypeHint: "classic"
  }),
  character: mode("character", "人物卡", "以人物持续互动为核心。", MODE_STATUS.PLANNED, {
    playerRole: "对话参与者", aiRole: "角色扮演者", basedOn: ["character_card"], dataModeHint: "character_card", worldSubTypeHint: "classic"
  }),
  "murder-mystery": mode("murder-mystery", "剧本杀", "案件、证词与推理阶段协议。", MODE_STATUS.HIDDEN, {
    playerRole: "案件参与者", aiRole: "主持人与信息分发者", basedOn: ["murder-mystery"], dataModeHint: "worldbook", worldSubTypeHint: "murder-mystery"
  }),
  tabletop: mode("tabletop", "跑团", "规则、检定与团务会话协议。", MODE_STATUS.HIDDEN, {
    playerRole: "玩家角色", aiRole: "跑团主持人", basedOn: ["tabletop"], dataModeHint: "worldbook", worldSubTypeHint: "tabletop"
  }),
  "mystery-puzzle": mode("mystery-puzzle", "解密 / 推理", "场景谜题与线索推理协议。", MODE_STATUS.PLANNED, {
    playerRole: "调查者", aiRole: "谜题主持人", basedOn: [], dataModeHint: "worldbook", worldSubTypeHint: "mystery-puzzle"
  }),
  "world-rpg": mode("world-rpg", "世界书 / RPG", "持续世界、任务、关系与成长协议。", MODE_STATUS.PLANNED, {
    playerRole: "世界中的行动者", aiRole: "世界叙事 DM", basedOn: ["worldbook", "rpg"], dataModeHint: "worldbook", worldSubTypeHint: "rpg"
  }),
  "strategy-sim": mode("strategy-sim", "模拟经营 / 策略", "资源、势力、决策与回合推进协议。", MODE_STATUS.HIDDEN, {
    playerRole: "管理者与决策者", aiRole: "模拟裁判", basedOn: ["sim"], dataModeHint: "worldbook", worldSubTypeHint: "sim"
  }),
  "creation-forge": mode("creation-forge", "创作模式 / 炼金台", "素材提取、整理与世界构建协议。", MODE_STATUS.PLANNED, {
    playerRole: "创作者", aiRole: "结构化创作协作者", basedOn: ["M-创作"], dataModeHint: "worldbook", worldSubTypeHint: "classic"
  })
});

export function getMode(modeId) {
  return MODE_MANIFEST[modeId] || null;
}

export function listModes(options = {}) {
  const status = typeof options.status === "string" ? options.status : null;
  const visibleOnly = options.visibleOnly === true;
  return Object.values(MODE_MANIFEST).filter((entry) => {
    if (status && entry.status !== status) return false;
    return !visibleOnly || isModeVisible(entry.id);
  });
}

export function isModeVisible(modeId) {
  const entry = getMode(modeId);
  return Boolean(entry && entry.status === MODE_STATUS.ACTIVE && entry.defaultVisibility === true);
}
