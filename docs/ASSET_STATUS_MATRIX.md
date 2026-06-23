# Asset Status Matrix

> World Tree Maturation Stage 0 — auto-generated from asset-status-registry
> Human-readable summary. Machine validation: `npm run asset:check`

## Status Legend

| Status | Meaning |
|--------|---------|
| MATURE-ACTIVE | Fully integrated into workflow |
| KERNEL-COMPLETE | Core implementation done, tests pass |
| INTEGRATION-READY | Ready for workflow connection |
| NEEDS-MATURATION | Valuable but needs modernization |
| LEGACY-COMPAT | Old module, wrapped for compatibility |
| PROTOTYPE-HOLD | Prototype — must not expose to users |
| DECLARED-HOLD | Declared only — must not implement or expose |
| DEFERRED | Deferred for later |
| DO-NOT-EXPOSE | Never expose |

## Architecture Assets

| ID | Name | Maturation | Readiness | User Exposure |
|----|------|-----------|-----------|:---:|
| mode-system | Multi-entry Mode System | MATURE-ACTIVE | 6 | YES |
| module-manifest | Module Registration | MATURE-ACTIVE | 5 | YES |
| module-contract | Module Contract | MATURE-ACTIVE | 5 | YES |
| mode-module-map | Mode→Module Map | NEEDS-MATURATION | 4 | YES |
| module-composer | Profile Overlay Composer | MATURE-ACTIVE | 5 | YES |
| mode-runner | Unified Mode Runner | INTEGRATION-READY | 4 | YES |
| server-llm-chat | Server LLM Chat Flow | MATURE-ACTIVE | 6 | YES |
| prompt-orchestration | Prompt Orchestration Layer v1 | INTEGRATION-READY | 4 | YES |
| kernel-turn-context | Kernel Turn Context | KERNEL-COMPLETE | 3 | YES |
| proposal-bus | Proposal Bus | MATURE-ACTIVE | 5 | YES |
| path-security | Path Security | MATURE-ACTIVE | 5 | YES |

## P0-P2 Kernel Assets

| ID | Name | Status | Tests |
|----|------|--------|:---:|
| P0-living-world | P0 Living World Kernel | KERNEL-COMPLETE | 7/7 |
| P1-experience-stability | P1 Experience Stability Kernel | KERNEL-COMPLETE | 8/8 |
| P2-long-play | P2 Long Play Kernel | KERNEL-COMPLETE | 40/40 |

## Prompt Orchestration Assets

| ID | Name | Status | Tests |
|----|------|--------|:---:|
| prompt-orchestration | Prompt Orchestration v1 | INTEGRATION-READY | 42/42 |

## P3 M1-M11 Assets

| ID | Name | Status | Tests |
|----|------|--------|:---:|
| M1-creation-wizard | Creation Wizard v2 | KERNEL-COMPLETE | 8/8 |
| M2-alchemy-digest | Alchemy Digest | KERNEL-COMPLETE | ✓ |
| M3-material-warehouse | Material Warehouse | KERNEL-COMPLETE | ✓ |
| M4-character-kernel-v2 | Character Kernel v2 | KERNEL-COMPLETE | ✓ |
| M5-cognition-matrix | Cognition Matrix | KERNEL-COMPLETE | ✓ |
| M6-faction-graph | Faction Graph | KERNEL-COMPLETE | ✓ |
| M7-world-rules | World Rules Engine | KERNEL-COMPLETE | ✓ |
| M8-narrative-radar | Narrative Radar | KERNEL-COMPLETE | ✓ |
| M9-random-events | Random Event Pool | KERNEL-COMPLETE | ✓ |
| M10-macros | Macro System | KERNEL-COMPLETE | ✓ |
| M11-observability | Observability Terminal | KERNEL-COMPLETE | ✓ |

## Prototype-Hold (frozen — no user/workflow exposure)

- trpg.dice, trpg.check, trpg.character_sheet, trpg.clock
- rpg.quest, rpg.bond, rpg.chapter, rpg.growth
- mystery.case, mystery.phase, mystery.clue, mystery.testimony, mystery.truth_lock, mystery.scoring
- strategy.resource, strategy.calendar, strategy.decision, strategy.faction, strategy.diplomacy, strategy.turn, strategy.loyalty
- puzzle.scene

## Declared-Hold (registered only — no implementation)

- core.memory, core.review, core.canon, core.debug
- creation.questioning, creation.outline

## Preflight Coverage

| Command | Included |
|---------|:---:|
| test:p0 | ✓ |
| test:p1 | ✓ |
| test:p2 | ✓ |
| test:kernel | ✓ |
| test:prompts | ✓ |
| test:legacy-mechanisms | ✓ (new) |
| test:assets | ✓ (new) |
| asset:check | ✓ (new) |
| test:unit | ✓ |
| test:integration | ✓ |
| interface-audit | ✓ |
