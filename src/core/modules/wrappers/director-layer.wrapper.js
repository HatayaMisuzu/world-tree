import { createDirectorPlan } from "../../director/director-layer.js";
import { guardDirectorPlan } from "../../director/director-guardian.js";
import { createDebugInfo, createWrapperResult } from "../wrapper-utils.js";
const ID = "narrative.director_layer";
export default Object.freeze({ id: ID, legacyId: null, name: "Director Layer", status: "implemented", buildContext(ctx = {}) { const guarded = guardDirectorPlan(createDirectorPlan({ modeId: ctx.modeId || ctx.options?.mode, activeProposals: ctx.activeProposals || [] }), ctx.directorContext || {}); return createWrapperResult(ID, null, guarded); }, buildPromptBlock(ctx = {}) { const data = this.buildContext(ctx).data; return `【导演计划】${data.plan.beatType}; maxNewEvents=${data.plan.maxNewEvents}; 不写正文`; }, getDebugInfo(ctx = {}) { return createDebugInfo(this, "src/core/director/director-layer.js", this.buildContext(ctx), "plan-only"); } });
