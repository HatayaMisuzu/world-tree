import { getContextWindow } from "../../data/scenes.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeArray,
  truncateText
} from "../wrapper-utils.js";

const ID = "scene.session";
const LEGACY_ID = "M11";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "场景会话管理",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const runtime = moduleData.runtime || {};
      const scenes = safeArray(moduleData.scenes);
      const recentEvents = safeArray(moduleData.recentEvents || runtime.recentEvents);
      const window = getContextWindow({ scenes }, { sceneCount: Number(ctx.options?.sceneCount || 3) });
      const current = runtime.lastScene || scenes[0]?.title || scenes[0]?.name || "未记录";
      return createWrapperResult(ID, LEGACY_ID, {
        currentScene: truncateText(current, 160),
        sceneCount: scenes.length,
        recentEventCount: recentEvents.length,
        contextWindow: safeArray(window).slice(0, 3).map((scene) => ({
          id: truncateText(scene.id || "", 80),
          title: truncateText(scene.title || scene.name || "未命名场景", 140),
          summary: truncateText(scene.summary || scene.description || "", 240)
        }))
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 scene.session / M11 场景会话管理】当前无法读取场景摘要。";
    return truncateText([
      "【模块 scene.session / M11 场景会话管理】",
      `当前场景：${context.data.currentScene}`,
      `场景数：${context.data.sceneCount}；近期事件：${context.data.recentEventCount}`,
      ...context.data.contextWindow.map((scene) => `- ${scene.title}${scene.summary ? `：${scene.summary}` : ""}`)
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/scenes.js", context,
      context.ok ? `current=${context.data.currentScene}; scenes=${context.data.sceneCount}; events=${context.data.recentEventCount}` : "unavailable");
  }
});

export default moduleWrapper;
