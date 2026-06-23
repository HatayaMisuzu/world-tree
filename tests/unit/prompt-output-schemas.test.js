// tests/unit/prompt-output-schemas.test.js
// Verify output schemas and mode output sections
import test from "node:test";
import assert from "node:assert/strict";
import { getModeOutputSections, getTaskSchema, validateTaskOutput, MODE_OUTPUT_SECTIONS } from "../../src/core/prompts/prompt-output-schemas.js";

test("each mode has output sections defined", () => {
  const modes = Object.keys(MODE_OUTPUT_SECTIONS);
  assert.ok(modes.length >= 8);
  for (const modeId of modes) {
    const sections = getModeOutputSections(modeId);
    assert.ok(sections, `${modeId}: sections must exist`);
    assert.ok(sections.allowed.length > 0, `${modeId}: must have allowed sections`);
    assert.ok(sections.primary, `${modeId}: must have primary section`);
  }
});

test("creation forge forbids canon write", () => {
  const forge = getModeOutputSections("creation-forge");
  assert.ok(forge.forbidden.includes("canon_write"));
  assert.ok(forge.forbidden.includes("project_auto_create"));
});

test("murder mystery forbids truth lock exposure", () => {
  const mm = getModeOutputSections("murder-mystery");
  assert.ok(mm.forbidden.includes("truth_lock_exposure"));
  assert.ok(mm.forbidden.includes("killer_self_reveal"));
});

test("task schema validation is non-blocking for text types", () => {
  const r = validateTaskOutput("telemetry-explanation", "test output");
  assert.equal(r.ok, true);
});

test("task schema returns warnings for unknown tasks", () => {
  const r = validateTaskOutput("unknown_task", {});
  assert.ok(r.warnings.length > 0);
});

test("all mode output sections have consistent structure", () => {
  for (const [modeId, sections] of Object.entries(MODE_OUTPUT_SECTIONS)) {
    assert.ok(Array.isArray(sections.allowed), `${modeId}: allowed must be array`);
    assert.ok(Array.isArray(sections.forbidden), `${modeId}: forbidden must be array`);
    assert.ok(typeof sections.primary === "string", `${modeId}: primary must be string`);
  }
});
