import test from "node:test";
import assert from "node:assert/strict";

import { REQUIRED_STATUS, validateTruthDocuments } from "../../scripts/lib/truth-status-model.mjs";

const version = "0.5.0-prehuman.2";
const valid = `${version}\nbounded baseline\n${REQUIRED_STATUS.join("\n")}\nworkflow green is not provider PASS`;

test("truth status model accepts a consistent bounded document set", () => {
  assert.equal(validateTruthDocuments({ "truth.md": valid }, { version }).ok, true);
});

test("truth status model catches an intentionally contradictory fixture", () => {
  const contradictory = `${valid}\nPREHUMAN_STABLE_BASELINE = NOT ACHIEVED\nV1.0_READY = YES`;
  const result = validateTruthDocuments({ "contradictory.md": contradictory }, { version });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes("contradictory prehuman")), true);
  assert.equal(result.errors.some((error) => error.includes("contradictory v1")), true);
});
