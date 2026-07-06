# fable5 Batch 02 Report: LLM Failure Persistence And Retry

## Scope

- Added a stable LLM error mapping contract for unreachable, auth, rate limit, model, timeout, and upstream failures.
- Persisted failed LLM turns to `runtime/chat.jsonl` as append-only `user` + `error` records without advancing normal `turnCount`.
- Added `/api/llm/chat/retry` so retry success appends a formal assistant turn while retaining the original error record.
- Updated the console to show user-facing error cards with codes, technical details, retry actions, and a settings shortcut.
- Preserved unsent chat input after failed LLM calls.

## Validation

- `node --check server.js`
- `node --check world-tree-client-core.js`
- `node --check world-tree-console.js`
- `node --check src/server/llm-error-mapper.js`
- `node --test tests/unit/llm-error-mapper.test.js tests/unit/console-client-core.test.js tests/integration/llm-retry-persistence.test.js`
- `node --test tests/unit/llm.test.js tests/unit/llm-error-mapper.test.js tests/unit/console-client-core.test.js`
- `node --test tests/integration/connection-diagnostics.test.js tests/integration/llm-retry-persistence.test.js`
- `npm run test:console-boundary`
- `npm run docs:check`
- `git diff --check`
- `npm run preflight`

## Preflight Result

- `npm run preflight`: PASS.
- Final `interface-audit`: 168 passed / 0 warnings / 0 errors.

## Credential And Human Validation Status

- No real external LLM key was used for PASS claims.
- Retry integration uses a local fake OpenAI-compatible server.
- Human UI playtest remains `HUMAN_VALIDATION_REQUIRED`.
