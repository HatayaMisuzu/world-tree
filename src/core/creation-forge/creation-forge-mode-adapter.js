import { analyzeForgeInput, detectForgeTargets } from "./creation-forge-intake.js";
import { createForgeQuestions, answerForgeQuestions } from "./creation-forge-questioning.js";
import { createForgeBlueprintFromIntake, validateForgeBlueprint } from "./creation-forge-blueprint.js";
import { createForgeInstantiationPlan } from "./creation-forge-project-instantiator.js";

export function createCreationForgeContext(project = {}, input = {}, options = {}) {
  return { modeId: "creation-forge", modeMeaning: "artifact_factory", status: "ready", intake: null, questions: null, blueprint: null, timestamp: new Date().toISOString() };
}

export function createCreationForgeTurnPacket(project = {}, input = {}, options = {}) {
  const intake = analyzeForgeInput(input);
  const questions = createForgeQuestions(intake);
  const bp = createForgeBlueprintFromIntake(intake, options.answers || {});
  const validation = validateForgeBlueprint(bp);
  const plan = createForgeInstantiationPlan({ title: bp.title, targetType: bp.targetArtifactType, sourceText: input.text || "" });
  return { schemaVersion: 1, mode: "creation-forge", modeMeaning: "artifact_factory", intake, questions, blueprint: bp, artifactPreview: bp, validationReport: validation, instantiationPlan: plan, proposals: [], runtime: { cacheKey: `forge.turn.${Date.now()}`, warnings: [] } };
}

export function runCreationForgeTurn(project = {}, input = {}, options = {}) {
  const packet = createCreationForgeTurnPacket(project, input, options);
  return { status: "ready", packet, cacheKey: packet.runtime?.cacheKey };
}

export function createCreationForgeSummary(project = {}, options = {}) {
  return { mode: "creation-forge", modeMeaning: "artifact_factory", ready: true };
}
