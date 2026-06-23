import { createDebugInfo, createWrapperResult } from "../wrapper-utils.js";
const ID = "tracking.world_events";
export const moduleWrapper = Object.freeze({
  id: ID, legacyId: null, name: "世界事件追踪", status: "implemented",
  buildContext(ctx = {}) { const digest = ctx.livingWorldPacket?.trackingDigest || ctx.trackingDigest || {}; return createWrapperResult(ID, null, { recentChanges: (digest.recentChanges || []).slice(-8), activeForeshadowing: (digest.activeForeshadowing || []).slice(0, 8), openConflicts: (digest.openConflicts || []).slice(0, 8) }); },
  buildPromptBlock(ctx = {}) { const data = this.buildContext(ctx).data; return `【追踪摘要】变化=${data.recentChanges.length}; 伏笔=${data.activeForeshadowing.length}; 冲突=${data.openConflicts.length}`; },
  getDebugInfo(ctx = {}) { return createDebugInfo(this, "src/core/tracking/tracking-digest.js", this.buildContext(ctx), "read-only digest"); }
});
export default moduleWrapper;
