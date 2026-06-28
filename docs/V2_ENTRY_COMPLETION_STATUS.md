# World Tree V2 Entry / Engineering Closure Status

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Status: CURRENT  
Audience: AI agents, maintainers, reviewers.

This document records current engineering/service closure and engineering foundation status. It does not claim Full V2 or product-wide playable closure.

## Summary

| Entry / Area | Current engineering status | Current product status | Test / evidence gate |
|---|---|---|---|
| Tabletop V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `npm run test:tabletop-v2-full` |
| Detective V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `npm run test:detective-v2-full` |
| Character V2 Long-term | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `npm run test:character-v2-long-term` |
| Single Player ScriptKill V2 | ENGINEERING/SERVICE CLOSURE COMPLETE | PRODUCT CLOSURE PARTIAL | `npm run test:single-player-scriptkill-v2` + audit |
| Strategy Sim V2 | ENGINEERING FOUNDATION COMPLETE | PRODUCT CLOSURE NOT COMPLETE | `npm run test:strategy-sim-v2` |
| Worldbook V2 | ENGINEERING FOUNDATION COMPLETE | PRODUCT CLOSURE NOT COMPLETE | `npm run test:worldbook-v2` |
| quick-setting | USABLE THIN LOOP | PRODUCT CLOSURE PARTIAL | project creation smoke/workflow |
| creation-forge | PRODUCER WORKFLOW ACTIVE | NOT NORMAL PLAY ENTRY | alchemy/material/review workflow |

## Boundaries

- V2 service closures and engineering foundations are not new top-level product entries.
- World Tree still has 8 canonical top-level product entries.
- Full product-wide V2 is not complete.
- Product-wide playable closure is not complete.
- Engineering tests do not prove product UI/browser closure.
- Module-layer assets are not product entries.

## Entry details

### Tabletop V2

Engineering/service closure complete:

- import preview / commit
- GM loop
- save / branch / restore / export
- hidden GM state isolation
- runtime namespace
- full test gate

Not claimed:

- full DND
- complete commercial tabletop UX
- universal ruleset engine

### Detective V2

Engineering/service closure complete:

- case import / generator / validator
- evidence / testimony / contradiction / timeline / truth ledger
- player notebook
- deduction report
- GM/player export separation

Not claimed:

- complete mystery reasoning engine
- complete detective product UX

### Character V2 Long-term

Engineering/service closure complete:

- text-first capsule creation
- runtime context bridge
- long-term confirmed memory / canon / relationship read-only consumption
- candidate review
- export services
- normal UI hides raw audit detail

Not claimed:

- full advanced editor
- complete product-grade authoring UX

### Single Player ScriptKill V2

Engineering/service closure complete:

- user-owned script import with legal-use gate
- solo player + AI stranger player proxies
- role-name-first chat display
- phase / knowledge / spoiler guard separation
- import → start → phase → talk → search → reveal → vote → debrief → export → load service e2e

Not claimed:

- bundled script content
- complete party-game product UX

### Strategy Sim V2

Engineering foundation complete:

- sealed `StrategySimSpec`
- `StrategyRunState`
- spec hash match
- seeded RNG + counter
- probability roll record
- numeric clamp / maxDelta / range guard
- mixed turn pipeline
- public view scrubber
- report context builder
- V2 mode adapter path
- legacy fallback without sealed spec

Not claimed:

- complete Strategy Sim product entry
- start/turn/save/export server API
- persistent V2 run service
- Creation Forge spec generation/confirmation/sealing product flow
- archetype library
- quick-start templates
- complete strategy/4X gameplay

### Worldbook V2

Engineering foundation complete:

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
- runtime injection helper

Not claimed:

- complete Worldbook V2 product editor
- server V2 API closure
- persisted V2 worldbook runtime service
- complete review-facts/growth-tree V2 unification
- product-grade ST/NovelAI import/export compatibility
- browser-proven first-run user flow

## Must-run gates

```bash
npm run truth:check
npm run test:worldbook-v2
npm run test:strategy-sim-v2
npm run test:world-tree-v2-entries
npm run docs:check
npm run asset:check
```
