# Release Readiness

Status: NOT READY FOR FULL PRODUCTIZATION RELEASE.

## Current Readiness

| Area | Status | Evidence |
|---|---|---|
| Install command | PASS | `npm install` |
| Local start and health | PASS | isolated start smoke: `/api/health` returned `ok`, console returned HTTP 200 |
| Local-only policy | COVERED BY TESTS | integration security tests |
| Creation Forge G1 | AUTOMATED PASS | `npm run test:alchemy-closure` |
| Worldbook V2 foundation | AUTOMATED PASS | `npm run test:worldbook-v2` |
| Strategy Sim V2 foundation | AUTOMATED PASS | `npm run test:strategy-sim-v2` |
| Selected V2 API/service loops | AUTOMATED PASS | `npm run test:v2-product-playable`, `npm run smoke:v2-product-playable-api` |
| Selected V2 browser/UI entry flows | PARTIAL / NOT PROVEN | `npm run smoke:v2-product-shell-browser` proves shell load only |
| Full-function LLM prompt entry audit | AUTOMATED PASS / LIVE LLM BLOCKED | `npm run test:llm-prompts`, `node scripts/audit-llm-prompts.mjs`; no real LLM behavior PASS without credentials |
| V2 entry service slices | AUTOMATED PASS | `npm run test:world-tree-v2-entries` |
| Project audit | AUTOMATED PASS | `npm run test:project-complete-audit` |
| User-created content closure | PASS | Flow A and Flow B evidence recorded in `docs/reports/user-created-content-closure-evidence.md` |
| Blank template infrastructure | PASS | eight `blank_template` placeholders install and read back as empty structures |
| User-Created Content Product Closure | PASS | Flow A/B API evidence and browser/API hybrid smoke recorded |
| Blank Template Infrastructure | PASS | blank placeholders install/readback and guard tests recorded |
| Real LLM Flow | BLOCKED | missing explicit credentials/config; local fallback is not counted as real LLM |
| Tier-1 provider matrix | BLOCKED WITHOUT SECRETS | `.github/workflows/first-play-smoke.yml` supports workflow_dispatch and nightly matrix, but each provider needs its own secrets |
| Tier-2 narrative eval | DRY RUN READY | `npm run narrative:eval` uses 20 fixed scenarios and mock playback; this is not real LLM quality evidence |
| Anonymous self-report | READY | `npm run self-report` emits aggregate usage/chat counts without prompt or response content |
| Bundled story examples | DEFERRED BY PRODUCT DECISION | no story/example world/tutorial/onboarding demo content added |
| Browser/manual smoke | PARTIAL | automated homepage to Alchemy G1 entry smoke passed with clean console; Flow A/B automated local evidence passed; full product-wide manual smoke not run |

## Release Decision

Do not publish npm, Docker, or GitHub Release from this state.

This branch is suitable as a productization closure evidence branch with PARTIAL status. A release candidate needs:

1. Bundled story examples explicitly allowed, added, and tested.
2. Full browser/manual smoke evidence for major entries.
3. Final full validation after examples are restored.
4. Explicit version decision.

## Release Checklist

- [ ] `npm run preflight` PASS on the release commit.
- [ ] `npm run release:verify` PASS and npm pack dry-run confirms package size plus no `userData/`, `audit/`, `output/`, runtime worlds, characters, or secrets.
- [ ] `npm run smoke:first-play` PASS for at least one real provider with `WT_SMOKE_BASE_URL`, `WT_SMOKE_MODEL`, and `WT_SMOKE_KEY`.
- [ ] Tier-1 provider matrix workflow has either PASS artifacts or explicit `BLOCKED_BY_CREDENTIALS` artifacts per provider.
- [ ] `npm run narrative:eval` dry run PASS, and any real Tier-2 quality run is reviewed separately.
- [ ] At least one human playtest record exists for each entry claimed PLAYABLE.
- [ ] At least one screen recording of 60 seconds or longer exists for each entry claimed PLAYABLE.
- [ ] PLAYABLE status is `HUMAN_SIGNED`; an agent cannot self-sign it.
- [ ] Release notes link the smoke, pack, preflight, human playtest, and screen recording evidence.
