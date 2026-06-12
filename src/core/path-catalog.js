// ═══════════════════════════════════════════════════════════════
//  v0.7.4.1 数据归家：所有路径均为项目内相对路径
//  本机绝对路径已清理。portable 版 zip 即完整项目。
//  UI 设计/图片资产由 Codex 处理，相关接口见 docs/codex-interface.md
// ═══════════════════════════════════════════════════════════════

export const PATH_CATALOG = [
  {
    id: "project-data-root",
    label: "项目数据根",
    kind: "data-root",
    path: "data/",
    description: "所有运行时数据的家——worlds、engine overlay、modules、profiles 等。"
  },
  {
    id: "engine-overlay",
    label: "引擎 overlay",
    kind: "engine-root",
    path: "data/engine/",
    description: "LLM 输出的状态变更暂存区。采纳后写入正式模块。"
  },
  {
    id: "worlds-store",
    label: "世界存档",
    kind: "worlds-root",
    path: "data/engine/worlds/",
    description: "Minecraft 式世界存档。每个世界一个文件夹，完整自包含。"
  },
  {
    id: "global-memory",
    label: "全局记忆",
    kind: "memory-root",
    path: "data/engine/global-memory/",
    description: "跨会话的长期叙事记忆快照。"
  },
  {
    id: "modules",
    label: "世界书模组",
    kind: "module-root",
    path: "data/modules/",
    description: "用户加载的世界书模组目录。"
  },
  {
    id: "defaults-engine",
    label: "默认引擎模板",
    kind: "engine-root",
    path: "defaults/engine-profile/",
    description: "引擎知识卡和模块定义。"
  },
  {
    id: "defaults-profiles",
    label: "世界书子类型配置",
    kind: "profile-root",
    path: "defaults/world-profiles/",
    description: "classic/tabletop/rpg/sim 等子类型预设。"
  },
  {
    id: "defaults-examples",
    label: "素材示例清单",
    kind: "example-root",
    path: "defaults/examples/manifest.json",
    description: "维护者登记示例世界或角色卡的清单；当前默认为空，不随开源包分发素材。"
  },
  {
    id: "personas",
    label: "人格文件",
    kind: "persona-root",
    path: "personas/",
    description: "角色人格预设文件。"
  }
];

export function pathCatalogText() {
  return PATH_CATALOG.map((item) => `${item.label}\n${item.path}\n${item.description}`).join("\n\n");
}
