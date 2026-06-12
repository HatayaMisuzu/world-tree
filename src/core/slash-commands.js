export const DEFAULT_SLASH_COMMANDS = [
  { id: "engine-new", group: "引擎", label: "新建模组", command: "/引擎 new {{module}}", source: "default" },
  { id: "engine-load", group: "引擎", label: "加载模组", command: "/引擎 load {{module}}", source: "default" },
  { id: "engine-status", group: "引擎", label: "引擎状态", command: "/引擎 status", source: "default" },
  { id: "archive-list", group: "存档", label: "存档列表", command: "/存档列表", source: "default" },
  { id: "archive-save", group: "存档", label: "创建存档", command: "/存档 {{name}}", source: "default" },
  { id: "archive-load", group: "存档", label: "读取存档", command: "/读档 {{name}}", source: "default" },
  { id: "branch-list", group: "分支", label: "分支列表", command: "/分支 list", source: "default" },
  { id: "branch-create", group: "分支", label: "创建分支", command: "/分支 create {{branch}}", source: "default" },
  { id: "characters-list", group: "角色", label: "角色列表", command: "/角色 list", source: "default" },
  { id: "scene-now", group: "场景", label: "当前场景", command: "/场景 now", source: "default" },
  { id: "preset-list", group: "预设", label: "预设列表", command: "/预设 list", source: "default" },
  { id: "rules-check", group: "规则", label: "规则检查", command: "/规则 check", source: "default" },
  { id: "review-check", group: "审查", label: "叙事审查", command: "/审查 check", source: "default" },
  { id: "plot-advance", group: "推进", label: "推进剧情", command: "/推进", source: "default" }
];

export const DEFAULT_POWER_USER = {
  settings: {
    enabled: true,
    showUserDataPaths: true
  },
  slashCommands: {
    disabledDefaultIds: {},
    userCommands: []
  }
};

function cleanId(value, fallback) {
  return String(value || fallback).trim().replace(/[^\w.-]/g, "-") || fallback;
}

export function normalizeUserCommand(command, index = 0) {
  const label = String(command?.label || command?.name || `User Command ${index + 1}`).trim();
  const text = String(command?.command || command?.template || "").trim();
  return {
    id: cleanId(command?.id, `user-${index + 1}`),
    group: String(command?.group || "用户").trim() || "用户",
    label,
    command: text,
    source: "user",
    description: String(command?.description || "").trim()
  };
}

export function normalizePowerUser(value = {}) {
  const slash = value.slashCommands || {};
  const userCommands = Array.isArray(slash.userCommands)
    ? slash.userCommands.map((item, index) => normalizeUserCommand(item, index)).filter((item) => item.command)
    : [];
  return {
    settings: { ...DEFAULT_POWER_USER.settings, ...(value.settings || {}) },
    slashCommands: {
      disabledDefaultIds: { ...(slash.disabledDefaultIds || {}) },
      userCommands
    }
  };
}

export function slashCommandsFor(powerUser = {}) {
  const normalized = normalizePowerUser(powerUser);
  const disabled = normalized.slashCommands.disabledDefaultIds || {};
  return [
    ...DEFAULT_SLASH_COMMANDS.filter((item) => !disabled[item.id]),
    ...normalized.slashCommands.userCommands
  ];
}

export function defaultSlashCommandRows(powerUser = {}) {
  const disabled = normalizePowerUser(powerUser).slashCommands.disabledDefaultIds || {};
  return DEFAULT_SLASH_COMMANDS.map((item) => ({
    ...item,
    enabled: !disabled[item.id]
  }));
}
