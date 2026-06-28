# World Tree Feature Status

Version: `0.4.2-v2-engineering-foundation-truth.0`  
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
- V2 server API
- persistent V2 worldbook runtime service
- full review/growth-tree V2 unification
- product-grade import/export
- browser-proven first-run flow

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
- V2 start/turn/save/export API
- persistent run service
- Creation Forge spec generation/confirmation/seal product flow
- archetype library
- quick-start templates
- complete strategy gameplay

## Shared project features

| Capability | Status | Boundary |
|---|---|---|
| Proposal/review gate | active | major canon changes require approval |
| Hidden truth protection | active | must not leak hiddenTruth/answerLock/truthLock/private/system_only |
| Prompt orchestration | active | infrastructure, not product closure by itself |
| Workflow layer | active | candidate-first; no direct canon writes unless approved |
| Import/export | active where implemented | not universal product-grade compatibility for every V2 foundation |
| Documentation truth source | active | current files override archive/historical reports |

## Development / verification

| Command | Purpose |
|---|---|
| `npm run truth:check` | current truth-source wording/version checks |
| `npm run docs:check` | documentation checks |
| `npm run asset:check` | asset inventory validation |
| `npm run test:worldbook-v2` | Worldbook V2 engineering foundation tests |
| `npm run test:strategy-sim-v2` | Strategy Sim V2 engineering foundation tests |
| `npm run test:world-tree-v2-entries` | V2 entry closure tests |
