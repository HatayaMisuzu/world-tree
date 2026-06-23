import { createForgeBlueprint } from "./creation-forge-schema.js";

export function createForgeBlueprintFromIntake(intake = {}, answers = {}, options = {}) {
  const type = (intake.detectedTargets || [])[0] || "worldbook";
  const bp = createForgeBlueprint(type, options);
  bp.title = options.title || "未命名蓝图";
  bp.source.rawInputIds = [intake.inputId || ""];
  bp.source.userAnsweredFields = Object.keys(answers || {});
  bp.sections = { answers: answers || {} };
  return bp;
}

export function normalizeForgeBlueprint(blueprint = {}, options = {}) {
  return { ...blueprint, schemaVersion: blueprint.schemaVersion || 1, sections: blueprint.sections || {}, source: { rawInputIds: [], userAnsweredFields: [], aiInferredFields: [], ...(blueprint.source || {}) } };
}

export function validateForgeBlueprint(blueprint = {}, options = {}) {
  const errors = [], warnings = [];
  if (!blueprint.targetArtifactType) errors.push("missing targetArtifactType");
  if (!blueprint.title) warnings.push("untitled blueprint");
  return { status: errors.length ? "invalid" : "valid", warnings, errors };
}

export function createBlueprintPreview(blueprint = {}, options = {}) {
  return { title: blueprint.title || "", type: blueprint.targetArtifactType || "", sections: Object.keys(blueprint.sections || {}).length, validation: blueprint.validation?.status || "draft" };
}
