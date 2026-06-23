import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "core.world_container";
const LEGACY_ID = "M1";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "世界书隔离容器",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const model = ctx.model || {};
      const selected = model.selected || null;
      const moduleData = ctx.moduleData || model.moduleData || {};
      const runtime = moduleData.runtime || {};
      const engineState = ctx.engineState || runtime.engineState || {};
      const modeMetadata = runtime.modeMetadata || ctx.options?.modeMetadata || {};
      return createWrapperResult(ID, LEGACY_ID, {
        selected: Boolean(selected),
        worldId: safeString(selected?.id),
        title: truncateText(selected?.displayName || selected?.title || selected?.name || selected?.id || "未选择项目", 160),
        branch: truncateText(selected?.branch || runtime.activeBranch || engineState.activeBranch || "main", 80),
        dataMode: safeString(engineState.dataMode || modeMetadata.dataMode || model.dataMode, "unknown"),
        mode: safeString(runtime.mode || modeMetadata.mode || ctx.options?.mode, "legacy")
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 core.world_container / M1 世界书隔离容器】当前无法读取项目摘要。";
    const data = context.data;
    return truncateText([
      "【模块 core.world_container / M1 世界书隔离容器】",
      `当前项目：${data.title}`,
      `分支：${data.branch}`,
      `数据模式：${data.dataMode}`,
      `世界模式：${data.mode}`
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/world-engine.js", context,
      context.ok ? `selected=${context.data.selected}; mode=${context.data.mode}; dataMode=${context.data.dataMode}` : "unavailable");
  }
});

export default moduleWrapper;
