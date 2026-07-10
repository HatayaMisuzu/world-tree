# Current Project State

Version: `0.5.0-product-experience-rebuild.0`
Status: CURRENT TRUTH SOURCE  
Audience: AI agents, maintainers, reviewers.

Any AI agent taking over this repository must read this file and `docs/PROJECT_TRUTH_SOURCE.md` first.

## v0.5 product-experience rebuild

The `main` branch contains the v0.5 user-facing product rebuild without adding a ninth feature or changing the candidate/proposal/canon authority boundary. The global IA is now 首页、体验、我的内容、创作、设置. Automated evidence includes the 8/8 product entry matrix, four-viewport visual QA, the browser golden path, and the v0.5 interaction regression gate for character search, Tabletop busy cleanup, model connection states, and API async boundaries.

The same tracked source was synchronized without deletion into `D:\工作台\新建文件夹` for a real DeepSeek V4 Flash smoke on 2026-07-10. Three turns passed with no local fallback, six persisted chat records, third-turn context continuity, and 16,115 exposed tokens total (7,296 cache-hit). The key was supplied only by process environment and prefix scans found zero persisted occurrences in the repository, test copy, and smoke report directory.

## fable5 productization run

The fable5 revised four-file packet in `docs/plans/` was the execution scope for the batch-gated productization run:

- `fable5-01-full-audit-revised.md`
- `fable5-02-fix-plan-revised.md`
- `fable5-03-optimization-plan-revised.md`
- `fable5-04-future-execution-revised.md`

This overlay does not itself mark PLAYABLE. It records the ordered batch plan used to move from the previous engineering/service closure toward a first-play candidate. Batch 00-11 engineering work is completed, but missing real LLM credentials, human playtest evidence, and screen recording evidence remain explicit blockers.

## Trusted baseline

| Item | Value |
|---|---|
| Current truth-source version | `0.5.0-product-experience-rebuild.0` |
| Trusted Baseline | Machine facts from `npm run facts:generate` |
| Current branch | Read from generated `output/project-facts.json` |
| Latest audited commit | Read from generated `output/project-facts.json` |
| Previous productization merge commit | `6a969fb5cf8975231224478f602d491c271c99b1` (historical baseline) |
| V2 entry closure audit status | `V2_ENTRY_CLOSURE_SEALED_PENDING_REMOTE_CI`; current remote CI evidence is verified through GitHub Actions check-runs, while legacy combined status may remain UNKNOWN/pending/0 |
| Full product-wide V2 | NOT COMPLETE |
| Product-wide playable closure | NOT COMPLETE |
| Global product closure | PRODUCT CLOSURE NOT COMPLETE |
| Selected V2 API/service loops | PASS for user-provided/structural paths |
| Full-function LLM prompt entry audit | PASS for local prompt contract coverage; selected DeepSeek live smoke recorded with exposed token usage |
| Productization Closure report | `docs/reports/productization-closure-report.md` reports PARTIAL by product decision |
| User-Created Content Product Closure | PASS |
| Blank template infrastructure | PASS |
| Built-in first-play example | `demo-world-cloud-steam-city` implemented as first-play smoke demo |
| `demo-character` / `demo-scriptkill` | DEFERRED_AFTER_FIRST_PLAY_CANDIDATE |
| Tutorial / onboarding content | first-play smoke path exists; broader onboarding remains incomplete |
| ENGINEERING_CLOSED | YES |
| FIRST_PLAYABLE_CANDIDATE | YES |
| PLAYABLE | NO |
| Real LLM Flow | DeepSeek selected smoke paths recorded; product-wide Real LLM closure remains incomplete |
| DeepSeek V4 Flash provider compatibility | VERIFIED for current closure sprint |
| Human playtest | HUMAN_VALIDATION_REQUIRED |
| Screen recording | HUMAN_VALIDATION_REQUIRED |
| Remote CI | GitHub Actions check-runs PASS when `npm run ci:github-actions-checks` records completed successful check-runs; legacy combined status may remain UNKNOWN/pending/0 |
| Productization merge CI | Use check-runs evidence, not legacy combined status alone; legacy status may still report UNKNOWN |
| Browser QA | 8/8 entry matrix PASS; 1440/1024/768/390 visual QA PASS; shared experience golden path and v0.5 interaction regression gate PASS; human/manual PLAYABLE sign-off NOT COMPLETE |
| Release package static assets | `ui-labels.js` is served by the local server and included in package verification |
| Truth-source priority | `PROJECT_TRUTH_SOURCE` > `CURRENT_PROJECT_STATE` > `V2_ENGINEERING_CLOSURE_STATUS` > `V2_ENTRY_COMPLETION_STATUS` > current-facing docs > archive |
| Asset/function inventory role | preservation ledger / evidence index; not proof by itself |
| fable5 batch run | batch 00-11 engineering run completed |

