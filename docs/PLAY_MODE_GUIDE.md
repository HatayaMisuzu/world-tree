# Play Mode Guide — World Tree Pre-V2 Closure Baseline

> This guide describes each mode's current state in the v0.4.0 Pre-V2 Closure baseline.  
> Statuses reflect what is implemented and testable, not future V2 plans.

## Mode Summary

| Mode | Status | API Route | Entry |
|---|---|---|---|
| quick-setting | ACTIVE-PARTIAL | Kernel projects | Paste raw setting text |
| character | ACTIVE-PARTIAL | `/api/characters` | Character card panel |
| world-rpg | ACTIVE-PARTIAL | `/api/projects/{id}` | Kernel + worldbook |
| tabletop | V2-READY-SOCKET | `/api/modules/create` | Module factory |
| mystery-puzzle | V2-READY-SOCKET | Kernel project | Hidden truth protected |
| strategy-sim | V2-READY-SOCKET | Kernel project | Numeric/probability substrate |
| murder-mystery | V2-READY-SOCKET | Kernel project | Hidden truth protected |
| creation-forge | DEFERRED-PRODUCER | `/api/alchemy/*`, workflow producer APIs | Candidate/blueprint producer only |

## quick-setting (ACTIVE-PARTIAL)

- **Entry:** Console quick-setting panel or `/api/projects` kernel routes.
- **Suitable for:** Rapid world concept testing.
- **Limits:** Thin slice; does not auto-generate full world state.
- **V2-ready:** Normalizer in `src/core/quick-setting/`.

## character (ACTIVE-PARTIAL)

- **Entry:** Character card panel or `/api/characters`.
- **Suitable for:** Loading and chatting with pre-made character cards.
- **Limits:** Import/export limited; no auto-generation.
- **V2-ready:** `src/core/character/`.

## world-rpg (ACTIVE-PARTIAL)

- **Entry:** Kernel project with mode `world-rpg`.
- **Suitable for:** Free-form world exploration with worldbook.
- **Limits:** Worldbook editing is basic.
- **V2-ready:** `src/core/worldbook/`, `modeSpecificFile: world_rpg.json`.

## tabletop (V2-READY-SOCKET)

- **Entry:** Module factory via `/api/modules/create`.
- **Suitable for:** Future tabletop-style campaign management.
- **Limits:** Socket only — not a playable tabletop game.
- **V2-ready:** `src/core/tabletop/`.

## mystery-puzzle (V2-READY-SOCKET)

- **Entry:** Kernel project with mode `mystery-puzzle`.
- **Suitable for:** Mystery scenario with hidden truth protection.
- **Limits:** Minimal scenario; hidden truth visibility gated.
- **V2-ready:** `src/core/mystery-puzzle/`, hidden truth boundary enforced.

## strategy-sim (V2-READY-SOCKET)

- **Entry:** Kernel project with mode `strategy-sim`.
- **Suitable for:** Strategy simulation prototyping.
- **Limits:** Numeric/probability substrate only; no full game.
- **V2-ready:** `src/core/strategy-sim/`.

## murder-mystery (V2-READY-SOCKET)

- **Entry:** Kernel project with mode `murder-mystery`.
- **Suitable for:** Murder mystery scenario with hidden truth.
- **Limits:** Hidden truth protected but scenario minimal.
- **V2-ready:** `src/core/murder-mystery/`.

## creation-forge (DEFERRED-PRODUCER)

- **Entry:** Alchemy routes `/api/alchemy/*`.
- **Suitable for:** Material ingestion, preview, review.
- **Limits:** Deferred producer; not a normal persisted module and not a full creation engine. `/api/modules/create` rejects `mode: "creation-forge"`.
- **V2-ready:** `src/core/creation-forge/`.

## Hidden Truth / Answer Lock Protection

Modes `mystery-puzzle` and `murder-mystery` enforce hidden truth visibility boundaries. The proposal/canon gate ensures hidden data is not exposed in candidate proposals without explicit approval. V2-ready visibility/lifecycle validators enforce these boundaries at runtime.
