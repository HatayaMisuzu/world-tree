# World Tree Project Truth Source

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Status: CURRENT  
Audience: AI agents, maintainers, reviewers.

This is the current truth-source index for repository status. Read this before using historical reports.

## Truth-source priority

1. `docs/PROJECT_TRUTH_SOURCE.md`
2. `docs/CURRENT_PROJECT_STATE.md`
3. `docs/V2_ENGINEERING_CLOSURE_STATUS.md`
4. `docs/V2_ENTRY_COMPLETION_STATUS.md`
5. `docs/PLAY_MODE_GUIDE.md`
6. `README.md`, `AI-GUIDE.md`, `docs/INDEX.md`
7. Active architecture documents
8. Historical reports and archive files

Historical reports may describe past limitations or past completion claims. They are not current truth if they conflict with the files above.

## Current version baseline

| Item | Value |
|---|---|
| Current truth-source version | `0.4.2-v2-engineering-foundation-truth.0` |
| Branch | `main` |
| Latest productization merge commit | `ecd8658d088b41a4e4a0ec212bb7f274709707b9` |
| User-Created Content Product Closure | PASS |
| Blank Template Infrastructure | PASS |
| Productization Closure | PARTIAL by product decision |
| Bundled Story Examples | DEFERRED BY PRODUCT DECISION |
| Tutorial / Onboarding | DEFERRED BY PRODUCT DECISION |
| v1.0.0 | NOT READY |
| Full product-wide V2 | NOT COMPLETE |
| Product-wide playable closure | NOT COMPLETE |
| Selected V2 product-playable loops | PASS for user-provided/structural paths |
| Full-function LLM prompt entry audit | PASS for local prompt contract coverage; live LLM behavior remains BLOCKED without credentials |
| Current documentation status | post-merge user-created content product closure alignment |
| Remote CI | PASS for merge commit `ecd8658d` in run `28389779734` |
| Browser QA | User content browser smoke PASS; full product-wide browser QA NOT COMPLETE |

## Current status summary

| Area | Current status |
|---|---|
| Tabletop V2 | selected structural product loop PASS; full gameplay closure partial |
| Detective V2 | selected user-provided case product loop PASS; full reasoning-engine closure partial |
| Character V2 long-term | engineering/service closure complete; advanced product editor not complete |
| Single Player ScriptKill V2 | selected user-provided package product loop PASS; bundled content deferred |
| Strategy Sim V2 | user-provided StrategySimSpec product loop PASS; complete strategy gameplay not complete |
| Worldbook V2 | user-provided/structural Worldbook V2 product loop PASS; full editor UX not complete |
| Quick Setting | usable thin loop |
| Creation Forge / Alchemy G1 | user-created content product closure PASS for Flow A/B; full productization remains PARTIAL |

## Required boundary statements

- Full product-wide V2 is not complete.
- Product-wide playable closure is not complete.
- User-Created Content Product Closure is PASS for the recorded Flow A/Flow B paths.
- Real LLM Flow is BLOCKED unless credentials/config are explicitly supplied and recorded.
- Productization Closure remains PARTIAL by product decision.
- Selected V2 product-playable loops are PASS only for the recorded user-provided/structural API paths.
- Full-function LLM prompt entry audit is PASS for local contract coverage, not a live LLM behavior PASS.
- v1.0.0 is NOT READY.
- Bundled story examples, tutorial content, and onboarding demos are DEFERRED BY PRODUCT DECISION.
- Engineering foundation complete does not imply product closure complete.
- Engineering/service closure complete does not imply full gameplay engine complete.
- Historical archive documents must not override current truth-source files.
- Asset/function inventory is a preservation ledger and evidence index; it is not by itself proof that a capability is implemented.

## Current completed engineering foundations

### Strategy Sim V2

Current completed engineering foundation includes:

- sealed `StrategySimSpec`
- `StrategyRunState`
- seeded RNG + counter
- probability roll record
- numeric clamp/maxDelta/range guard
- mixed turn pipeline
- public view scrubber
- report context
- mode adapter V2 path
- legacy fallback when no sealed spec exists
- registered test script `test:strategy-sim-v2`

Current remaining product closure limitations include:

- product UI
- archetype/quick-start templates
- Creation Forge spec generation/confirmation/sealing user flow
- complete strategy gameplay

### Worldbook V2

Current completed engineering foundation includes:

- WorldbookEntry schema
- WorldbookCandidate ledger
- Canon WorldbookStore
- Trigger Engine
- Context Compiler
- Visibility Guard
- Prompt Adapter
- Prompt Builder hook
- Usage/Activation Log
- Module Adapters
- `prepareWorldbookV2Injection`
- registered test script `test:worldbook-v2`

Current remaining product closure limitations include:

- full product UI editor
- complete review-facts/growth-tree unification
- broader product-grade import/export UX
- browser-proven first-run user flow

## Must-run truth checks

```bash
npm run truth:check
npm run docs:check
npm run asset:check
```

For V2 foundations:

```bash
npm run test:worldbook-v2
npm run test:strategy-sim-v2
npm run test:world-tree-v2-entries
```
