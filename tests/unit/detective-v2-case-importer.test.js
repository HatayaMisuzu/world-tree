import test from "node:test";
import assert from "node:assert/strict";
import { classifyDetectiveCaseInput, extractDetectiveCaseSectionsFromText, parseDetectiveCaseJson, createDetectiveCaseDraftFromExternalText, validateExternalDetectiveCaseCompleteness, buildDetectiveImportPreview } from "../../src/core/detective/detective-case-importer.js";

test("classify: JSON case capsule", () => {
  const r = classifyDetectiveCaseInput({ text: '{"schemaVersion":"world-tree.detective.v2.case.1","caseId":"c1","title":"Test"}' });
  assert.equal(r.inputType, "structured_json_case_capsule");
});

test("classify: markdown", () => {
  const r = classifyDetectiveCaseInput({ text: "# Title\n## Case\nSome text" });
  assert.equal(r.inputType, "markdown_case_design");
});

test("classify: plain text", () => {
  const r = classifyDetectiveCaseInput({ text: "A murder happened" });
  assert.equal(r.inputType, "plain_text_case_design");
});

test("classify: empty", () => {
  assert.equal(classifyDetectiveCaseInput({ text: "" }).inputType, "unknown");
});

test("extractSections: finds headings", () => {
  const s = extractDetectiveCaseSectionsFromText("# Test Case\n\n## Truth\nculprit: Bob\n## Evidence\nA knife was found");
  assert.ok(s.truthText);
  assert.ok(s.evidenceText);
});

test("parseDetectiveCaseJson: valid JSON", () => {
  const r = parseDetectiveCaseJson({ text: '{"title":"Test","truthLedger":{"culpritIds":["x"],"motive":"greed","method":"poison"}}' });
  assert.equal(r.status, "ok");
});

test("createDraft: marks needs_completion without truth", () => {
  const draft = createDetectiveCaseDraftFromExternalText("A simple case", {});
  const c = validateExternalDetectiveCaseCompleteness(draft);
  assert.equal(c.playable, false);
  assert.ok(c.missing.length > 0);
});

test("buildImportPreview: no hidden truth", () => {
  const p = buildDetectiveImportPreview({ text: '{"title":"Test","truthLedger":{"culpritIds":["x"],"motive":"m","method":"m2"}}' });
  // Player case view must not contain truthLedger key
  assert.equal(p.playerCaseView?.truthLedger, undefined, "playerCaseView contains truthLedger");
  // Preview hasTruthLedger is a flag, not the actual truth
  assert.ok(typeof p.preview?.hasTruthLedger === "boolean");
});
