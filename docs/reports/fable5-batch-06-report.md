# Fable5 Batch 06 Report

Batch: 06 - P1 worldbook history and chat source reconciliation

Status: PASS for local implementation and fake-provider validation.

## Scope Completed

- Upgraded worldbook matching to scan current input plus recent user/assistant history.
- Context budget now controls history rounds; runtime scans up to `historyTurns * 2` recent messages.
- Added trigger support for plain substring keys, `re:/.../i`, legacy `/.../i`, and `w:word` whole-word keys.
- Added recursive activation depth 1 from activated entry content.
- Ranking now considers layer, hit count, priority, and smaller entry cost before runtime budget trimming.
- Preserved legacy `scanDepth` semantics for history windows while always allowing current input to match.
- Changed frontend chat localStorage behavior: server `chat.jsonl` is the history source of truth; localStorage only stores unsent drafts.
- Updated API docs for chat endpoints, deprecated `/api/chat/message`, worldbook matching behavior, and chat history source-of-truth rules.

## Validation

- `node --check src/core/data/worldbook.js`
- `node --check src/core/runtime/worldbook-runtime.js`
- `node --check world-tree-console.js`
- `node --test tests/unit/worldbook-runtime.test.js tests/unit/chat-history-source.test.js`
- `node --test tests/unit/worldbook*.test.js tests/unit/chat-history-source.test.js`
- `npm run test:console-boundary`
- `node --test tests/integration/llm-retry-persistence.test.js tests/integration/llm-chat-stream-and-message-op.test.js tests/integration/world-session-isolation.test.js`
- `node --test tests/integration/user-data-isolation.test.js`
- `npm run docs:check`
- `npm run truth:check`
- `npm run preflight`

Targeted result: PASS.

Preflight: PASS.
