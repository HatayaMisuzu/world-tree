# Current Project State

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Status: CURRENT TRUTH SOURCE  
Audience: AI agents, maintainers, reviewers.

Any AI agent taking over this repository must read this file and `docs/PROJECT_TRUTH_SOURCE.md` first.

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

## Definitions

- **Engineering foundation complete**: core data contracts, runtime/library skeleton, safety boundaries, tests, and integration points exist.
- **Engineering/service closure complete**: service/API/persistence/import/export or equivalent runtime service slice exists and is tested.
- **Product closure not complete**: complete first-run UI/user flow, bundled content, browser QA, service persistence/API, or product-grade editing/review experience is not fully proven.
- **Full V2 not complete**: project-wide product-grade V2 is not complete.
- **V2 Entry Closure**: selected V2 entry engineering/service slices are sealed for audit purposes, but this does not mean product-wide playable closure is complete.

## Current status table

| Area | Engineering status | Product status | Current evidence |
|---|---|---|---|
| P0 Living World Kernel | COMPLETE | Kernel layer, not product closure | `test:p0` |
| P1 Experience Stability Kernel | COMPLETE | Kernel layer, not product closure | `test:p1` |
| P2 Long Play Kernel | COMPLETE | Kernel layer, not product closure | `test:p2` |
| Prompt Orchestration Layer v1 | COMPLETE | Prompt infrastructure | `test:prompts` |
| P3 M1-M11 Legacy Mechanism Kernel | COMPLETE | Module layer, not product entries | `test:legacy-mechanisms` |
| Workflow Integration W0-W4 | COMPLETE | Workflow layer | `test:workflows`, `workflow:check` |
| Tabletop V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:tabletop-v2-full` |
| Detective V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:detective-v2-full` |
| Character V2 Long-term | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:character-v2-long-term` |
| Single Player ScriptKill V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `test:single-player-scriptkill-v2`, audit |
| Strategy Sim V2 | ENGINEERING FOUNDATION COMPLETE | PRODUCT CLOSURE NOT COMPLETE | `test:strategy-sim-v2` |
| Worldbook V2 | ENGINEERING FOUNDATION COMPLETE | PRODUCT CLOSURE NOT COMPLETE | `test:worldbook-v2` |
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
- Product closure remains incomplete for Worldbook V2 and Strategy Sim V2.
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
- no V2 server API closure
- no full persisted V2 worldbook runtime service
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
- no start/turn/save/export API closure
- no persisted V2 run service
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
- `server.js` remains monolithic.
- `world-tree-console.js` remains monolithic.
- No TypeScript migration.
- No automated browser QA unless separately recorded.
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
