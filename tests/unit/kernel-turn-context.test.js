import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJson } from "../../src/server/fs-utils.js";
import { createKernelTurnContext, summarizeKernelTurnContext } from "../../src/core/kernel/kernel-turn-context.js";
import { runWorldTreeModeTurn } from "../../src/core/system/mode-runner.js";

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), "wt-kernel-context-"));
  await writeJson(join(root, "world.json"), { mode: "world-rpg", worldProfileId: "daily-life" });
  await writeJson(join(root, "shared", "world_state.json"), { states: { weather: "clear" }, hiddenTruth: "never expose" });
  await writeJson(join(root, "shared", "worldbook.json"), { entries: [{ id: "inn", title: "旅店", content: "灯火仍亮着", secret: "地下密道" }] });
  await writeJson(join(root, "runtime", "state.json"), { turnCount: 2 });
  return root;
}

test("unified kernel context joins P0-P2 on the active branch without hidden truth leakage", async () => {
  const root = await createProject();
  const context = await createKernelTurnContext({ projectRoot: root, modeId: "world-rpg", userInput: "继续", runtimeFlags: { advanceMode: "auto-light" } });
  const serialized = JSON.stringify(context);
  assert.equal(context.activeBranchId, "main");
  assert.deepEqual(context.debug, { p0: true, p1: true, p2: true, promptChars: context.promptText.length, canonicalWrites: 0 });
  assert.match(context.promptText, /World Tree Kernel Sidecar/);
  assert.doesNotMatch(serialized, /never expose|地下密道/);
  assert.equal("projectRoot" in summarizeKernelTurnContext(context), false);
});

test("mode runner exposes the same safe kernel summary", async () => {
  const result = await runWorldTreeModeTurn({ id: "demo", mode: "quick-setting" }, { text: "继续" });
  assert.equal(result.ok, true);
  assert.equal(result.kernelContext.status.p0, true);
  assert.equal(result.outputPacket.debug.kernel.debug.canonicalWrites, 0);
});
