# Mode Boundary Map — World Tree Pre-V2 Closure Baseline

> This document describes current mode boundaries and Pre-V2 expectations.  
> It must not describe full V2 gameplay engines as already implemented.

## Global Mode Rule

Mode capsules define contracts and mode-specific readback sockets.

They do not automatically mean each mode has a complete gameplay engine.

## Shared Rules

All modes must respect:

```text
shared truth/canon is not directly rewritten by AI
major state/relationship/timeline/resource changes go through proposals or approved operations
hidden truth / answer lock / truth lock must not leak
assets must not be deleted, detached, downgraded, or orphaned without approval
```

## Mode Table

| Mode | Current Role | Reads | Writes / Produces | Hidden / Canon Risk | V2 Socket |
|---|---|---|---|---|---|
| quick-setting | quick intake / setting bootstrap | user setting text, shared basics | candidate setting/module material | low | normalizer / raw intake |
| character | character-centric play | character card, runtime chat/state | turn state, memory, proposals | medium | character capsule socket |
| world-rpg | world RPG play shell | shared world data, `world_rpg.json`, `world_threads.json` | runtime turn state, proposals | medium | mode-specific shared readback |
| tabletop | tabletop-style play shell | shared world data, `tabletop.json` | runtime turn state, candidates/proposals | medium | mode-specific shared readback |
| mystery-puzzle | mystery/puzzle shell | shared data, `mystery.json` | clues/candidates/proposals | high: hidden truth | mode-specific shared readback |
| strategy-sim | strategy simulation shell | shared data, `strategy.json` | resource/state proposals | medium/high | strategy numeric/probability substrate |
| murder-mystery | murder mystery shell | shared data, `murder_mystery.json` | clue/case proposals | high: culprit/answer lock | mode-specific shared readback |
| creation-forge | deferred creation/material producer; not a normal persisted module | forge intake, blueprints and candidate artifacts | material drafts, blueprints, proposals | medium | alchemy/workflow producer socket |

## Current Implemented Guarantee

After Stage 5H, mode-specific seed files are read into:

```text
moduleData.modeSpecific.files
moduleData.modeSpecific.sourceFiles
```

This is a readback/integration socket, not full mode gameplay.

`creation-forge` is the exception to normal mode persistence: it remains `PLANNED`, is not visible as a regular play mode, and `/api/modules/create` returns `MODE_PROJECT_CREATION_DISABLED`. Forge/alchemy workflows may still produce candidate blueprints for an explicitly confirmed downstream target.

## Per-Mode Future Documentation

Future work may split this into:

```text
docs/modes/quick-setting.md
docs/modes/character.md
docs/modes/world-rpg.md
docs/modes/tabletop.md
docs/modes/mystery-puzzle.md
docs/modes/strategy-sim.md
docs/modes/murder-mystery.md
docs/modes/creation-forge.md
```

Do not create these as current implementation documents unless each is checked against code.
