# Fable5 Batch 00 Reality Check

Date: 2026-07-06

Branch: `codex/fable5-productization`

Remote: `https://github.com/HatayaMisuzu/world-tree.git`

## Truth Source

The active fable5 revised four-file packet was copied into `docs/plans/`:

- `docs/plans/fable5-01-full-audit-revised.md`
- `docs/plans/fable5-02-fix-plan-revised.md`
- `docs/plans/fable5-03-optimization-plan-revised.md`
- `docs/plans/fable5-04-future-execution-revised.md`

These files define the ordered batch plan and the evidence vocabulary for this run. They do not mark any new capability complete by themselves.

## Script Baseline

`package.json` already exposes the required gates for this run:

- `npm run docs:check`
- `npm run truth:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run release:verify` is not present at baseline and is scheduled for Batch 01.
- `npm run smoke:first-play` is not present at baseline and is scheduled for Batch 03.
- `npm run preflight` exists and is the mandatory per-batch gate.

## File Reality Map

Key files confirmed at Batch 00:

- `server.js`: main HTTP entry and route dispatcher.
- `world-tree-console.js`: main vanilla JS browser UI script.
- `world-tree-client-core.js`: browser API/client utility boundary.
- `src/adapters/llm.js`: current OpenAI-compatible LLM adapter path.
- `src/server/module-service.js`: module creation service.
- `defaults/examples/manifest.json`: blank structural examples at baseline.
- `docs/PROJECT_TRUTH_SOURCE.md`, `docs/CURRENT_PROJECT_STATE.md`, `docs/INDEX.md`, and `docs/DOC_REGISTRY.json`: active truth-source and lifecycle registry.

## Batch Gate Policy

Every subsequent batch must:

1. Implement code, tests, and documentation for that batch.
2. Run targeted tests for the touched behavior.
3. Run required integration tests when the touched behavior crosses server, persistence, UI, or workflow boundaries.
4. Run `npm run preflight`.
5. Commit with the exact fable5 batch commit message before the next batch starts.

Missing real LLM credentials or external service access must be reported as `BLOCKED_BY_CREDENTIALS`. Missing human playtest or screen recording evidence must be reported as `HUMAN_VALIDATION_REQUIRED`. Mock provider output cannot be reported as a real LLM pass.

## Batch 00 Validation Results

Commands run before the Batch 00 commit:

```bash
npm run docs:check
npm run truth:check
npm run preflight
git diff --check
```

Results:

- `npm run docs:check`: PASS, 24 checks / 0 failures; doc lifecycle PASS for 21 registered documents.
- `npm run truth:check`: PASS for `0.4.2-v2-engineering-foundation-truth.0`.
- `npm run preflight`: PASS. Final gate reported `interface-audit` 168 pass / 0 warnings / 0 errors.
- `git diff --check`: PASS, no whitespace errors.

No `userData/`, `audit/`, `output/`, or local secret files are part of the Batch 00 tracked diff.
