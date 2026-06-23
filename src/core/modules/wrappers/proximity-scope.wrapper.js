import { calculateProximityScope } from "../../proximity/proximity-scope.js";
import { createDebugInfo, createWrapperError, createWrapperResult } from "../wrapper-utils.js";

const ID = "scope.proximity";
export const moduleWrapper = Object.freeze({
  id: ID, legacyId: null, name: "主角邻近范围", status: "implemented",
  buildContext(ctx = {}) {
    try {
      const packet = ctx.livingWorldPacket?.proximityScope || calculateProximityScope({ modeId: ctx.options?.mode || ctx.modeId, protagonistId: ctx.protagonistId, currentScene: ctx.currentScene, candidates: ctx.candidates || [], relations: ctx.relations || [] });
      return createWrapperResult(ID, null, { rings: packet.rings, scores: packet.scores, reused: packet.reused });
    } catch (error) { return createWrapperError(ID, null, error); }
  },
  buildPromptBlock(ctx = {}) { const result = this.buildContext(ctx); return result.ok ? `【邻近范围】core=${result.data.rings.core.length}; near=${result.data.rings.near.length}; far=${result.data.rings.far.length}` : "【邻近范围】不可用。"; },
  getDebugInfo(ctx = {}) { return createDebugInfo(this, "src/core/proximity/proximity-scope.js", this.buildContext(ctx), "deterministic; read-only"); }
});
export default moduleWrapper;
