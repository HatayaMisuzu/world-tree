import test from "node:test";
import assert from "node:assert/strict";

import { containsForbiddenNormalUiText } from "../../src/core/character/character-v2-advanced-ui-gate.js";

test("normal character UI copy must not expose technical debug terms", () => {
  assert.equal(containsForbiddenNormalUiText("发现一条可能值得保存的记忆"), false);
  assert.equal(containsForbiddenNormalUiText("关系似乎有一点变化"), false);
  assert.equal(containsForbiddenNormalUiText("OOC score 0.82"), true);
  assert.equal(containsForbiddenNormalUiText("module hook failed"), true);
  assert.equal(containsForbiddenNormalUiText("token budget exceeded"), true);
});
