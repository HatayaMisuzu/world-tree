export function exportForgeBlueprint(blueprint = {}, options = {}) {
  return { ...blueprint, exportedAt: new Date().toISOString(), exportVersion: "forge.v1" };
}

export function exportForgeArtifact(artifact = {}, options = {}) {
  return { ...artifact, exportedAt: new Date().toISOString(), exportType: "forge_artifact.v1" };
}

export function exportForgePreviewMarkdown(artifact = {}, options = {}) {
  const lines = [`# ${artifact.title || "未命名资产"}`, "", `类型: ${artifact.targetType || ""}`, "", `${artifact.sourceText || ""}`];
  return lines.join("\n");
}

export function exportForgeWorldTreePackage(artifact = {}, options = {}) {
  return { packVersion: 1, mode: artifact.targetType || "", artifact, files: artifact.files || {} };
}
