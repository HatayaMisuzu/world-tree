import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "narrative.story_template";
const LEGACY_ID = "M12";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "故事模板",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const model = ctx.model || {};
      const options = ctx.options || {};

      return createWrapperResult(ID, LEGACY_ID, {
        templateAvailable: Boolean(model.template || options.template),
        styleHint: safeString(options.style || model.style, "standard"),
        genreHint: safeString(options.genre || model.genre, "generic"),
        presetSummary: safeString(options.presetSummary || "", "").slice(0, 200) || null,
        templateCount: 1
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 narrative.story_template / M12 故事模板】当前不可用。";
    const d = context.data;
    return truncateText([
      "【模块 narrative.story_template / M12 故事模板】",
      `风格提示：${d.styleHint}`,
      `体裁提示：${d.genreHint}`,
      d.presetSummary ? `预设摘要：${d.presetSummary}` : ""
    ].filter(Boolean).join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/templates.js", context,
      context.ok ? `style=${context.data.styleHint}; genre=${context.data.genreHint}` : "unavailable");
  }
});

export default moduleWrapper;
