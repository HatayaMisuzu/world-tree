# Mode Boundary Map — World Tree Current Baseline

> This document describes current mode boundaries.  
> Mode capsules define contracts and readback boundaries. They do not automatically mean each mode has a complete gameplay engine.

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
| strategy-sim | minimal strategy resource/decision slice | shared data, `strategy.json` | resource/state proposals | medium/high | full Strategy V2 not complete |
| murder-mystery | murder mystery shell | shared data, `murder_mystery.json` | clue/case proposals | high: culprit/answer lock | mode-specific shared readback |
| creation-forge | producer tool, not a normal play entry | `creation_forge.json`, `forge_blueprints.json` | material drafts, blueprints, proposals | medium | deferred producer |

## Current Implemented Guarantee

After Stage 5H, mode-specific seed files are read into:

```text
moduleData.modeSpecific.files
moduleData.modeSpecific.sourceFiles
```

This is a readback/integration socket, not full mode gameplay.

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
