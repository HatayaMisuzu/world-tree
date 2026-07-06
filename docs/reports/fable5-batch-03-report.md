# fable5 Batch 03 Report: Demos And Real LLM Smoke Gate

## Scope

- Added the original demo world `demo-world-cloud-steam-city` / `云上蒸汽城`.
- Registered the demo in `defaults/examples/manifest.json` as the first-run recommended playable demo.
- Added first-run workbench UI for one-click demo install and suggested first input.
- Added `npm run smoke:first-play` and `.github/workflows/first-play-smoke.yml`.
- Added `docs/STATUS_TERMINOLOGY.md` terms for `First playable candidate`, `PLAYABLE`, `BLOCKED_BY_CREDENTIALS`, and `HUMAN_VALIDATION_REQUIRED`.

## Validation

- `node --check scripts/smoke-first-play.mjs`
- `node --check world-tree-console.js`
- `node --check tests/integration/smoke-first-play.test.js`
- `node --check server.js`
- `node --test tests/integration/examples-install-smoke.test.js tests/integration/smoke-first-play.test.js`
- `npm run test:console-boundary`
- `npm run smoke:first-play`
- `npm run docs:check`
- `npm run truth:check`
- `git diff --check`
- `npm run test:unit`
- `npm run preflight`

## Preflight Result

- First preflight attempt failed in `npm run test:unit` because legacy example tests still assumed every example was a blank template.
- Fixed the tests to enforce `1` playable demo plus `8` blank templates.
- Re-run `npm run preflight`: PASS.
- Final `interface-audit`: 168 passed / 0 warnings / 0 errors.

## Real LLM Status

- `npm run smoke:first-play`: `BLOCKED_BY_CREDENTIALS` in this environment because `WT_SMOKE_BASE_URL`, `WT_SMOKE_MODEL`, and `WT_SMOKE_KEY` are not set.
- The script and workflow are implemented. No mock or fake provider result is recorded as a real LLM PASS.
- Local fake LLM coverage exists only as script/integration validation.

## Human Validation Status

- Human playtest: `HUMAN_VALIDATION_REQUIRED`.
- Screen recording: `HUMAN_VALIDATION_REQUIRED`.
- Project status after this batch can be at most `FIRST_PLAYABLE_CANDIDATE`; it is not `PLAYABLE`.
