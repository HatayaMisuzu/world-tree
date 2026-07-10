"use strict";

(function registerWorldTreeNavigation(global) {
  const primaryNav = Object.freeze([
    Object.freeze({ id: "workbench", label: "首页", icon: "⌂", meta: "继续" }),
    Object.freeze({ id: "experiences", label: "体验", icon: "◇", meta: "探索" }),
    Object.freeze({ id: "library", label: "我的内容", icon: "▦", meta: "管理" }),
    Object.freeze({ id: "creation", label: "创作", icon: "✦", meta: "构建" }),
    Object.freeze({ id: "settings", label: "设置", icon: "⚙", meta: "配置" })
  ]);
  const contextualViews = Object.freeze([
    Object.freeze({ id: "chat", parent: "experiences", label: "体验工作区" }),
    Object.freeze({ id: "worlds", parent: "library", label: "世界管理" }),
    Object.freeze({ id: "observe", parent: "library", label: "项目观测" })
  ]);
  global.WorldTreeNavigation = Object.freeze({
    primaryNav,
    mobileNav: primaryNav,
    contextualViews,
    hasView(id) { return primaryNav.some(item => item.id === id) || contextualViews.some(item => item.id === id); },
    activePrimary(id) { return contextualViews.find(item => item.id === id)?.parent || id; },
    labelFor(id) { return primaryNav.find(item => item.id === id)?.label || contextualViews.find(item => item.id === id)?.label || "首页"; }
  });
})(globalThis);
