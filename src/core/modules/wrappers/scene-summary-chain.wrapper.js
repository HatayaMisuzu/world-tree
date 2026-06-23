import { createDebugInfo, createWrapperResult, truncateText } from "../wrapper-utils.js";
const ID = "scene.summary_chain";
export const moduleWrapper = Object.freeze({
  id: ID, legacyId: null, name: "场景摘要链", status: "implemented",
  buildContext(ctx = {}) { const summaries = (ctx.livingWorldPacket?.sceneSummaries || ctx.sceneSummaries || []).slice(-3).map((item) => ({ id: item.id, sceneId: item.sceneId, summary: truncateText(item.summary, 360) })); return createWrapperResult(ID, null, { summaries }); },
  buildPromptBlock(ctx = {}) { const summaries = this.buildContext(ctx).data.summaries; return summaries.length ? `【最近场景】\n${summaries.map((item) => `- ${item.summary}`).join("\n")}` : "【最近场景】暂无摘要。"; },
  getDebugInfo(ctx = {}) { return createDebugInfo(this, "src/core/scene/scene-summary-chain.js", this.buildContext(ctx), "read-only; max=3"); }
});
export default moduleWrapper;
