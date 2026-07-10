import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBrowserSource } from "../../scripts/lib/browser-source.mjs";

const consoleJs = readBrowserSource();
const consoleCss = [
  "world-tree-console.css",
  "browser/styles/tokens.css",
  "browser/styles/shell.css",
  "browser/styles/components.css",
  "browser/styles/views.css",
  "browser/styles/responsive.css"
].map(file => readFileSync(file, "utf8")).join("\n");

test("default console shell exposes five stable product roots", () => {
  for (const marker of [
    'id: "workbench", label: "首页"',
    'id: "experiences", label: "体验"',
    'id: "library", label: "我的内容"',
    'id: "creation", label: "创作"',
    'id: "settings", label: "设置"'
  ]) assert.ok(consoleJs.includes(marker), `${marker} should be present`);
  for (const phrase of [
    "你的世界仍在生长",
    "从目标开始",
    "进入一个世界",
    "与人物相遇",
    "使用自己的内容"
  ]) {
    assert.ok(consoleJs.includes(phrase), `${phrase} should be present`);
  }
});

test("home, experience, and creation surfaces expose first-run paths without eight-entry home clutter", () => {
  for (const phrase of ["从示例开始", "选择一种体验", "把灵感变成可继续的世界", "快速设定", "炼金台"]) {
    assert.ok(consoleJs.includes(phrase), `${phrase} should be present`);
  }
  for (const action of [
    'data-action="install-first-run-demo"',
    'data-action="library-alchemy"',
    'data-action="quick-start-chat"',
    'data-view="experiences"',
    'data-view="creation"'
  ]) {
    assert.ok(consoleJs.includes(action), `${action} should be wired`);
  }
});

test("play screen keeps expected player controls and review affordances", () => {
  for (const marker of [
    "chat-messages",
    "message-tools",
    "open-command-panel",
    "proposal-dot-button",
    "drawer-branches",
    "opening-suggestions",
    "use-opening-suggestion",
    "status-panel"
  ]) {
    assert.ok(consoleJs.includes(marker), `${marker} should be present`);
  }
});

test("settings IA is grouped into connection, narrative, and advanced cards", () => {
  for (const marker of [
    'id: "connections", label: "连接"',
    'id: "narrative", label: "叙事"',
    'id: "advanced", label: "高级"',
    "settings-card-grid",
    "renderNarrativeSettings",
    "renderAdvancedSettingsCard",
    "test-connection",
    "我的内容",
    "settings-readiness"
  ]) {
    assert.ok(consoleJs.includes(marker), `${marker} should be present`);
  }
});

test("visual language defines Living Archive tokens, responsive shell, and reduced motion", () => {
  for (const marker of [
    "--wt-bg-canvas",
    "--wt-accent-forest",
    "--wt-font-reading",
    "--wt-focus-ring",
    "prefers-reduced-motion:reduce",
    ".entry-grid",
    ".opening-suggestions",
    ".settings-card-grid"
  ]) {
    assert.ok(consoleCss.includes(marker), `${marker} should be present`);
  }
});
