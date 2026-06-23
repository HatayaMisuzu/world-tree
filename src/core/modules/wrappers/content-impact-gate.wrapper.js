import { classifyImpact } from "../../content/change-impact-classifier.js";
import { createDebugInfo, createWrapperResult } from "../wrapper-utils.js";
const ID = "content.impact_gate";
export default Object.freeze({ id: ID, legacyId: null, name: "Content Impact Gate", status: "implemented", buildContext(ctx = {}) { return createWrapperResult(ID, null, classifyImpact(ctx.proposedChange || {})); }, buildPromptBlock(ctx = {}) { const data = this.buildContext(ctx).data; return `【变更安全】impact=${data.impactLevel}; secondConfirm=${data.requiresSecondConfirm}`; }, getDebugInfo(ctx = {}) { return createDebugInfo(this, "src/core/content/change-impact-classifier.js", this.buildContext(ctx), "classification-only"); } });
