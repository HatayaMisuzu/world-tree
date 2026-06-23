import { classifyImpact } from "../content/change-impact-classifier.js";
import { createContextPacket } from "../context/context-engine.js";
import { readCharacterInertia } from "../character/emotional-inertia.js";
import { summarizeCharacterInertia } from "../character/emotional-inertia-summary.js";
import { createDirectorPlan } from "../director/director-layer.js";
import { guardDirectorPlan } from "../director/director-guardian.js";
import { readWorldbookGrowthTree } from "../worldbook/worldbook-growth-tree.js";

export async function createExperienceStabilityPacket(ctx = {}) {
  const inertiaState = ctx.characterInertia || await readCharacterInertia(ctx.projectRoot);
  const summaries = summarizeCharacterInertia(inertiaState, ctx.presentCharacterIds || []);
  const contextPacket = createContextPacket({ ...ctx, characterInertia: { ...inertiaState, summaries } });
  const rawPlan = createDirectorPlan({ ...ctx, contextPacket, emotionalInertia: summaries });
  const guarded = guardDirectorPlan(rawPlan, { unresolvedChoice: Boolean(ctx.activeProposals?.length), inertiaWarnings: summaries.flatMap((item) => item.warnings || []) });
  const growth = ctx.worldbookGrowthSnapshot || await readWorldbookGrowthTree(ctx.projectRoot);
  return { contextPacket, emotionalInertia: { state: inertiaState, summaries }, directorPlan: guarded.plan, impactPolicy: classifyImpact(ctx.proposedChange || {}), worldbookGrowthSnapshot: growth, warnings: guarded.issues, debug: { canonicalWrites: 0 } };
}
