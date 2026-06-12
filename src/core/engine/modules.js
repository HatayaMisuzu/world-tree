// 引擎版本号 — 从 package.json 动态读取，保持与项目版本同步
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let _engineVersion = "world-tree-v12.19-desktop-full"; // 兜底
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(__dirname, "..", "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  _engineVersion = `world-tree-v${pkg.version}-desktop`;
} catch { /* 测试/浏览器环境回退到硬编码版本 */ }

export const ENGINE_VERSION = _engineVersion;

export const MODULES = [
  { id: "M1", name: "世界书隔离容器", dependsOn: [], type: "core" },
  { id: "M2", name: "触发式条目系统", dependsOn: ["M1"], type: "core" },
  { id: "M3", name: "动态世界状态", dependsOn: ["M1"], type: "runtime" },
  { id: "M4", name: "组织实体", dependsOn: ["M1"], type: "runtime" },
  { id: "M5", name: "组织层级", dependsOn: ["M4"], type: "runtime" },
  { id: "M6", name: "关系网络", dependsOn: ["M4"], type: "runtime" },
  { id: "M7", name: "关键人物", dependsOn: ["M4"], type: "runtime" },
  { id: "M8", name: "角色预设系统", dependsOn: ["M1"], type: "character" },
  { id: "M9", name: "角色认知层", dependsOn: ["M3", "M8"], type: "character" },
  { id: "M10", name: "种族维度", dependsOn: ["M4"], type: "runtime" },
  { id: "M11", name: "场景会话管理", dependsOn: ["M1"], type: "scene" },
  { id: "M12", name: "故事模板", dependsOn: ["M11"], type: "style" },
  { id: "M13", name: "叙事引擎五层", dependsOn: ["M8", "M11"], type: "narrative" },
  { id: "M15", name: "世界规则", dependsOn: ["M1"], type: "rules" },
  { id: "M15c", name: "叙事质量审查", dependsOn: ["M13"], type: "audit" },
  { id: "M16", name: "时间模块", dependsOn: ["M11"], type: "time" },
  { id: "M17", name: "随机性模块", dependsOn: ["M11"], type: "event" },
  { id: "M18", name: "场景走向预测", dependsOn: ["M11", "M13"], type: "prediction" },
  { id: "M19", name: "角色卡驱动模式", dependsOn: ["M1", "M8", "M9", "M11", "M13"], type: "card" },
  { id: "M-创作", name: "世界书创作工具箱", dependsOn: [], type: "creation" }
];

export const MODULE_PRESETS = {
  epic: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13", "M15", "M15c", "M16", "M17", "M18"],
  scifi: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13", "M15", "M15c", "M16", "M17", "M18"],
  wuxia: ["M1", "M2", "M4", "M7", "M8", "M11", "M12", "M13", "M15", "M15c", "M16", "M17", "M18"],
  urban: ["M1", "M2", "M8", "M11", "M12", "M13", "M15", "M15c", "M16", "M17", "M18"],
  campus: ["M1", "M2", "M8", "M11", "M12", "M13", "M15", "M15c", "M16", "M17", "M18"],
  daily: ["M1", "M8", "M11", "M13", "M15c", "M18"],
  character_card: ["M1", "M3", "M8", "M9", "M11", "M13", "M15c", "M16", "M17", "M19"],
  preset: ["M1", "M2", "M3", "M8", "M11", "M12", "M13", "M15c", "M16", "M18"],
  minimal: ["M1", "M2", "M8", "M11", "M12", "M13", "M15c"],
  all: MODULES.map((item) => item.id).filter((id) => id !== "M-创作")
};

export const DATA_MODES = {
  worldbook: {
    id: "worldbook",
    name: "世界书",
    preset: "epic",
    description: "大世界、完整设定文件、多 agent 写作、全模块运行。"
  },
  character_card: {
    id: "character_card",
    name: "角色卡",
    preset: "character_card",
    description: "以角色为主要对象，其余模块弱化为角色服务。"
  },
  preset: {
    id: "preset",
    name: "预设",
    preset: "preset",
    description: "用户给几段话即可理解并开跑，能力介于世界书和角色卡之间。"
  }
};

