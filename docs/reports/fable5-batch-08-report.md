# Fable5 Batch 08 Report

Batch: 08 - AI interaction layer provider prompt usage recap

Status: PASS for local implementation and deterministic validation.

Real provider smoke: BLOCKED_BY_CREDENTIALS. No real Anthropic, Google, OpenAI-compatible, or production DeepSeek key was used or claimed as PASS in this batch.

## Scope Completed

- Added a provider adapter layer with `chat`, `chatStream`, `supports`, `normalizeError`, and `countHint` coverage for OpenAI-compatible, Anthropic, Google/Gemini, and mock providers.
- Routed `connections.json` provider keys into both connection diagnostics and runtime LLM calls; mock provider is an explicit local no-key adapter while real remote providers still require credentials.
- Preserved OpenAI-compatible JSON-mode fallback when endpoints reject `response_format: json_object`.
- Added stable-to-volatile prompt section rendering with tagged prompt sections for cache-friendly prompt ordering.
- Added runtime usage metering to write staged token estimates to `runtime/usage.jsonl`; chat responses and the console display expose turn/session totals and optional cost estimates.
- Added session recap proposal shaping so recap `newFacts` become pending review candidates and never write canon directly.
- Added pipeline profiles in `defaults/pipeline-profiles.json`, surfaced quality/speed/cost mappings in settings, and wired the default profile into chat pipeline selection.

## Validation

- `node --check server.js`
- `node --check world-tree-console.js`
- `node --check src/adapters/llm.js`
- `node --check src/adapters/providers/index.js`
- `node --check src/adapters/providers/openai-compatible.js`
- `node --check src/adapters/providers/anthropic.js`
- `node --check src/adapters/providers/google.js`
- `node --check src/adapters/providers/mock.js`
- `node --check src/core/narrative/session-recap.js`
- `node --check src/core/llm/pipeline-profiles.js`
- `node --check src/core/llm/usage-meter.js`
- `node --check src/core/prompts/prompt-section-order.js`
- `node --test tests/unit/provider-adapters.test.js tests/unit/prompt-section-order.test.js tests/unit/usage-meter.test.js tests/unit/session-recap.test.js tests/unit/pipeline-profiles.test.js tests/integration/connection-diagnostics.test.js tests/integration/llm-chat-stream-and-message-op.test.js tests/integration/llm-retry-persistence.test.js`

Targeted result: PASS.

Preflight: PASS.
