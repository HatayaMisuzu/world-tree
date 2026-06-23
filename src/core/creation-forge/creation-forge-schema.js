export function createForgeProject(input = {}, options = {}) {
  return { schemaVersion: 1, modeMeaning: "artifact_factory", status: "draft", targetArtifactTypes: Array.isArray(input.targets) ? input.targets : [], activeBlueprintId: null, activeArtifactId: null, createdProjects: [], updatedAt: new Date().toISOString() };
}

export function createForgeInput(input = {}, options = {}) {
  return { inputId: `inp_${Date.now()}`, rawText: input.text || "", detectedTargets: [], confidence: "medium", missingInformation: [], risks: [], userIntentSummary: "" };
}

export function createForgeBlueprint(type = "worldbook", options = {}) {
  return { schemaVersion: 1, blueprintId: `bp_${Date.now()}`, targetArtifactType: type, title: "", summary: "", source: { rawInputIds: [], userAnsweredFields: [], aiInferredFields: [] }, sections: {}, validation: { status: "draft", warnings: [], errors: [] } };
}
