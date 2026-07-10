import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("critical product actions state their impact and require explicit confirmation", async () => {
  const [navigation, content, settingsView] = await Promise.all([
    readFile(new URL("../../browser/controllers/navigation-controller.js", import.meta.url), "utf8"),
    readFile(new URL("../../browser/controllers/content-controller.js", import.meta.url), "utf8"),
    readFile(new URL("../../browser/views/creation-settings-views.js", import.meta.url), "utf8")
  ]);

  assert.match(navigation, /第二次确认：允许该关键提案进入已批准状态/);
  assert.match(navigation, /拒绝这个变化？它不会写入 shared canon/);
  assert.match(content, /此操作不可恢复/);
  assert.match(content, /确认交付？这会把内容写入本地世界\/数据入口/);
  assert.match(settingsView, /id="connKey" type="password" autocomplete="off"/);
  assert.match(settingsView, /不进入仓库、世界包、页面日志或截图/);
});
