import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePromptRuntimeIdentity,
  getPromptModeId,
  isKnownPromptMode
} from "../../src/core/prompts/prompt-runtime-identity.js";

test("active modes resolve to their own prompt mode", () => {
  for (const modeId of [
    "quick-setting",
    "character",
    "world-rpg",
    "tabletop",
    "mystery-puzzle",
    "strategy-sim",
    "murder-mystery"
  ]) {
    assert.equal(resolvePromptRuntimeIdentity({ modeId }).promptModeId, modeId);
  }
});

test("worldbook without modeId falls back safely to world-rpg", () => {
  const r = resolvePromptRuntimeIdentity({ dataMode: "worldbook" });
  assert.equal(r.promptModeId, "world-rpg");
  assert.ok(r.warnings.some((w) => w.includes("worldbook")));
});

test("worldSubType can infer tabletop prompt mode", () => {
  assert.equal(getPromptModeId({ dataMode: "worldbook", worldSubType: "tabletop" }), "tabletop");
});

test("known prompt modes are recognized", () => {
  assert.equal(isKnownPromptMode("murder-mystery"), true);
  assert.equal(isKnownPromptMode("unknown-mode"), false);
});
