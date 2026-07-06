import test from "node:test";
import assert from "node:assert/strict";

import { scanHiddenEntityCooccurrence } from "../../src/core/system/hidden-leak-audit.js";
import { scanScriptplaySpoilers } from "../../src/core/modules/scriptplay/scriptplay-spoiler-guard.js";

test("hidden cooccurrence audit catches two hidden entities in one visible paragraph", () => {
  const result = scanHiddenEntityCooccurrence(
    "村长在月光下露出龙的影子。",
    { modeId: "single-player-scriptkill-v2", hiddenTruth: "村长其实是龙" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.findings[0].type, "hidden_entity_cooccurrence");
});

test("hidden cooccurrence audit stays quiet for non-truth modes by default", () => {
  const result = scanHiddenEntityCooccurrence(
    "村长在月光下露出龙的影子。",
    { modeId: "world-rpg", hiddenTruth: "村长其实是龙" }
  );
  assert.equal(result.ok, true);
});

test("scriptplay spoiler guard enables semantic hidden audit by default", () => {
  const result = scanScriptplaySpoilers("村长提到龙鳞时忽然沉默。", {
    hiddenTruth: "村长是龙",
    modeId: "single-player-scriptkill-v2"
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.type === "hidden_entity_cooccurrence"));
});
