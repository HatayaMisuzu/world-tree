import {
  cardModeNarrativeHint,
  characterCardMode,
  detectCardType
} from "../../data/character-card.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeArray,
  truncateText
} from "../wrapper-utils.js";

const ID = "character.card_runtime";
const LEGACY_ID = "M19";

function primaryCard(ctx = {}) {
  if (ctx.options?.characterCard && typeof ctx.options.characterCard === "object") return ctx.options.characterCard;
  return safeArray(ctx.cards).find((card) => card && typeof card === "object") || null;
}

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "角色卡驱动模式",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const card = primaryCard(ctx);
      if (!card) return createWrapperResult(ID, LEGACY_ID, {
        cardDetected: false,
        cardType: "unknown",
        primaryName: "",
        firstMessageExists: false,
        scenarioExists: false,
        relationshipHint: "",
        narrativeHint: ""
      });
      const detected = detectCardType(card);
      const mode = characterCardMode(card);
      const parsed = mode.parsed || {};
      const hint = cardModeNarrativeHint(parsed, ctx.input || "", ctx.options?.emotionProfile || null);
      return createWrapperResult(ID, LEGACY_ID, {
        cardDetected: detected.features.includes("character_card") || Boolean(parsed.identity?.name),
        cardType: detected.type,
        primaryName: truncateText(parsed.identity?.name || card.name || card.名称 || "", 120),
        firstMessageExists: Boolean(parsed.dialogue?.firstMessage),
        scenarioExists: Boolean(parsed.dialogue?.scenario),
        relationshipHint: truncateText(parsed.relationships?.dynamics || "", 180),
        narrativeHint: truncateText(`${hint.characterName || "角色"}; mood=${hint.mood || "unknown"}; rules=${safeArray(hint.rules).length}`, 240)
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 character.card_runtime / M19 角色卡运行时】当前无法读取人物卡摘要。";
    if (!context.data.cardDetected) return "【模块 character.card_runtime / M19 角色卡运行时】当前未检测到人物卡。";
    return truncateText([
      "【模块 character.card_runtime / M19 角色卡运行时】",
      `角色：${context.data.primaryName || "未命名"}`,
      `首条消息：${context.data.firstMessageExists ? "有" : "无"}；场景：${context.data.scenarioExists ? "有" : "无"}`,
      context.data.relationshipHint ? `关系提示：${context.data.relationshipHint}` : ""
    ].filter(Boolean).join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/character-card.js", context,
      context.ok ? `detected=${context.data.cardDetected}; type=${context.data.cardType}; character=${context.data.primaryName || "none"}` : "unavailable");
  }
});

export default moduleWrapper;
