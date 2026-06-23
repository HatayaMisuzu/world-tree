import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "entity.relationship_network";
const LEGACY_ID = "M6";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "关系网络",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const model = ctx.model || {};
      const moduleData = ctx.moduleData || model.moduleData || {};
      const relations = moduleData.relations || {};
      const relationEntries = Object.entries(relations).filter(([, v]) => v != null);

      return createWrapperResult(ID, LEGACY_ID, {
        relationCount: relationEntries.length,
        primaryRelations: relationEntries.slice(0, 5).map(([key]) => truncateText(key, 80)),
        characters: Array.isArray(moduleData.characters) ? moduleData.characters.length : 0,
        networkDensity: relationEntries.length > 0 ? "sparse" : "empty",
        mutationReady: false // 只读，不写关系变更
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 entity.relationship_network / M6 关系网络】当前不可用。";
    const d = context.data;
    return truncateText([
      "【模块 entity.relationship_network / M6 关系网络】",
      `关系数量：${d.relationCount}`,
      `角色数量：${d.characters}`,
      `网络密度：${d.networkDensity}`,
      d.primaryRelations.length ? `主要关系：${d.primaryRelations.join("、")}` : ""
    ].filter(Boolean).join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/relations.js", context,
      context.ok ? `relations=${context.data.relationCount}; characters=${context.data.characters}` : "unavailable");
  }
});

export default moduleWrapper;
