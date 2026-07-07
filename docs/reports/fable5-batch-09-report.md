# Fable5 Batch 09 Report

Batch: 09 - WTPack and ecosystem import

Status: PASS for local implementation and deterministic validation.

## Scope Completed

- Added `.wtpack` JSON container support with `manifest.specVersion: 1`, required manifest fields, per-file SHA-256 checksums, and import-time checksum verification.
- Added `.wtpack` API routes for export/import while preserving existing `.worldtree` compatibility.
- Export strips private/runtime-only files such as usage logs, chat/memory logs, debug/session logs, secrets, and `userData`.
- Import rejects unsafe paths through the existing strict import path validator and refuses checksum mismatches.
- Extended SillyTavern character parsing to report `ignoredUnsupportedFields` instead of silently swallowing unknown fields.
- Covered ST PNG `chara` chunk parsing with pure JS fixtures.
- Added ST World Info/lorebook import mapping and `/api/worldbook/import` preview/commit support.
- Established `content/` official content pipeline docs and manifest requirements for future reviewed content packs.

## Validation

- `node --check server.js`
- `node --check src/server/wtpack-service.js`
- `node --check src/core/data/alchemy/parsers/st-card.js`
- `node --check src/core/data/alchemy/parsers/nai-lorebook.js`
- `node --test tests/unit/wtpack-service.test.js tests/unit/st-import-parsers.test.js tests/unit/official-content-pipeline.test.js tests/integration/wtpack-import-export.test.js tests/integration/worldpack.test.js`

Targeted result: PASS.

Preflight: PASS.
