import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROMPT_SAFETY_CLAUSES, joinPromptSafetyClauses } from "../../src/core/prompts/prompt-safety-clauses.js";
import { auditLlmEntryPromptCoverage, ENTRY_LLM_AUDIT_SCENARIOS } from "../../src/core/prompts/llm-entry-audit.js";
import { callLLMByRole } from "../../src/adapters/llm.js";

test("prompt safety clauses cover JSON, privacy, hidden truth, and proposal/canon boundaries", () => {
  assert.match(PROMPT_SAFETY_CLAUSES.jsonOnly, /strict JSON only/);
  assert.match(PROMPT_SAFETY_CLAUSES.localPrivacy, /filesystem paths|API keys|secrets/);
  assert.match(PROMPT_SAFETY_CLAUSES.hiddenTruth, /culprit identity|role-private knowledge/);
  assert.match(PROMPT_SAFETY_CLAUSES.proposalCanonBoundary, /candidates or proposals/);
  assert.match(PROMPT_SAFETY_CLAUSES.productPublicView, /Strategy Sim|ScriptKill/);
  assert.match(PROMPT_SAFETY_CLAUSES.featureFocus, /general-purpose chat assistant/);
  assert.match(PROMPT_SAFETY_CLAUSES.oocGuard, /break character|generic AI model/);
  assert.match(PROMPT_SAFETY_CLAUSES.antiHallucination, /Do not invent/);
  assert.match(joinPromptSafetyClauses("jsonOnly", "hiddenTruth"), /strict JSON only[\s\S]*hidden truth/);
});

test("LLM adapter imports and applies prompt safety clauses before outbound calls", () => {
  assert.equal(typeof callLLMByRole, "function");
  const source = readFileSync(new URL("../../src/adapters/llm.js", import.meta.url), "utf8");
  assert.match(source, /joinPromptSafetyClauses/);
  assert.match(source, /scrubPromptForPrivacy/);
  assert.match(source, /proposalCanonBoundary/);
  assert.match(source, /productPublicView/);
  assert.match(source, /featureFocus/);
  assert.match(source, /oocGuard/);
  assert.match(source, /antiHallucination/);
});

test("full-function entry prompt audit covers derailment, OOC, hallucination, and canon-overwrite probes", () => {
  const result = auditLlmEntryPromptCoverage();
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.equal(result.rows.length, 8);
  assert.ok(ENTRY_LLM_AUDIT_SCENARIOS.some((scenario) => scenario.id === "prompt-injection-generic-ai"));
  for (const row of result.rows) {
    assert.equal(row.status, "PASS", `${row.featureId}: ${row.missingSignals.join(", ")}`);
  }
});

test("prompt audit report exists and records required product risks", () => {
  const report = readFileSync(new URL("../../docs/reports/llm-prompt-audit-report.md", import.meta.url), "utf8");
  for (const phrase of ["JSON-only", "hidden truth", "Detective", "ScriptKill", "Strategy Sim", "Worldbook", "local paths", "canon", "OOC", "generic chat", "prompt injection", "full-function entry"]) {
    assert.match(report, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
