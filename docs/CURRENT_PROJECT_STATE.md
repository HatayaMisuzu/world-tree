# Current Project State

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Status: CURRENT TRUTH SOURCE  
Audience: AI agents, maintainers, reviewers.

Any AI agent taking over this repository must read this file and `docs/PROJECT_TRUTH_SOURCE.md` first.

## Active fable5 productization run

The current active execution scope is the fable5 revised four-file packet in `docs/plans/`:

- `fable5-01-full-audit-revised.md`
- `fable5-02-fix-plan-revised.md`
- `fable5-03-optimization-plan-revised.md`
- `fable5-04-future-execution-revised.md`

This overlay does not itself mark new capability as complete. It defines the ordered batch plan for moving from the existing engineering/service closure toward a real first-play product closure. Batches must run sequentially, and every batch must pass targeted tests, required integration coverage, and `npm run preflight` before its commit can be used as the next batch baseline.

## Trusted baseline

| Item | Value |
|---|---|
| Current truth-source version | `0.4.2-v2-engineering-foundation-truth.0` |
| Trusted Baseline | `v0.4.2-v2-engineering-foundation-truth.0` |
| Current branch | `main` |
| Latest audited commit | `ecd8658d088b41a4e4a0ec212bb7f274709707b9` |
| Latest productization merge commit | `ecd8658d088b41a4e4a0ec212bb7f274709707b9` |
| V2 entry closure audit status | `V2_ENTRY_CLOSURE_SEALED_PENDING_REMOTE_CI` |
| Full product-wide V2 | NOT COMPLETE |
| Product-wide playable closure | NOT COMPLETE |
| Global product closure | PRODUCT CLOSURE NOT COMPLETE |
| Selected V2 API/service loops | PASS for user-provided/structural paths |
| Full-function LLM prompt entry audit | PASS for local prompt contract coverage; live LLM behavior remains BLOCKED without credentials |
| Productization Closure report | `docs/reports/productization-closure-report.md` reports PARTIAL by product decision |
| User-Created Content Product Closure | PASS |
| Blank template infrastructure | PASS |
| Bundled story examples | DEFERRED BY PRODUCT DECISION |
| Tutorial / onboarding content | DEFERRED BY PRODUCT DECISION |
| Real LLM Flow | BLOCKED unless credentials/config are explicitly supplied |
| Remote CI | UNKNOWN unless a concrete workflow run is referenced |
| Productization merge CI | PASS for merge commit `ecd8658d` in run `28389779734` |
| Browser QA | User content browser smoke PASS; full product-wide browser QA NOT COMPLETE |
| Truth-source priority | `PROJECT_TRUTH_SOURCE` > `CURRENT_PROJECT_STATE` > `V2_ENGINEERING_CLOSURE_STATUS` > `V2_ENTRY_COMPLETION_STATUS` > current-facing docs > archive |
| Asset/function inventory role | preservation ledger / evidence index; not proof by itself |
| Active fable5 batch run | Batch 00 reality check in progress; batches 01-11 pending until gated commits exist |

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
| Tabletop V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED STRUCTURAL API/SERVICE LOOP PASS; BROWSER UI FLOW NOT PROVEN | `test:tabletop-v2-full`, `test:v2-product-playable` |
| Detective V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED USER-PROVIDED CASE API/SERVICE LOOP PASS; BROWSER UI FLOW NOT PROVEN | `test:detective-v2-full`, `test:v2-product-playable` |
| Character V2 Long-term | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:character-v2-long-term` |
| Single Player ScriptKill V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | SELECTED USER-PROVIDED PACKAGE API/SERVICE LOOP PASS; BROWSER UI FLOW NOT PROVEN | `test:single-player-scriptkill-v2`, `test:v2-product-playable` |
| Strategy Sim V2 | ENGINEERING FOUNDATION COMPLETE | USER-PROVIDED SPEC API LOOP PASS; BROWSER UI FLOW NOT PROVEN | `test:strategy-sim-v2`, `test:strategy-sim-v2-product` |
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
- Productization Closure is PARTIAL by product decision; User-Created Content Product Closure and blank template infrastructure are recorded as PASS, while bundled story examples, tutorials, onboarding demo content, product-wide manual smoke, and release readiness remain incomplete or deferred.
- Real LLM Flow is BLOCKED until real credentials/config are provided and a non-fallback smoke is recorded.
- fable5 smoke and PLAYABLE claims require real LLM evidence, human playtest evidence, and screen recording evidence; missing credentials or human validation must be labeled, not converted into PASS.
- Selected V2 API/service closure is improved for user-provided/structural content across Worldbook V2, Strategy Sim V2, Tabletop, Detective, and ScriptKill.
- Browser/UI entry flows for these five entries remain PARTIAL or NOT PROVEN unless a dedicated UI smoke is recorded.
- Full product-wide playable closure remains incomplete.
- Full-function LLM prompt entry audit covers local prompt contracts for all 8 product entries; live LLM behavior remains blocked without credentials/config.
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
- `server.js` remains the main HTTP entry and still owns non-V2 route dispatch, but selected V2 product route dispatch has been partially extracted through `src/server/v2-product-playable-routes.js`.
- `world-tree-console.js` remains the main browser UI script, but the browser utility/API client boundary has been extracted to `world-tree-client-core.js`.
- No TypeScript migration.
- Full product-wide browser QA remains incomplete unless a product entry browser smoke matrix is separately recorded.
- `defaults/examples/manifest.json` currently contains blank structural placeholders only. They are install/readback test material and future replacement slots, not bundled story examples or tutorials.

## Required checks

```bash
npm run truth:check
npm run docs:check
npm run asset:check
npm run test:worldbook-v2
npm run test:strategy-sim-v2
npm run test:world-tree-v2-entries
```
