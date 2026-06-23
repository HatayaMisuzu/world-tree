import { validateForgeBlueprint } from "./creation-forge-blueprint.js";
import { validateForgeArtifactAgainstContract, getForgeArtifactContract } from "./creation-forge-artifact-contracts.js";

export function validateForgeArtifact(artifact = {}, options = {}) {
  const errors = [], warnings = [];
  if (!artifact.title) errors.push("missing title");
  if (!artifact.sourceText) errors.push("missing sourceText");
  if (!artifact.targetType) errors.push("missing targetType");
  // Check truth leak: hidden fields must not be in visible output
  if (artifact._truthLock && artifact.visibility !== "system_only") {
    errors.push("truth lock exposed to non-system context");
  }
  const contract = getForgeArtifactContract(artifact.targetType);
  if (contract) {
    const contractCheck = validateForgeArtifactAgainstContract(artifact, contract, options);
    errors.push(...contractCheck.errors);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateForgeInstantiationPlan(plan = {}, options = {}) {
  const errors = [];
  if (!plan.targetMode) errors.push("missing targetMode");
  if (!plan.artifact) errors.push("missing artifact");
  return { ok: errors.length === 0, errors };
}

export function createForgeValidationReport(result = {}, options = {}) {
  return { ok: result.ok !== false, errors: result.errors || [], warnings: result.warnings || [], blocking: (result.errors||[]).filter(e => e.includes("truth_lock") || e.includes("missing")) };
}
