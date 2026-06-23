import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "narrative.five_layer_engine";
const LEGACY_ID = "M13";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "叙事引擎五层",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const model = ctx.model || {};
      const selected = model.selected || null;
      const moduleData = ctx.moduleData || model.moduleData || {};
      const runtime = moduleData.runtime || {};
      const engineState = ctx.engineState || runtime.engineState || {};

      return createWrapperResult(ID, LEGACY_ID, {
        worldLoaded: Boolean(selected),
        dataMode: safeString(engineState.dataMode || model.dataMode, "unknown"),
        directorMode: safeString(engineState.directorMode, "hybrid"),
        storyteller: safeString(engineState.storyteller, "classic"),
        pipelineLayers: ["director", "writer", "guardian", "overlay", "persistence"],
        contextBudget: safeString(engineState.contextBudget, "balanced"),
        narrationPolicy: "third_person_preferred",
        turnTracking: Boolean(runtime.turnCount != null)
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 narrative.five_layer_engine / M13 叙事引擎五层】当前无法读取引擎状态。";
    const d = context.data;
    return truncateText([
      "【模块 narrative.five_layer_engine / M13 叙事引擎五层】",
      `数据模式：${d.dataMode}`,
      `Director 模式：${d.directorMode}`,
      `叙事者风格：${d.storyteller}`,
      `Pipeline：${d.pipelineLayers.join(" → ")}`,
      `上下文预算：${d.contextBudget}`
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/world-engine.js", context,
      context.ok ? `dataMode=${context.data.dataMode}; director=${context.data.directorMode}; pipeline=5_layers` : "unavailable");
  }
});

export default moduleWrapper;
