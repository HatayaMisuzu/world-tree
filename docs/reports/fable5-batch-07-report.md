# Fable5 Batch 07 Report

Batch: 07 - P2 cleanup security budget terminology

Status: PASS for local implementation and deterministic validation.

## Scope Completed

- Added lightweight estimated-token budgeting without a tokenizer dependency; legacy char aliases remain for compatibility.
- Switched worldbook runtime budget trimming to estimated tokens while preserving char diagnostics.
- Stopped new `world.json` writes from carrying regenerable `moduleGraph` / `wrapperGraph`; added `runtime/engine-graph.json` sidecar and old-world merge compatibility.
- Added hidden-truth entity co-occurrence audit and enabled it through the ScriptKill spoiler guard by default for truth-sensitive modes.
- Hardened `secrets.json` writes with POSIX `0o600` chmod on non-Windows platforms and documented plaintext/local-only storage in `SECURITY.md`.
- Added public-facing UI terminology mapping through `ui-labels.js`, replacing normal-user "Experimental" / "thin slice" copy while keeping debug/observe internals intact.
- Added a low-risk server route registry helper as preparation for future server.js route extraction.
- Normalized `docs/INDEX.md` line endings without content changes after the Batch 07 docs check restored it to the audited baseline.

## Validation

- `node --check src/core/engine/context-budget.js`
- `node --check src/core/runtime/worldbook-runtime.js`
- `node --check src/core/system/world-save-hygiene.js`
- `node --check src/core/system/hidden-leak-audit.js`
- `node --check src/server/routes/registry.js`
- `node --check world-tree-console.js`
- `node --test tests/unit/context-budget-tokens.test.js tests/unit/world-save-hygiene.test.js tests/unit/hidden-leak-audit.test.js tests/unit/batch07-hygiene.test.js tests/unit/worldbook-runtime.test.js tests/unit/mode-project-factory.test.js`
- `node --test tests/integration/quick-project.test.js tests/integration/character-project.test.js tests/integration/worldpack.test.js tests/integration/data-roundtrip.test.js`
- `npm run test:console-boundary`
- `npm run docs:check`
- `npm run truth:check`
- `npm run preflight`

Targeted result: PASS.

Preflight: PASS.
