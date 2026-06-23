import { detectFormat } from "../../data/alchemy/alchemy-engine.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "creation.alchemy";
const LEGACY_ID = "M-创作";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "世界书创作炼金台",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const source = ctx.options?.source ?? ctx.options?.sourceText ?? moduleData.alchemySource ?? ctx.input ?? "";
      const detectedFormat = detectFormat(source);
      return createWrapperResult(ID, LEGACY_ID, {
        alchemyAvailable: true,
        sourceType: safeString(ctx.options?.sourceType, detectedFormat),
        detectedFormat,
        candidateExtractionAvailable: true,
        reviewRequired: true
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 creation.alchemy / M-创作 世界书创作炼金台】当前无法读取创作工具摘要。";
    return truncateText([
      "【模块 creation.alchemy / M-创作 世界书创作炼金台】",
      `素材格式：${context.data.sourceType || "unknown"}`,
      "候选提取：可用",
      "正式写入：必须经过审核确认"
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/alchemy/alchemy-engine.js", context,
      context.ok ? `available=true; format=${context.data.detectedFormat}; reviewRequired=true` : "unavailable");
  }
});

export default moduleWrapper;
