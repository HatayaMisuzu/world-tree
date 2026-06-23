import { auditNarrative } from "../../data/rules.js";
import {
  createDebugInfo,
  createWrapperError,
  createWrapperResult,
  safeArray,
  safeString,
  truncateText
} from "../wrapper-utils.js";

const ID = "audit.narrative_quality";
const LEGACY_ID = "M15c";

function summarizeAudit(audit = {}) {
  return {
    consistency: safeString(audit.consistency, "unknown"),
    continuity: safeString(audit.continuity, "unknown"),
    pacing: safeString(audit.pacing, "unknown"),
    style: safeString(audit.style, "world-tree"),
    warningCount: safeArray(audit.warnings).length,
    warnings: safeArray(audit.warnings).slice(0, 5).map((warning) => ({
      dimension: truncateText(warning.dimension || "general", 80),
      level: truncateText(warning.level || "info", 40),
      detail: truncateText(warning.detail || warning.message || "", 200)
    }))
  };
}

export const moduleWrapper = Object.freeze({
  id: ID,
  legacyId: LEGACY_ID,
  name: "叙事质量审查",
  status: "legacy-wrapped",

  buildContext(ctx = {}) {
    try {
      const moduleData = ctx.moduleData || ctx.model?.moduleData || {};
      const lastAudit = ctx.options?.lastAudit || moduleData.runtime?.lastAudit || null;
      return createWrapperResult(ID, LEGACY_ID, {
        auditAvailable: true,
        lastAudit: lastAudit ? summarizeAudit(lastAudit) : null
      });
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  buildPromptBlock() {
    return "【模块 audit.narrative_quality / M15c 叙事质量审查】\n叙事质量审查已启用：保持世界与角色一致、不 OOC，并保留可继续的行动点。";
  },

  validateOutput(ctx = {}) {
    try {
      const narrative = safeString(ctx.output || ctx.narrative || ctx.options?.output);
      return createWrapperResult(ID, LEGACY_ID, {
        audited: Boolean(narrative),
        audit: narrative ? summarizeAudit(auditNarrative(narrative, ctx.model || {})) : null
      }, narrative ? [] : ["no narrative supplied"]);
    } catch (error) {
      return createWrapperError(ID, LEGACY_ID, error);
    }
  },

  getDebugInfo(ctx = {}) {
    const context = this.buildContext(ctx);
    return createDebugInfo(this, "src/core/data/rules.js", context,
      context.ok ? `available=true; lastAudit=${Boolean(context.data.lastAudit)}` : "unavailable");
  }
});

export default moduleWrapper;
