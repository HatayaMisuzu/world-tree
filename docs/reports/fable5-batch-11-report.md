# Fable5 Batch 11 Report

Batch: 11 - Quality governance, docs, release readiness

Status: PASS for local implementation and deterministic validation.

## Scope Completed

- Added Tier-2 narrative evaluation harness with 20 fixed scenarios, rubric checks, and deterministic mock playback fixture.
- Added anonymous `self-report` script that summarizes usage/chat counts without prompt text, responses, secrets, paths, or project ids.
- Added `quality:governance` gate and included it in `npm run preflight`.
- Extended `smoke:first-play` provider metadata and upgraded the GitHub first-play smoke workflow to workflow_dispatch + nightly provider matrix.
- Reworked README first viewport toward player-facing product structure: positioning, GIF placeholder note, three pillars, 60-second start, model services, SillyTavern relationship, and roadmap.
- Moved truth-source/status wording out of README first viewport while retaining required links to `PROJECT_TRUTH_SOURCE` and engineering/product-closure distinctions.
- Added `HUMAN_SIGNED` status terminology and reinforced that agents cannot self-sign PLAYABLE.
- Updated release readiness checklist with smoke, npm pack, preflight, human playtest, screen recording, and release evidence gates.
- Added issue-template/contributing guidance for good first issues, credential blockers, human-validation blockers, and release validation.

## Validation

- `node --check scripts/narrative-eval.mjs`
- `node --check scripts/self-report.mjs`
- `node --check scripts/smoke-first-play.mjs`
- `npm run quality:governance`
- `npm run self-report`
- `npm run smoke:first-play` with temporary empty credential environment: `BLOCKED_BY_CREDENTIALS`
- `npm run release:verify`
- `npm run docs:check`
- `npm run truth:check`

Targeted result: PASS for deterministic gates.

Real LLM result: `BLOCKED_BY_CREDENTIALS`; no real provider key/config was supplied and no real LLM PASS was claimed.

Human playtest / recording: `HUMAN_VALIDATION_REQUIRED`; no human playtest record or 60s screen recording was supplied, so PLAYABLE is not claimed.

Pack result: PASS. `npm pack --dry-run` reported packedSize `749157` bytes, unpackedSize `2748444` bytes, `573` files, and release verification rejected no `userData/`, `audit/`, `output/`, runtime worlds, characters, or secrets.

Preflight: PASS.
