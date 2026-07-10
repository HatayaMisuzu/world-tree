import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBrowserSource } from "../../scripts/lib/browser-source.mjs";

const consoleJs = readBrowserSource();
const consoleCss = readFileSync("world-tree-console.css", "utf8");

test("default console shell is productized as a game lobby", () => {
  assert.match(consoleJs, /id:\s*"workbench",\s*label:\s*"大厅"/);
  for (const phrase of [
    "冒险大厅",
    "继续冒险",
    "最近世界",
    "开始新的冒险",
    "示例/新建"
  ]) {
    assert.ok(consoleJs.includes(phrase), `${phrase} should be present`);
  }
});

test("lobby entry detail exposes required first-run paths", () => {
  for (const phrase of ["这是什么", "示例回放", "用示例开始", "导入素材", "空白开始"]) {
    assert.ok(consoleJs.includes(phrase), `${phrase} should be present`);
  }
  for (const action of [
    'data-action="install-first-run-demo"',
    'data-action="install-example"',
    'data-action="library-alchemy"',
    'data-action="create-world"',
    'data-action="open-settings"'
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
    "test-connection"
  ]) {
    assert.ok(consoleJs.includes(marker), `${marker} should be present`);
  }
});

test("visual language defines paper forest tokens and dark theme", () => {
  for (const marker of [
    "--paper",
    "--forest",
    "--forest-soft",
    "--border",
    "prefers-color-scheme: dark",
    ".entry-grid",
    ".opening-suggestions",
    ".settings-card-grid"
  ]) {
    assert.ok(consoleCss.includes(marker), `${marker} should be present`);
  }
});
