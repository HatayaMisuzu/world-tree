# Play Mode Guide — Current Baseline

Version: `0.5.0-product-experience-rebuild.0`
Status: CURRENT  
Audience: users, maintainers, AI agents.

This guide describes current mode status. "Playable" means the repository exposes a user-facing path or thin slice. It does not mean a complete commercial game system.

## Mode summary

| Mode | Current user status | Current engineering status | Current product limit |
|---|---|---|---|
| quick-setting | Usable thin loop | setting intake / project draft exists | does not auto-complete full world state |
| character | Usable character loop | Character V2 long-term engineering/service closure complete | full advanced editor/product authoring UX not complete |
| world-rpg | Usable worldbook exploration loop | Worldbook V2 engineering foundation complete | Worldbook V2 product editor/runtime closure not complete |
| tabletop | Experimental playable slice | Tabletop V2 engineering/service closure complete | not full DND / ruleset engine |
| mystery-puzzle | Experimental playable slice | Detective V2 engineering/service closure complete | not full mystery reasoning engine |
| strategy-sim | Minimal strategy slice | Strategy Sim V2 engineering foundation complete | Strategy Sim V2 product closure not complete; not full 4X |
| murder-mystery | Experimental playable slice | Single Player ScriptKill V2 engineering/service closure complete | bundled script content/product closure not complete |
| creation-forge | Producer tool | alchemy/material/review workflow active | not a normal play entry |

## quick-setting

- Entry: console quick-setting panel or project routes.
- Suitable for: rapid world concept testing.
- Limit: thin slice; no full world auto-completion guarantee.

## character

- Entry: character card panel or character routes.
- Suitable for: creating and chatting with characters.
- Engineering status: Character V2 long-term service closure complete.
- Limit: full advanced editor/product authoring UX not complete.

## world-rpg / Worldbook V2

- Entry: world-rpg project mode.
- Suitable for: free-form world exploration with worldbook context.
- Engineering status: Worldbook V2 engineering foundation complete.
- Completed engineering foundation includes schema, candidate ledger, canon store, trigger engine, context compiler, visibility guard, prompt adapter, prompt-builder hook, usage log, module adapters, and runtime injection helper.
- Product limit: full Worldbook V2 UI editor, V2 server API, persisted V2 worldbook service, full review/growth-tree unification, and first-run browser flow are not complete.

## tabletop / Tabletop V2

- Entry: tabletop mode.
- Suitable for: solo tabletop-style narrative with dice, clocks, scenes.
- Engineering status: Tabletop V2 engineering/service closure complete.
- Limit: not full DND or a universal ruleset engine.

## mystery-puzzle / Detective V2

- Entry: mystery-puzzle mode.
- Suitable for: scenarios with clues, hypotheses, evidence, and hidden truth protection.
- Engineering status: Detective V2 engineering/service closure complete.
- Limit: not a full mystery reasoning engine.

## strategy-sim / Strategy Sim V2

- Entry: strategy-sim mode.
- Suitable for: resource/decision prototyping and future sealed-spec strategy runs.
- Engineering status: Strategy Sim V2 engineering foundation complete.
- Completed engineering foundation includes sealed StrategySimSpec, StrategyRunState, seeded RNG + roll record, numeric safety, mixed turn pipeline, public view scrubber, report context, V2 mode adapter path, and fallback behavior.
- Product limit: full Strategy Sim V2 UI/API/persistent run service, Creation Forge spec generation/confirmation/sealing flow, archetypes, quick-start templates, and complete strategy gameplay are not complete.

## murder-mystery / Single Player ScriptKill V2

- Entry: murder-mystery mode.
- Suitable for: solo script-kill style play with hidden knowledge boundaries.
- Engineering status: Single Player ScriptKill V2 engineering/service closure complete.
- Limit: bundled script content and complete product UX are not complete unless separately documented.

## creation-forge

- Entry: alchemy / creation routes.
- Suitable for: material ingestion, preview, review, candidate generation, blueprint creation.
- Status: producer workflow active.
- Limit: not a normal play entry; candidate-only workflow unless approval/adoption writes canon.

## Hidden truth / answer lock protection

Modes that use hidden truths must keep hiddenTruth, answerLock, truthLock, gm_only, private, and system_only data out of player-visible output unless a specific reveal/approval flow permits it.