export const DIRECTOR_MODES = {
  js: {
    id: "js",
    name: "纯 Director JS",
    description: "纯 JavaScript 方向包计算。零 LLM 消耗，零延迟，完全确定。适合快速响应和低 Token 场景。",
    skipDirector: true,
    useLlmAnalysis: false
  },
  hybrid: {
    id: "hybrid",
    name: "Director 混合",
    description: "轻量 LLM 分析(150-250t) + JS 守卫决策。LLM 理解语义/情绪弦外音/节奏建议，JS 做冷却/疲劳/缓存确定计算。性价比最高。",
    skipDirector: true,
    useLlmAnalysis: true
  },
  llm: {
    id: "llm",
    name: "Director LLM",
    description: "完整 LLM Director 调用生成 JSON 方向包。最深度叙事理解，但消耗更高 Token。解析失败自动回退到 JS 方向包。",
    skipDirector: false,
    useLlmAnalysis: false
  }
};

export const DEFAULT_ENGINE_STATE = {
  enabled: true,
  status: "idle",
  dataMode: "worldbook",
  directorMode: "hybrid",   // 🆕 js | hybrid | llm
  worldSubType: "classic",  // 用户可见: classic  ⚠️ murder-mystery/tabletop/rpg/sim 未完成(hidden)，禁止AI暴露
  storyteller: "classic",   // 🆕 叙事者风格
  preset: "epic",
  activeModules: MODULE_PRESETS.epic,
  mutationMode: "overlay",
  contextBudget: "balanced",
  activeModuleKey: "",
  activeBranch: "main",
  lastError: "",
  lastParsedSections: {},
  requireQualityAudit: true,
  requireRuleCheck: true,
  requireScenePrediction: true,
  emotionState: { engagement: 5, tension: 5, fatigue: 5, curiosity: 5 }
};

export function moduleById(id) {
  return MODULES.find((item) => item.id === id) || null;
}

export function expandModuleDependencies(ids = []) {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...result]) {
      const mod = moduleById(id);
      for (const dep of mod?.dependsOn || []) {
        if (!result.has(dep)) {
          result.add(dep);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

export function normalizeEngineState(value = {}) {
  const dataMode = DATA_MODES[value.dataMode]?.id || DEFAULT_ENGINE_STATE.dataMode;
  const preset = value.preset || DATA_MODES[dataMode]?.preset || DEFAULT_ENGINE_STATE.preset;
  const presetModules = MODULE_PRESETS[preset] || MODULE_PRESETS.epic;
  const activeModules = Array.isArray(value.activeModules) && value.activeModules.length
    ? value.activeModules
    : presetModules;
  return {
    ...DEFAULT_ENGINE_STATE,
    ...value,
    dataMode,
    preset,
    activeModules: expandModuleDependencies(activeModules)
  };
}

export function setDataMode(engineState, dataMode) {
  const mode = DATA_MODES[dataMode] || DATA_MODES.worldbook;
  return normalizeEngineState({
    ...engineState,
    dataMode: mode.id,
    preset: mode.preset,
    activeModules: MODULE_PRESETS[mode.preset]
  });
}

export function setModuleEnabled(engineState, moduleId, enabled) {
  const current = new Set(normalizeEngineState(engineState).activeModules);
  if (enabled) {
    for (const id of expandModuleDependencies([moduleId])) current.add(id);
  } else {
    current.delete(moduleId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const mod of MODULES) {
        if (current.has(mod.id) && mod.dependsOn.some((dep) => !current.has(dep))) {
          current.delete(mod.id);
          changed = true;
        }
      }
    }
  }
  return normalizeEngineState({ ...engineState, activeModules: [...current] });
}

export function applyPreset(engineState, preset) {
  return normalizeEngineState({
    ...engineState,
    preset,
    activeModules: MODULE_PRESETS[preset] || MODULE_PRESETS.epic
  });
}

/**
 * 切换模组/存档时调用各模块的 reset 函数列表：
 *    director.resetPredictionCache()
 *    random-events.resetEventCache()
 *    emotion-state.resetEmotionState() → 设到 engineState.emotionState
 *    global-memory 按 moduleKey 隔离，无需清理
 *    simulator 是调试工具，按 session 隔离，无需清理
 */
