import test from "node:test";
import assert from "node:assert/strict";
import {
  getHiddenFieldsForMode,
  isHiddenField,
  GLOBAL_HIDDEN_FIELDS
} from "../../src/core/system/hidden-field-registry.js";

test("global hidden fields included for all modes", () => {
  for (const modeId of [
    "detective",
    "detective-v2",
    "mystery-puzzle",
    "murder-mystery",
    "tabletop",
    "character",
    "single-player-scriptkill",
    "quick-setting"
  ]) {
    const fields = getHiddenFieldsForMode(modeId);
    for (const g of GLOBAL_HIDDEN_FIELDS) {
      assert.ok(fields.has(g), `${modeId} should include global field ${g}`);
    }
  }
});

test("detective aliases include detective hidden fields", () => {
  for (const modeId of ["detective", "detective-v2", "mystery-puzzle", "murder-mystery"]) {
    assert.ok(isHiddenField(modeId, "truthLedger"), `${modeId} should hide truthLedger`);
    assert.ok(isHiddenField(modeId, "isCulprit"), `${modeId} should hide isCulprit`);
    assert.ok(isHiddenField(modeId, "solutionChain"), `${modeId} should hide solutionChain`);
  }
});

test("unknown mode falls back to global only", () => {
  const fields = getHiddenFieldsForMode("nonexistent");
  assert.equal(fields.size, GLOBAL_HIDDEN_FIELDS.length);
});
