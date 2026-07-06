import test from "node:test";
import assert from "node:assert/strict";

import { budgetFor, estimateContextTokens } from "../../src/core/engine/context-budget.js";

test("context token estimator handles CJK, ASCII words, and mixed text", () => {
  assert.equal(estimateContextTokens("云上蒸汽城"), 5);
  assert.equal(estimateContextTokens("hello world"), 3);
  const mixed = estimateContextTokens("村长 met the dragon at gate 7.");
  assert.ok(mixed >= 9 && mixed <= 12, `unexpected mixed estimate: ${mixed}`);
});

test("context budgets expose estimated-token limits while preserving char aliases", () => {
  const budget = budgetFor("balanced");
  assert.equal(budget.budgetUnit, "estimated_tokens");
  assert.equal(budget.worldbookTokens, 4200);
  assert.equal(budget.worldbookChars, 4200);
  assert.equal(budget.maxContextTokens, 12000);
});
