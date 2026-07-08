# Release Readiness

Status: NOT READY FOR FULL PRODUCTIZATION RELEASE.

## Current Readiness

| Area | Status | Evidence |
|---|---|---|
| Install command | PASS | `npm install` |
| Local start and health | PASS | isolated start smoke: `/api/health` returned `ok`, console returned HTTP 200 |
| Console static assets | PASS | `ui-labels.js` is served by the local server and included in npm pack verification |
| Local-only policy | COVERED BY TESTS | integration security tests |
| Creation Forge G1 | AUTOMATED PASS | `npm run test:alchemy-closure` |
| Worldbook V2 foundation | AUTOMATED PASS | `npm run test:worldbook-v2` |
| Strategy Sim V2 foundation | AUTOMATED PASS | `npm run test:strategy-sim-v2` |
| Selected V2 API/service loops | AUTOMATED PASS | `npm run test:v2-product-playable`, `npm run smoke:v2-product-playable-api` |
| Selected V2 browser/UI entry flows | AUTOMATED PASS / NOT HUMAN-SIGNED PLAYABLE | `npm run smoke:product-entry-browser-matrix` proves 8/8 entry reachability, next-step clarity, clean browser health, and selected V2 API product loops |
| Full-function LLM prompt entry audit | AUTOMATED PASS / SELECTED DEEPSEEK LIVE SMOKE RECORDED | `npm run test:llm-prompts`, `node scripts/audit-llm-prompts.mjs`; selected live evidence does not prove product-wide behavior |
| V2 entry service slices | AUTOMATED PASS | `npm run test:world-tree-v2-entries` |
| Project audit | AUTOMATED PASS | `npm run test:project-complete-audit` |
| User-created content closure | PASS | Flow A and Flow B evidence recorded in `docs/reports/user-created-content-closure-evidence.md` |
| Blank template infrastructure | PASS | eight `blank_template` placeholders install and read back as empty structures |
| User-Created Content Product Closure | PASS | Flow A/B API evidence and browser/API hybrid smoke recorded |
| Blank Template Infrastructure | PASS | blank placeholders install/readback and guard tests recorded |
| DeepSeek V4 Flash provider compatibility | IMPLEMENTED / PENDING CURRENT REAL SMOKE | DeepSeek profile uses disabled thinking support; provider compatibility must be proven by current env-only real API smoke before being recorded as evidence |
| DeepSeek selected real LLM smoke | RECORDED WITH EXPOSED USAGE | `/api/llm/test`, `smoke:first-play`, `smoke:user-content-real-llm`, selected key paths, and long-prefix cache probe recorded external/redacted evidence; first-play/user-content chat turns include exact exposed usage |
| Product-wide Real LLM closure | NOT COMPLETE | local fallback is not counted as real LLM; selected DeepSeek smoke does not prove every product path |
| Tier-1 provider matrix | BLOCKED WITHOUT SECRETS | `.github/workflows/first-play-smoke.yml` supports workflow_dispatch and nightly matrix, but each provider needs its own secrets |
| Tier-2 narrative eval | DRY RUN READY | `npm run narrative:eval` uses 20 fixed scenarios and mock playback; this is not real LLM quality evidence |
| Anonymous self-report | READY | `npm run self-report` emits aggregate usage/chat counts without prompt or response content |
| Built-in first-play example | FIRST_PLAYABLE_CANDIDATE EVIDENCE | `demo-world-cloud-steam-city` / 云上蒸汽城 is implemented for `smoke:first-play`; role-card and scriptkill packs remain deferred |
| Browser/manual smoke | AUTOMATED ENTRY MATRIX PASS / MANUAL PLAYABLE QA NOT RUN | 8/8 product entry browser matrix passed; full human playtest and 60s recording still not supplied |

## Release Decision

Do not publish npm, Docker, or GitHub Release from this state.

This branch is suitable as a productization closure evidence branch with PARTIAL status. A release candidate needs:

1. Human playtest evidence and a 60 second or longer screen recording for any entry claimed PLAYABLE.
2. Role-card and scriptkill demo content packs completed and tested if they are advertised as built-in playable examples.
3. Human/manual smoke evidence for major entries beyond the automated entry matrix.
4. Broader product-wide real LLM evidence beyond selected DeepSeek smoke paths, plus usage exposure for endpoints that still do not return provider usage.
5. Final full validation after examples are restored.
6. Explicit version decision.

## Release Checklist

- [ ] `npm run preflight` PASS on the release commit.
- [x] `npm run release:verify` PASS and npm pack dry-run confirms package size, required console assets including `ui-labels.js`, plus no `userData/`, `audit/`, `output/`, runtime worlds, characters, or secrets.
- [x] `npm run smoke:first-play` PASS for DeepSeek V4 Flash with `WT_SMOKE_BASE_URL`, `WT_SMOKE_MODEL`, and `WT_SMOKE_KEY`.
- [x] `npm run smoke:product-entry-browser-matrix` PASS for all 8 entries.
- [x] `npm run ci:github-actions-checks` can verify GitHub Actions check-runs; do not rely on legacy combined status alone.
- [ ] Tier-1 provider matrix workflow has either PASS artifacts or explicit `BLOCKED_BY_CREDENTIALS` artifacts per provider.
- [ ] `npm run narrative:eval` dry run PASS, and any real Tier-2 quality run is reviewed separately.
- [ ] At least one human playtest record exists for each entry claimed PLAYABLE.
- [ ] At least one screen recording of 60 seconds or longer exists for each entry claimed PLAYABLE.
- [ ] PLAYABLE status is `HUMAN_SIGNED`; an agent cannot self-sign it.
- [ ] Release notes link the smoke, pack, preflight, human playtest, and screen recording evidence.
