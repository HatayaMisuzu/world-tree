import test from "node:test";
import assert from "node:assert/strict";

import { orderPromptSections, renderOrderedPromptSections } from "../../src/core/prompts/prompt-section-order.js";

test("prompt sections render from stable to volatile", () => {
  const rendered = renderOrderedPromptSections([
    { kind: "turn_input", content: "user turn" },
    { kind: "runtime_orchestration", content: "runtime flags" },
    { kind: "canon_summary", content: "canon" },
    { kind: "system_identity", content: "identity" },
    { kind: "recent_history", content: "history" }
  ]);
  assert.ok(rendered.indexOf("<WT:system_identity>") < rendered.indexOf("<WT:canon_summary>"));
  assert.ok(rendered.indexOf("<WT:canon_summary>") < rendered.indexOf("<WT:recent_history>"));
  assert.ok(rendered.indexOf("<WT:recent_history>") < rendered.indexOf("<WT:turn_input>"));
  assert.ok(rendered.indexOf("<WT:turn_input>") < rendered.indexOf("<WT:runtime_orchestration>"));
});

test("empty prompt sections are removed before ordering", () => {
  const sections = orderPromptSections([
    { kind: "turn_input", content: "" },
    { kind: "system_identity", content: "identity" }
  ]);
  assert.deepEqual(sections.map((item) => item.kind), ["system_identity"]);
});
