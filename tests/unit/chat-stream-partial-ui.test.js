import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const controllerPath = new URL("../../browser/controllers/play-controller.js", import.meta.url);
const componentPath = new URL("../../browser/components/product-components.js", import.meta.url);
const entryPath = new URL("../../browser/controllers/entry-controller.js", import.meta.url);

test("stopping a stream marks the visible assistant fragment partial without claiming server persistence", async () => {
  const source = await readFile(controllerPath, "utf8");
  assert.match(source, /activeChatAbortController\.abort\(\)/);
  assert.match(source, /streamingAssistant\.turnStatus = "partial"/);
  assert.match(source, /streamingAssistant\.sourceInput = text/);
  assert.match(source, /服务端仅在完成后保存/);
});

test("partial fragment UI explains the boundary and restores the original input", async () => {
  const [component, controller, entry] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(controllerPath, "utf8"),
    readFile(entryPath, "utf8")
  ]);
  assert.match(component, /已中止 · 未保存/);
  assert.match(component, /仅在当前页面保留/);
  assert.match(component, /data-action="retry-partial"/);
  assert.match(controller, /action === "retry-partial"/);
  assert.match(controller, /AS\.chatDraft = msg\.sourceInput/);
  assert.match(entry, /"retry-partial"/);
});
