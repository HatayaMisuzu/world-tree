// tests/unit/workflow-context-envelope.test.js
import test from "node:test"; import assert from "node:assert/strict";
import { createWorkflowContextEnvelope, inferWorkflowType, validateWorkflowEnvelope } from "../../src/core/workflow/workflow-context-envelope.js";
test("inferWorkflowType detects continue turn", () => assert.equal(inferWorkflowType({ userInput: "继续探索" }), "continue_turn"));
test("inferWorkflowType detects creation wizard", () => assert.equal(inferWorkflowType({ action: "create" }), "creation_wizard"));
test("inferWorkflowType detects character chat", () => assert.equal(inferWorkflowType({ modeId: "character" }), "character_chat"));
test("workflow envelope has correct defaults", () => {
  const env = createWorkflowContextEnvelope({ modeId: "world-rpg" });
  assert.equal(env.authority.candidateOnly, true);
  assert.equal(env.authority.canonWriteAllowed, false);
});
test("validateWorkflowEnvelope rejects missing modeId", () => {
  assert.equal(validateWorkflowEnvelope({}).ok, false);
});
