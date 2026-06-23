import { contextProfileForMode } from "./context-policy.js";
export function routeContext(input = {}) { return { modeId: input.modeId || "", contextProfile: input.policy?.profile || contextProfileForMode(input.modeId) }; }
