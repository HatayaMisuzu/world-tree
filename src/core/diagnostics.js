export function runLocalDiagnostics(model, config = {}) {
  const checks = [];
  checks.push({
    id: "data-root",
    label: "数据根",
    ok: Boolean(model.rootPath),
    detail: model.rootPath || "未选择数据根"
  });
  checks.push({
    id: "index",
    label: "index.json",
    ok: Boolean(model.index && Object.keys(model.index).length),
    detail: model.index?.version ? `version ${model.index.version}` : "未读到 index 版本"
  });
  checks.push({
    id: "modules",
    label: "模组",
    ok: model.modules.length > 0,
    detail: `${model.modules.length} 个模组`
  });
  checks.push({
    id: "engine",
    label: "_engine",
    ok: Boolean(model.engine.canonTemplate || model.engine.agentProfiles || model.engine.commands),
    detail: model.engine.canonTemplate ? "已读取 canon_state.template.json" : "未读取到模板"
  });
  checks.push({
    id: "hermes-config",
    label: "Hermes 配置",
    ok: Boolean(config.hermesBaseUrl),
    detail: config.hermesBaseUrl || "未配置"
  });
  checks.push({
    id: "write-policy",
    label: "写入策略",
    ok: true,
    detail: "只读加导出；不直接修改世界树 JSON"
  });
  for (const warning of model.warnings) {
    checks.push({
      id: `warning-${checks.length}`,
      label: warning.path,
      ok: warning.level !== "bad",
      detail: warning.message
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    rootPath: model.rootPath,
    selectedModule: model.selected,
    checks
  };
}
