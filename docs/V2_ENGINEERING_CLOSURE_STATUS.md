# V2 Engineering Closure Status

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Truth-source role: current-facing status matrix for V2 engineering foundations and service closures.  
Audience: AI agents, maintainers, reviewers.

## Summary

World Tree currently has a mix of product entries, V2 service closures, V2 engineering foundations, and thin slices.

This document is descriptive. It does not prescribe future work.

## Global status

| Scope | Status |
|---|---|
| Full product-wide V2 | NOT COMPLETE |
| Product-wide playable closure | NOT COMPLETE |
| Remote CI | UNKNOWN unless a concrete workflow run is referenced |
| Browser QA | UNKNOWN unless separately recorded |
| Canonical top-level product entries | 8 |
| Runtime/service aliases | Not additional top-level product entries |

## Entry status matrix

| Entry / Area | Engineering status | Product status | Current implemented capabilities | Not completed / not claimed |
|---|---|---|---|---|
| quick-setting | Usable thin loop | Product closure partial | setting intake, project draft path, raw text preservation | full world auto-completion, complete first-run content path |
| character / Character V2 long-term | ENGINEERING/SERVICE CLOSURE COMPLETE | Product closure partial | text-first capsule, runtime context bridge, confirmed memory/canon/relationship read-only consumption, candidate review, export services | full advanced editor, full product-grade character authoring UX |
| world-rpg / Worldbook V2 | ENGINEERING FOUNDATION COMPLETE | Product closure not complete | WorldbookEntry schema, Candidate Ledger, Canon Store, Trigger Engine, Context Compiler, Visibility Guard, Prompt Adapter, Prompt Builder hook, Usage/Activation Log, module adapters, `test:worldbook-v2` | full UI editor, server V2 API, persisted V2 worldbook runtime service, review/growth-tree full V2 unification, product-grade import/export |
| tabletop / Tabletop V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | Product closure partial | import preview/commit, GM loop, save/branch/restore/export, hidden GM isolation, runtime namespace, full test gate | full DND/ruleset engine, commercial tabletop UX |
| mystery-puzzle / Detective V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | Product closure partial | case import/generator/validator, evidence/testimony/contradiction/timeline/truth ledger, player notebook, deduction report, GM/player export separation | full mystery reasoning engine, complete detective product UX |
| strategy-sim / Strategy Sim V2 | ENGINEERING FOUNDATION COMPLETE | Product closure not complete | sealed `StrategySimSpec`, `StrategyRunState`, seeded RNG + roll record, numeric safety, mixed turn pipeline, public view scrubber, report context, V2 mode adapter path, `test:strategy-sim-v2` | Strategy Sim V2 service API, product UI, persisted run flow, Creation Forge spec generation/confirmation/sealing path, complete strategy gameplay |
| murder-mystery / Single Player ScriptKill V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | Product closure partial | user-owned script import with legal-use gate, solo player + AI stranger proxies, phase/knowledge/spoiler guards, import→start→phase→talk→search→reveal→vote→debrief→export→load service e2e | bundled script content, complete party-game product UX |
| creation-forge | Producer workflow active | Not a normal play entry | creation/alchemy/material/review workflow, candidate-only production, review/adoption routes | ordinary play loop, direct canon writes without approval |

## Definitions by current completed foundation

### Worldbook V2 engineering foundation complete

Completed means:

- V2 entry/candidate schema exists.
- Candidate ledger exists and is separate from canon.
- Canon store accepts confirmed/approved content only.
- Trigger engine supports keyword, regex, optional filters, scan depth, probability, inclusion groups, mode/character/generation filters.
- Context compiler outputs WorldbookContextPack with slots, budgets, omissions, visibility warnings, activation log, token usage.
- Visibility guard separates player/writer/character/director/gm/system audiences.
- Prompt adapter converts WorldbookContextPack into worldbook prompt blocks.
- Prompt Builder consumes `worldbookContext` and logs worldbook block activation.
- Usage log records context pack usage.
- Module adapters map existing alchemy/material/character/cognition/faction/rules/event outputs into Worldbook V2 entries/candidates.
- Tests are registered under `npm run test:worldbook-v2`.

Not completed:

- product UI editor
- server V2 API
- persistent V2 worldbook runtime storage
- complete review-facts/growth-tree unification
- full product import/export compatibility
- browser-proven first-run Worldbook V2 user flow

### Strategy Sim V2 engineering foundation complete

Completed means:

- sealed `StrategySimSpec` exists.
- `StrategyRunState` exists.
- run state checks spec hash.
- seeded RNG and probability roll records exist.
- numeric guard/clamp/maxDelta safety exists.
- strict mixed turn pipeline exists.
- public view scrubber exists.
- report context builder exists.
- mode adapter can run sealed V2 spec and falls back when no sealed spec exists.
- tests are registered under `npm run test:strategy-sim-v2`.

Not completed:

- product UI for Strategy Sim V2
- server start/turn/save/export API
- persistent V2 run service
- Creation Forge generation/confirmation/seal product flow
- archetype library / quick-start templates
- complete strategy game system

## Agent instruction

When describing current status, state both sides:

```text
Engineering foundation status: complete / partial / not present.
Product closure status: complete / partial / not complete.
```

Never infer product closure from engineering tests alone.
