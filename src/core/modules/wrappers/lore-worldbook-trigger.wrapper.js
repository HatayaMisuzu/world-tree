import { prepareWorldbookInjection } from "../../runtime/worldbook-runtime.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeArray,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "lore.worldbook_trigger";
const LEGACY_ID = "M2";

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "触发式条目系统",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const model = ctx.model?.moduleData ? ctx.model : null;
      const result = prepareWorldbookInjection({
        model,
        worldbook: ctx.worldbookState || moduleData.worldbook || { entries: [] },
        input: safeString(ctx.input),
        engineState: ctx.engineState || {},
        messages: safeArray(ctx.options?.messages)
      });
      const selected = safeArray(result.injectedWorldbook).slice(0, 5).map((entry) => ({
        id: safeString(entry.id),
        title: truncateText(entry.title || entry.name || entry.keys?.[0] || "Untitled", 120),
        reason: truncateText(entry.reason || entry.matchType || "matched", 120),
        keys: safeArray(entry.keys).slice(0, 8).map((key) => truncateText(key, 80))
      }));
      const diagnostics = result.diagnostics || {};
      return createWrapperResult(ID, LEGACY_ID, {
        selectedCount: safeArray(result.injectedWorldbook).length,
        selected,
        diagnostics: {
          budgetName: safeString(diagnostics.budgetName, "balanced"),
          activeEntryCount: Number(diagnostics.activeEntryCount || 0),
          candidateCount: Number(diagnostics.candidateCount || 0),
          droppedCount: safeArray(diagnostics.droppedByBudget).length,
          missCount: safeArray(diagnostics.misses).length,
          usedChars: Number(diagnostics.budget?.usedChars || 0)
        }
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock(ctx = {}) {
    const context = this.buildContext(ctx);
    if (!context.ok) return "【模块 lore.worldbook_trigger / M2 触发式条目系统】当前无法生成世界书注入摘要。";
    if (!context.data.selected.length) return "【模块 lore.worldbook_trigger / M2 触发式条目系统】本轮无世界书条目命中。";
    return truncateText([
      "【模块 lore.worldbook_trigger / M2 触发式条目系统】",
      `命中条目：${context.data.selectedCount}`,
      ...context.data.selected.map((entry) => `- ${entry.title} (${entry.reason})`),
      `预算：${context.data.diagnostics.usedChars} chars；裁剪：${context.data.diagnostics.droppedCount}`
    ].join("\n"));
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/runtime/worldbook-runtime.js", context,
      context.ok ? `selected=${context.data.selectedCount}; candidates=${context.data.diagnostics.candidateCount}; dropped=${context.data.diagnostics.droppedCount}` : "unavailable");
  }
});

export default moduleWrapper;
