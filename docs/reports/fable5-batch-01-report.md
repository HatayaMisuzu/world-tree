# Fable5 Batch 01 Report

Date: 2026-07-06

Commit message: `batch-01: p0 contract json preset release hygiene`

## Scope

Batch 01 implemented the P0 warm-up repairs:

- `FIX-03`: module creation contract validation for explicit quick-setting, character, and narrative modes.
- `FIX-04`: shared LLM JSON extractor with task-level schema validation.
- `FIX-05`: Claude preset now uses OpenRouter through the OpenAI-compatible route.
- `FIX-07`: release hygiene baseline, dead config cleanup, version script cleanup, README license cleanup, fallback truncation alignment, and LF policy.

## Changed Files

- `.gitattributes`
- `README.md`
- `package.json`
- `server.js`
- `start.bat`
- `scripts/release-verify.mjs`
- `src/adapters/llm.js`
- `src/core/diagnostics.js`
- `src/core/llm/json-extract.js`
- `src/server/module-service.js`
- `tests/integration/kernel-completion.test.js`
- `tests/unit/batch01-release-hygiene.test.js`
- `tests/unit/json-extract.test.js`
- `tests/unit/module-service.test.js`

`docs/reports/release-verify-latest.txt` records the latest release verification summary.

## Validation

Targeted commands:

```bash
node --check src/core/llm/json-extract.js
node --check src/adapters/llm.js
node --check src/server/module-service.js
node --check server.js
node --check scripts/release-verify.mjs
node --test tests/unit/json-extract.test.js tests/unit/module-service.test.js tests/unit/llm.test.js tests/unit/batch01-release-hygiene.test.js
node --test tests/integration/quick-project.test.js tests/integration/multi-mode-projects.test.js tests/integration/connection-diagnostics.test.js
npm run release:verify
npm run test:kernel
npm run preflight
```

Results:

- Syntax checks: PASS.
- Targeted unit tests: PASS, 15 tests / 0 failures.
- Targeted integration tests: PASS, 8 tests / 0 failures.
- `npm run release:verify`: PASS, packedSize 718562 bytes, 542 files.
- `npm run test:kernel`: PASS after marking the internal blank world fixture with `allowBlank:true`.
- `npm run preflight`: PASS. Final gate reported `interface-audit` 168 pass / 0 warnings / 0 errors.

## Risk Notes

- Real Anthropic native `/v1/messages` support remains deferred to the provider adapter layer in Batch 08.
- Schema-invalid LLM JSON now falls back instead of being accepted. This may lower apparent Director adoption until prompts/providers reliably return the required shape, but prevents false success.
- `allowBlank:true` is now the explicit escape hatch for intentional internal blank project fixtures; ordinary explicit mode creation still requires source material.
