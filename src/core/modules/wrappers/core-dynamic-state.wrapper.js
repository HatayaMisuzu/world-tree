import {
  countObjectKeys,
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "core.dynamic_state";
const LEGACY_ID = "M3";

function emotionSummary(emotion = {}) {
  return Object.fromEntries(["engagement", "tension", "fatigue", "curiosity"]
    .filter((key) => Number.isFinite(Number(emotion?.[key])))
    .map((key) => [key, Number(emotion[key])]));
}

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "动态世界状态",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const livingState = ctx.livingWorldPacket?.worldState;
      if (livingState?.states) {
        return createWrapperResult(ID, LEGACY_ID, {
          scene: truncateText(ctx.livingWorldPacket?.scene?.title || "未记录", 160),
          time: truncateText(ctx.livingWorldPacket?.scene?.timeRef || "未记录", 120),
          variableCount: countObjectKeys(livingState.states), emotionState: {},
          turnCount: Number(ctx.turnId || 0), mode: safeString(ctx.modeId || ctx.options?.mode, "legacy")
        });
      }
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const worldState = moduleData.worldState || {};
      const runtime = moduleData.runtime || {};
      const engineState = ctx.engineState || runtime.engineState || {};
      const variables = worldState.variables || runtime.variables || engineState.variables || {};
      return createWrapperResult(ID, LEGACY_ID, {
        scene: truncateText(runtime.lastScene || worldState.currentLocation?.name || worldState.scene || engineState.sceneName || "未记录", 160),
        time: truncateText(worldState.currentTime || worldState.time || runtime.time || "未记录", 120),
        variableCount: countObjectKeys(variables),
        emotionState: emotionSummary(engineState.emotionState || runtime.emotionState || {}),
        turnCount: Number(runtime.turnCount ?? ctx.model?.turnCount ?? 0),
        mode: safeString(runtime.mode || runtime.modeMetadata?.mode || ctx.options?.mode, "legacy")
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 core.dynamic_state / M3 动态世界状态】当前无可用状态摘要。";
    const data = context.data;
    return truncateText([
      "【模块 core.dynamic_state / M3 动态世界状态】",
      `场景：${data.scene}`,
      `时间：${data.time}`,
      `回合：${data.turnCount}；变量：${data.variableCount}`,
      `情绪：${Object.entries(data.emotionState).map(([key, value]) => `${key}=${value}`).join(", ") || "未记录"}`
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/world-state.js", context,
      context.ok ? `turn=${context.data.turnCount}; scene=${context.data.scene}; variables=${context.data.variableCount}` : "unavailable");
  }
});

export default moduleWrapper;
