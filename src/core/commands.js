import { moduleTitle } from "./normalizers.js";
import { DEFAULT_SLASH_COMMANDS, slashCommandsFor } from "./slash-commands.js";

export const COMMANDS = DEFAULT_SLASH_COMMANDS;

export function renderCommand(template, model) {
  const module = model.selected || {};
  return template
    .replaceAll("{{module}}", module.name || module.id || "模组名")
    .replaceAll("{{branch}}", module.branch || "main")
    .replaceAll("{{name}}", "名称");
}

export function commandText(model, powerUser = {}) {
  return slashCommandsFor(powerUser).map((item) => `${item.group} / ${item.label}\n${renderCommand(item.command, model)}`).join("\n\n");
}

export function startupPacket(model) {
  const module = model.selected;
  const data = model.moduleData;
  if (!module || !data) return "尚未加载世界树模组。";
  const scenes = data.scenes.slice(0, 5).map((item) => `- ${item.title}: ${item.summary}`).join("\n") || "- 暂无场景链";
  const characters = data.characters.slice(0, 8).map((item) => `- ${item.name}${item.role ? ` / ${item.role}` : ""}${item.status ? ` / ${item.status}` : ""}`).join("\n") || "- 暂无角色状态";
  const tracking = data.tracking.map((item) => `- ${item.name}: ${item.count}`).join("\n");
  return [
    "你正在接管一个 World Tree 模组，请先读取并遵守以下启动包。",
    "",
    `模组：${moduleTitle(module)}`,
    `路径：${module.path}`,
    `分支：${module.branch || "main"}`,
    `数据根：${model.rootPath}`,
    "",
    "当前场景：",
    scenes,
    "",
    "角色快照：",
    characters,
    "",
    "追踪压力：",
    tracking,
    "",
    "安全边界：控制台默认只读。任何状态、分支、存档、角色或世界书变更都应通过 World Tree 指令或导出的拟议补丁执行。"
  ].join("\n");
}

export function proposedPatch(model) {
  return {
    type: "world-tree-proposed-patch",
    generatedAt: new Date().toISOString(),
    rootPath: model.rootPath,
    module: model.selected,
    mode: "read-only-export",
    operations: [],
    note: "第一版桌面应用不直接写入世界树 JSON；这里保留升级后的受控写入接口。"
  };
}
