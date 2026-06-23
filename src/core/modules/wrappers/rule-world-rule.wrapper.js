import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "rule.world_rule";
const LEGACY_ID = "M15";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "世界规则",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const model = ctx.model || {};
      const moduleData = ctx.moduleData || model.moduleData || {};
      const rules = moduleData.rules || [];

      return createWrapperResult(ID, LEGACY_ID, {
        ruleCount: Array.isArray(rules) ? rules.length : 0,
        ruleCategories: Array.isArray(rules)
          ? [...new Set(rules.map((r) => safeString(r?.category || r?.type, "general")).filter(Boolean))].slice(0, 8)
          : [],
        reviewReady: false, // P1 不改审核行为
        applicabilityHint: "read_only_summary"
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 rule.world_rule / M15 世界规则】当前不可用。";
    const d = context.data;
    return truncateText([
      "【模块 rule.world_rule / M15 世界规则】",
      `规则数量：${d.ruleCount}`,
      d.ruleCategories.length ? `规则类别：${d.ruleCategories.join("、")}` : "",
      "注意：本模块为只读摘要，不自动审核或应用规则。"
    ].filter(Boolean).join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/rules.js", context,
      context.ok ? `rules=${context.data.ruleCount}; categories=${context.data.ruleCategories.length}` : "unavailable");
  }
});

export default moduleWrapper;
