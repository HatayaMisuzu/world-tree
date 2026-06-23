import {
  parseEmotionalGradients,
  parsePersonalityLayers,
  selectEmotionalGradient
} from "../../data/character-card.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  hasMeaningfulValue,
  safeArray,
  truncateText
} from "../wrapper-utils.js";

const ID = "character.cognition";
const LEGACY_ID = "M9";

function primaryCard(ctx = {}) {
  if (ctx.options?.characterCard && typeof ctx.options.characterCard === "object") return ctx.options.characterCard;
  return safeArray(ctx.cards).find((card) => card && typeof card === "object") || null;
}

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "角色认知层",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const card = primaryCard(ctx);
      if (!card) return createWrapperResult(ID, LEGACY_ID, {
        cardDetected: false,
        surface: "",
        deepLayerAvailable: false,
        triggersAvailable: false,
        emotionGradientsAvailable: false,
        selectedGradient: ""
      });
      const layers = parsePersonalityLayers(card);
      const gradients = parseEmotionalGradients(card);
      const gradientMatch = selectEmotionalGradient(gradients, {
        state: ctx.engineState?.emotionState || {},
        dominant: safeArray(ctx.options?.emotionProfile?.dominant)
      });
      return createWrapperResult(ID, LEGACY_ID, {
        cardDetected: true,
        surface: truncateText(layers.surface?.label || layers.surface?.traits || "", 180),
        deepLayerAvailable: hasMeaningfulValue(layers.deep),
        triggersAvailable: hasMeaningfulValue(layers.triggers),
        emotionGradientsAvailable: hasMeaningfulValue(card.emotionGradients || card.情绪梯度),
        selectedGradient: truncateText(gradientMatch?.from || "neutral", 80)
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 character.cognition / M9 角色认知层】当前无法读取认知摘要。";
    if (!context.data.cardDetected) return "【模块 character.cognition / M9 角色认知层】当前没有人物卡认知数据。";
    return truncateText([
      "【模块 character.cognition / M9 角色认知层】",
      `表层：${context.data.surface || "未声明"}`,
      `深层人格：${context.data.deepLayerAvailable ? "有" : "无"}`,
      `触发线索：${context.data.triggersAvailable ? "有" : "无"}`,
      `情绪梯度：${context.data.emotionGradientsAvailable ? context.data.selectedGradient : "未配置"}`
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/character-card.js", context,
      context.ok ? `card=${context.data.cardDetected}; deep=${context.data.deepLayerAvailable}; gradient=${context.data.selectedGradient || "none"}` : "unavailable");
  }
});

export default moduleWrapper;
