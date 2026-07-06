# Fable5 Batch 04 Report

Batch: 04 - P1 streaming incremental chat rendering

Status: PASS for local implementation and fake-provider validation.

Credential-gated status: BLOCKED_BY_CREDENTIALS for real external LLM streaming compatibility, because this run did not have a real provider key available. The batch implements the scriptable route and local fake-provider validation without claiming real-provider PASS.

## Scope Completed

- Added `/api/llm/chat/stream` SSE endpoint.
- SSE events include `stage`, `delta`, `done`, and `error`.
- Added OpenAI-compatible stream parser in the LLM adapter.
- Added automatic fallback from upstream stream failure to non-streaming completion.
- Added frontend `ReadableStream` SSE reader and chat streaming API.
- Added incremental update of the current assistant bubble instead of full chat redraw for token deltas.
- Added stop button with `AbortController`; partial stopped content is local-only and server persistence is only accepted on `done`.
- Added md-lite rendering that escapes first, then renders a small whitelist.
- Added `/api/chat/message-op`; legacy `/api/chat/message` remains compatible and returns `Deprecation: true`.

## Validation

- `node --check src/adapters/llm.js`
- `node --check server.js`
- `node --check world-tree-client-core.js`
- `node --check world-tree-console.js`
- `node --test tests/unit/llm-stream-parser.test.js tests/unit/console-client-core.test.js tests/integration/llm-chat-stream-and-message-op.test.js`
- `npm run test:console-boundary`
- `node --test tests/unit/llm.test.js tests/unit/llm-error-mapper.test.js tests/unit/llm-stream-parser.test.js`
- `node --test tests/integration/llm-retry-persistence.test.js tests/integration/llm-chat-stream-and-message-op.test.js`

Preflight: PASS.
