# Fable5 Batch 05 Report

Batch: 05 - P1 WorldSession isolation

Status: PASS for local implementation and fake-provider validation.

## Reality Check

Global singleton state found:

- `src/core/engine/memory-layers.js`: `MEMORY_LAYERS` module singleton, imported/exported through `state-persistence.js`.
- `src/core/engine/director.js`: `PREDICTION_STORES` module singleton, already map-backed but restored wholesale through `state-persistence.js`.
- `src/core/engine/proposal-system.js`: `PROPOSAL_STORE` module singleton, restored wholesale through `state-persistence.js`.
- `src/core/data/relations.js`: `RELATION_STORE` module singleton, restored wholesale through `state-persistence.js`.
- `src/core/data/random-events.js`: event cache singleton, reset through `resetEventCache()`.
- `src/core/engine/global-memory.js`: `MEMORY_STORE` module singleton, currently filtered by `moduleKey` at search time but still process-global in memory.
- `src/core/engine/content-registry.js`: module-level content type registry; mostly constant metadata, not turn mutable.
- `src/core/engine/context-indexer.js`: stateless functions over request data; no mutable singleton found.
- `src/core/engine/overlay-store.js`: policy constants and write-set builders; pending writes are data objects, not an in-module mutable queue.
- `src/core/engine/state-persistence.js`: the import/export choke point for memory, relations, proposals, predictions, events.

Engine state import/export entry points:

- `server.js`: imports `importEngineState`; `buildModuleModel()` calls it when a runtime `engineSnapshot` exists.
- `src/core/engine/lifecycle.js`: imports `exportEngineState`; `completeTurn()` writes `overlayPatch._engineState`.
- `tests/unit/proposal-persistence-audit.test.js`: directly verifies `exportEngineState()` / `importEngineState()`.

Risk observed before changes:

- `buildModuleModel()` restores a module snapshot into process-global engine stores before the LLM call.
- The LLM call awaits network/provider work.
- During that await, another world can restore its snapshot into the same process-global stores.
- `completeTurn()` can therefore export from the wrong restored global state if A/B worlds interleave.

Minimum migration strategy:

- Add `WorldSession` and `SessionRegistry` as the compatibility layer around the existing global stores.
- Keep existing engine APIs and signatures intact.
- Create one session per `moduleKey`.
- Give each session a turn queue so same-world turns serialize.
- Allow different-world LLM calls to run in parallel, but run final global-store restore plus `completeTurn()` plus export in the target session.
- Add `resetEngineState()` so a failed snapshot restore leaves the target session fresh instead of inheriting another world's global state.
- Keep a deprecated default session for legacy tests and moduleKey-less calls.

Test fixtures planned:

- A/B alternating world turns with fake LLM; assert world A writer packet does not receive world B memory.
- Same-world concurrent requests with fake LLM; assert serialized turn count is correct.
- Failed snapshot restore; assert the target session is fresh and does not inherit previously imported memory.

## Validation

Targeted tests:

- `node --check src/core/engine/world-session.js`
- `node --check src/core/engine/state-persistence.js`
- `node --check src/adapters/llm.js`
- `node --check server.js`
- `node --test tests/unit/world-session.test.js tests/integration/world-session-isolation.test.js`
- `node --test tests/unit/proposal-persistence-audit.test.js tests/unit/world-session.test.js tests/unit/llm-stream-parser.test.js`
- `node --test tests/integration/llm-retry-persistence.test.js tests/integration/llm-chat-stream-and-message-op.test.js tests/integration/world-session-isolation.test.js`
- `npm run test:console-boundary`

Targeted result: PASS.

Preflight: PASS.
