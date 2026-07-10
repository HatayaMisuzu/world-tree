# World Tree Feature Status

Version: `0.5.0-product-experience-rebuild.0`
Status: CURRENT  
Audience: users, maintainers, AI agents.

This file describes current implemented capabilities and boundaries. It does not define future scope.

## Canonical product entries

World Tree has 8 canonical top-level product entries.

| Entry | Current user status | Current engineering status | Product boundary |
|---|---|---|---|
| quick-setting | usable thin loop | setting intake / project draft | no full auto-complete world generation guarantee |
| character | usable loop | Character V2 long-term engineering/service closure complete | full advanced editor not complete |
| world-rpg / Worldbook V2 | usable worldbook exploration loop | Worldbook V2 engineering foundation complete | product editor/runtime closure not complete |
| tabletop / Tabletop V2 | experimental playable slice | engineering/service closure complete | not full DND |
| mystery-puzzle / Detective V2 | experimental playable slice | engineering/service closure complete | not full reasoning engine |
| strategy-sim / Strategy Sim V2 | minimal strategy slice | engineering foundation complete | product closure not complete; not full 4X |
| murder-mystery / ScriptKill V2 | experimental playable slice | engineering/service closure complete | bundled content/product closure not complete |
| creation-forge | producer tool | alchemy/material/review workflow active | not a normal play entry |

## Engineering foundations completed after V2 Entry Closure

### Worldbook V2

Completed:

- WorldbookEntry schema
- Candidate ledger
- Canon store
- Trigger engine
- Context compiler
- Visibility guard
- Prompt adapter
- Prompt Builder hook
- Usage/activation log
- Module adapters
- Runtime injection helper

Not completed:

- complete product UI editor
- complete product UI editor/runtime closure
- full review/growth-tree V2 unification
- product-grade import/export
- browser-proven first-run flow

Selected product/API loop evidence:

- V2 load/save/candidates/inject-preview/export API paths exist for user-provided or structural Worldbook V2 content.
- A persisted V2 worldbook runtime service exists for the selected API loop.

### Strategy Sim V2

Completed:

- sealed StrategySimSpec
- StrategyRunState
- seeded RNG and roll record
- numeric safety
- mixed turn pipeline
- public view scrubber
- report context
- V2 mode adapter path
- legacy fallback

Not completed:

- complete product UI
- archetype library
- quick-start templates
- complete strategy gameplay

Selected product/API loop evidence:

- V2 validate/seal/start/turn/save/load/export API paths exist for user-provided sealed StrategySimSpec content.
- A persisted V2 run service exists for the selected API loop.
- Creation Forge spec generation/confirmation/seal remains a broader product flow, not a completed end-to-end UI closure.

## Shared project features

| Capability | Status | Boundary |
|---|---|---|
| Proposal/review gate | active | major canon changes require approval |
| Hidden truth protection | active | must not leak hiddenTruth/answerLock/truthLock/private/system_only |
| Prompt orchestration | active | infrastructure, not product closure by itself |
| Workflow layer | active | candidate-first; no direct canon writes unless approved |
| Import/export | active where implemented | not universal product-grade compatibility for every V2 foundation |
| Documentation truth source | active | current files override archive/historical reports |
| DeepSeek V4 Flash compatibility | verified for selected smoke paths | provider compatibility fix uses disabled thinking support; product-wide Real LLM closure still requires broader evidence |

## Development / verification

| Command | Purpose |
|---|---|
| `npm run truth:check` | current truth-source wording/version checks |
| `npm run docs:check` | documentation checks |
| `npm run asset:check` | asset inventory validation |
| `npm run test:worldbook-v2` | Worldbook V2 engineering foundation tests |
| `npm run test:strategy-sim-v2` | Strategy Sim V2 engineering foundation tests |
| `npm run test:world-tree-v2-entries` | V2 entry closure tests |