## Definitions

- **Engineering foundation complete**: core data contracts, runtime/library skeleton, safety boundaries, tests, and integration points exist.
- **Engineering/service closure complete**: service/API/persistence/import/export or equivalent runtime service slice exists and is tested.
- **Product closure not complete**: complete first-run UI/user flow, bundled content, browser QA, service persistence/API, or product-grade editing/review experience is not fully proven.
- **Full V2 not complete**: project-wide product-grade V2 is not complete.
- **V2 Entry Closure**: selected V2 entry engineering/service slices are sealed for audit purposes; product-wide playable closure remains NOT COMPLETE.

## Current status table

| Area | Engineering status | Product status | Current evidence |
|---|---|---|---|
| P0 Living World Kernel | COMPLETE | Kernel layer, not product closure | `test:p0` |
| P1 Experience Stability Kernel | COMPLETE | Kernel layer, not product closure | `test:p1` |
| P2 Long Play Kernel | COMPLETE | Kernel layer, not product closure | `test:p2` |
| Prompt Orchestration Layer v1 | COMPLETE | Prompt infrastructure | `test:prompts` |
| P3 M1-M11 Legacy Mechanism Kernel | COMPLETE | Module layer, not product entries | `test:legacy-mechanisms` |
| Workflow Integration W0-W4 | COMPLETE | Workflow layer | `test:workflows`, `workflow:check` |
| Tabletop V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED STRUCTURAL API/SERVICE LOOP PASS; PRODUCT ENTRY BROWSER MATRIX PASS | `test:tabletop-v2-full`, `test:v2-product-playable`, `smoke:product-entry-browser-matrix` |
| Detective V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED USER-PROVIDED CASE API/SERVICE LOOP PASS; PRODUCT ENTRY BROWSER MATRIX PASS | `test:detective-v2-full`, `test:v2-product-playable`, `smoke:product-entry-browser-matrix` |
| Character V2 Long-term | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:character-v2-long-term` |
| Single Player ScriptKill V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED USER-PROVIDED PACKAGE API/SERVICE LOOP PASS; PRODUCT ENTRY BROWSER MATRIX PASS | `test:single-player-scriptkill-v2`, `test:v2-product-playable`, `smoke:product-entry-browser-matrix` |
| Strategy Sim V2 | ENGINEERING FOUNDATION COMPLETE | USER-PROVIDED SPEC API LOOP PASS; PRODUCT ENTRY BROWSER MATRIX PASS | `test:strategy-sim-v2`, `test:strategy-sim-v2-product`, `smoke:product-entry-browser-matrix` |
| Worldbook V2 | ENGINEERING FOUNDATION COMPLETE | USER-PROVIDED/STRUCTURAL API LOOP PASS; BROWSER UI EDITOR PARTIAL | `test:worldbook-v2`, `test:worldbook-v2-product` |
| Quick Setting | USABLE THIN LOOP | PRODUCT CLOSURE PARTIAL | current project creation flow |
| Creation Forge | G1 ENGINEERING LOOP IMPLEMENTED | PRODUCT CLOSURE IN PROGRESS | `test:alchemy-closure`, `docs/reports/productization-reality-check.md` |

## What is current

- World Tree has exactly 8 canonical top-level product entries.
- Runtime/service aliases are not additional product entries.
- Existing canonical entries: quick-setting, character, world-rpg, tabletop, mystery-puzzle, strategy-sim, murder-mystery, creation-forge.
- Candidate/proposal/canon separation remains required.
- Hidden truth and private/system-only data must not enter player-visible outputs.
- Worldbook V2 engineering foundation is complete.
- Strategy Sim V2 engineering foundation is complete.
- Creation Forge / Alchemy G1 has an implemented engineering loop for plan, generate-preview, localize, deliver, and deliveries.
- Productization Closure is PARTIAL by product decision; User-Created Content Product Closure, blank template infrastructure, and `demo-world-cloud-steam-city` first-play smoke demo are recorded, while `demo-character`, `demo-scriptkill`, broader tutorial/onboarding content, product-wide manual smoke, and release readiness remain incomplete or deferred.
- fable5 batch 00-11 engineering run is completed. Current status is ENGINEERING_CLOSED: YES, FIRST_PLAYABLE_CANDIDATE: YES, PLAYABLE: NO.
- DeepSeek V4 Flash selected real smoke evidence is recorded for connection diagnostics, first-play, user-content Alchemy, selected key paths, and long-prefix cache hit behavior.
- DeepSeek V4 Flash provider compatibility fix is implemented for the standard OpenAI-compatible request paths, including disabled thinking support from the DeepSeek profile; this does not by itself make product-wide Real LLM closure PASS.
- Human playtest and screen recording remain HUMAN_VALIDATION_REQUIRED.
- fable5 smoke and PLAYABLE claims require real LLM evidence, human playtest evidence, and screen recording evidence; missing credentials or human validation must be labeled, not converted into PASS.
- Selected V2 API/service closure is improved for user-provided/structural content across Worldbook V2, Strategy Sim V2, Tabletop, Detective, and ScriptKill.
- Browser/UI entry flows for all 8 canonical entries have a dedicated automated browser matrix PASS, and the shared experience has a three-turn browser golden path with save/continue/export/abort evidence. `verify:release` now gates coverage, browser matrix, golden path, interaction regressions, visual QA, and safe snapshot generation.
- Full product-wide playable closure remains incomplete.
- Full-function LLM prompt entry audit covers local prompt contracts for all 8 product entries. DeepSeek live behavior is selected-path only; exposed first-play/user-content chat token usage is now recorded, while some Alchemy endpoint usage remains not exposed by endpoint.
- Full product-wide V2 is not complete.

## Entry-specific current facts

### Worldbook V2

Engineering foundation complete:

- schema
- candidate ledger
- canon store
- trigger engine
- context compiler
- visibility guard
- prompt adapter
- prompt-builder hook
- usage/activation log
- module adapters
- runtime injection helper

Product closure not complete:

- no complete product UI editor
- V2 API closure exists for load/save/candidates/inject-preview/export on user-provided or structural paths
- persisted V2 worldbook runtime service exists for the selected API loop
- no full review/growth-tree V2 unification
- no product-grade import/export compatibility
- no browser-proven first-run flow

### Strategy Sim V2

Engineering foundation complete:

- sealed spec
- run state
- seeded RNG and roll record
- numeric safety
- mixed turn pipeline
- public view scrubber
- report context
- V2 mode adapter path
- legacy fallback

Product closure not complete:

- no complete product UI
- start/turn/save/load/export API closure exists for user-provided sealed specs
- persisted V2 run service exists for the selected API loop
- no Creation Forge spec generation/confirmation/seal product flow
- no archetype library or quick-start templates
- no complete strategy gameplay

## Current limitations

- Tabletop is not full DND.
- Detective is not a full mystery reasoning engine.
- Strategy Sim is not a full 4X or complete strategy game.
- Worldbook V2 is not a complete product editor/runtime experience.
- Character V2 advanced editor is not complete.
- Single Player ScriptKill V2 does not include bundled product content unless separately documented.
- `server.js` remains the HTTP entry and dependency assembly point. Non-V2 dispatch now lives in `src/server/http-api-router.js`; configuration, connection diagnostics, static shell serving, and selected V2 route groups are bounded modules. Several legacy domain handlers remain in the entry for later service extraction.
- `world-tree-console.js` is now a small compatibility bootstrap; product registry, store, components, views, and controllers live under `browser/`. `world-tree-client-core.js` remains the stable utility/API client boundary.
- No TypeScript migration.
- Automated product-shell QA is recorded for the five global roots, eight canonical entries, four responsive widths, and the shared experience golden path. Human exploratory playtest and screen recording remain incomplete.
- The console shell requires `ui-labels.js`; the current closure sprint serves it as a public static asset and verifies it in the package.
- Current built-in first-play example: `demo-world-cloud-steam-city` / 云上蒸汽城.
- Later examples remain deferred after the first-play candidate: `demo-character` role-card content pack and `demo-scriptkill` scriptkill content pack.
- Streaming abort stops the browser request, labels the visible fragment `partial` / “已中止 · 未保存”, keeps it only in the current page, restores the original input on request, and is verified not to appear as a completed server turn. A durable server-side truncated-turn model is intentionally not claimed.

## Required checks

```bash
npm run truth:check
npm run docs:check
npm run asset:check
npm run test:worldbook-v2
npm run test:strategy-sim-v2
npm run test:world-tree-v2-entries
```
