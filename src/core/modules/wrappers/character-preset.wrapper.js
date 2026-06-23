import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeArray,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "character.preset";
const LEGACY_ID = "M8";

function summarizeCharacter(character = {}) {
  return {
    name: truncateText(character.name || character.名称 || character.identity?.name || "未命名角色", 100),
    role: truncateText(character.role || character.身份 || character.background?.currentRole || "", 100),
    tags: safeArray(character.tags || character.标签).slice(0, 6).map((tag) => truncateText(tag, 60)),
    location: truncateText(character.location || character.位置 || character.currentLocation || "", 100)
  };
}

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "角色预设系统",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const characters = [...safeArray(moduleData.characters), ...safeArray(ctx.cards)]
        .filter((item) => item && typeof item === "object")
        .slice(0, 12);
      const summaries = characters.slice(0, 5).map(summarizeCharacter);
      const preferred = safeString(ctx.options?.primaryCharacter);
      const primary = preferred
        ? summaries.find((character) => character.name === preferred) || summaries[0]
        : summaries[0];
      return createWrapperResult(ID, LEGACY_ID, {
        characterCount: characters.length,
        characters: summaries,
        primaryCharacter: primary?.name || ""
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 character.preset / M8 角色预设系统】当前无法读取角色摘要。";
    if (!context.data.characters.length) return "【模块 character.preset / M8 角色预设系统】当前没有角色预设。";
    return truncateText([
      "【模块 character.preset / M8 角色预设系统】",
      `角色数量：${context.data.characterCount}`,
      `主角色：${context.data.primaryCharacter || "未指定"}`,
      ...context.data.characters.map((character) => `- ${character.name}${character.role ? ` / ${character.role}` : ""}${character.location ? ` @ ${character.location}` : ""}`)
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/character-card.js", context,
      context.ok ? `characters=${context.data.characterCount}; primary=${context.data.primaryCharacter || "none"}` : "unavailable");
  }
});

export default moduleWrapper;
