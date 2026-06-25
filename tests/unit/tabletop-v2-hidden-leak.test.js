// Tabletop V2 Hidden Leak Tests
import test from "node:test";
import assert from "node:assert/strict";
import { scanForHiddenLeaks, assertNoHiddenStateInPlayerView } from "../../src/core/tabletop/tabletop-v2-gm-loop.js";
import { stripHiddenState } from "../../src/core/tabletop/tabletop-v2-save-branch.js";

test("scanForHiddenLeaks: detects hidden truth in narration", () => {
  const narration = "你发现村长其实是一只龙。";
  const gmBook = { hiddenTruth: "村长其实是一只龙" };
  const result = scanForHiddenLeaks(narration, {}, gmBook);
  assert.ok(result.leaks.length > 0);
  assert.ok(result.sanitizedNarration.includes("【已隐藏】"));
});

test("scanForHiddenLeaks: clean narration passes", () => {
  const narration = "你走进村庄，看到村民们忙碌着。";
  const gmBook = { hiddenTruth: "村长其实是一只龙" };
  const result = scanForHiddenLeaks(narration, {}, gmBook);
  assert.equal(result.leaks.length, 0);
  assert.equal(result.sanitizedNarration, narration);
});

test("scanForHiddenLeaks: detects hidden clock labels", () => {
  const narration = "末日钟已经走到3了。";
  const hiddenGmState = { hiddenClocks: [{ id: "doom", label: "末日钟" }] };
  const result = scanForHiddenLeaks(narration, hiddenGmState, {});
  assert.ok(result.leaks.length > 0);
});

test("scanForHiddenLeaks: detects NPC secrets", () => {
  const narration = "老法师其实是叛徒。";
  const hiddenGmState = {
    npcSecrets: { old_mage: { trueAllegiance: "老法师其实是叛徒" } },
  };
  const result = scanForHiddenLeaks(narration, hiddenGmState, {});
  assert.ok(result.leaks.length > 0);
});

test("assertNoHiddenStateInPlayerView: flags hiddenGmState key", () => {
  const { safe, violations } = assertNoHiddenStateInPlayerView({
    status: "ok",
    hiddenGmState: {},  // should not be here
  });
  assert.equal(safe, false);
  assert.ok(violations.length > 0);
});

test("assertNoHiddenStateInPlayerView: clean view passes", () => {
  const { safe } = assertNoHiddenStateInPlayerView({
    status: "ok",
    narrative: "一切正常",
    publicClocks: [],
  });
  assert.equal(safe, true);
});

test("stripHiddenState: removes hiddenGmState from run state", () => {
  const runState = {
    runId: "test",
    publicState: { sceneTitle: "Start" },
    hiddenGmState: { clocks: [] },
  };
  const safe = stripHiddenState(runState);
  assert.equal(safe.runId, "test");
  assert.equal(safe.hiddenGmState, undefined);
  assert.equal(safe.publicState.sceneTitle, "Start");
});
