"use strict";

(function registerWorldTreeNavigation(global) {
  const primaryNav = Object.freeze([
    Object.freeze({ id: "workbench", label: "大厅", icon: "□", meta: "开始" }),
    Object.freeze({ id: "chat", label: "对话", icon: "◇", meta: "创作" }),
    Object.freeze({ id: "library", label: "资料库", icon: "▦", meta: "素材" }),
    Object.freeze({ id: "worlds", label: "世界管理", icon: "◎", meta: "项目" }),
    Object.freeze({ id: "observe", label: "观测", icon: "◌", meta: "调试" }),
    Object.freeze({ id: "settings", label: "设置", icon: "⚙", meta: "配置" })
  ]);
  global.WorldTreeNavigation = Object.freeze({
    primaryNav,
    mobileNav: Object.freeze(primaryNav.slice(0, 5)),
    hasView(id) { return primaryNav.some(item => item.id === id); }
  });
})(globalThis);
