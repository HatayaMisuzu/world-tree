import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTabletopV2PolishPrompt,
  looksLikeRuleChange
} from "../../src/core/tabletop/tabletop-v2-llm-polish.js";

test("tabletop polish prompt forbids reroll and state change", () => {
  const packet = buildTabletopV2PolishPrompt({
    deterministicText: "【行动裁定】投骰: 1d20 = 18 (success)"
  });
  assert.match(packet.promptText, /不得改变投骰/);
  assert.match(packet.promptText, /不得新增/);
});

test("looksLikeRuleChange rejects removed dice terms", () => {
  assert.equal(
    looksLikeRuleChange("你成功了。", "投骰: 1d20 = 18 (success)"),
    true
  );
});
