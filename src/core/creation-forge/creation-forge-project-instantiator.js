export function createForgeInstantiationPlan(artifact = {}, options = {}) {
  const contract = options.contract || {};
  return { planId: `plan_${Date.now()}`, targetMode: contract.targetMode || artifact.targetType || "", artifact, requiresConfirmation: true, status: "draft", patchPreview: { title: artifact.title || "", dataMode: contract.targetMode || "" } };
}

export function instantiateForgeProject(plan = {}, services = {}, options = {}) {
  if (plan.requiresConfirmation && !options.confirmed) return { ok: false, error: "requires user confirmation before instantiation" };
  return { ok: true, projectId: `forge_${Date.now().toString(36)}`, targetMode: plan.targetMode, artifact: plan.artifact, status: "instantiated" };
}

export function createForgePatchPlan(artifact = {}, targetProject = {}, options = {}) {
  return { planId: `patch_${Date.now()}`, targetProjectId: targetProject.id || "", patches: [{ file: "shared/character_profile.json", operation: "merge", data: artifact }], requiresConfirmation: true };
}

export function applyForgePatchPlan(plan = {}, services = {}, options = {}) {
  if (plan.requiresConfirmation && !options.confirmed) return { ok: false, error: "requires user confirmation" };
  return { ok: true, patchesApplied: plan.patches?.length || 0 };
}
