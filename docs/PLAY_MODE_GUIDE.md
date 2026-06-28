# Play Mode Guide — World Tree Current Baseline

> This guide describes each mode's current state in the `v0.4.1-v2-entry-closure.0` baseline.
> Statuses reflect what is implemented and testable, not future V2 plans.
> "Playable" here means the current repository exposes a user-facing path or thin slice. It does not mean the mode is a complete commercial game system.

## Mode Summary

| Mode | Current User Status | Current Engineering Status | Current Limit |
|---|---|---|---|
| quick-setting | Usable thin loop | quick setting intake / project draft exists | Does not auto-complete full world state |
| character | Usable character loop | Character V2 long-term engineering slice exists | Full Character Capsule V2 is not complete |
| world-rpg | Usable worldbook exploration loop | worldbook runtime matching/injection exists | Full Worldbook V2 is not complete |
| tabletop | Experimental playable slice | Tabletop V2 service closure complete | Not full DND / ruleset engine |
| mystery-puzzle | Experimental playable slice | Detective V2 service closure exists as related service entry | Not full mystery reasoning engine |
| strategy-sim | Minimal strategy slice | Runtime resource/decision panel exists | Strategy V2 is not complete; not full 4X |
| murder-mystery | Experimental playable slice | Single Player ScriptKill V2 service closure complete | Requires user-provided or future bundled script package |
| creation-forge | Producer tool | alchemy/material/review workflow exists | Not a normal play entry |

## quick-setting (Usable thin loop)

- **Entry:** Console quick-setting panel or `/api/projects` kernel routes.
- **Suitable for:** Rapid world concept testing.
- **Limits:** Thin slice; does not auto-generate full world state.

## character (Usable / V2 engineering slice)

- **Entry:** Character card panel or `/api/characters`.
- **Suitable for:** Creating and chatting with characters; Character V2 long-term candidate mechanisms available.
- **Limits:** Full Character Capsule V2 is not complete.

## world-rpg (Usable / Worldbook V2 incomplete)

- **Entry:** Kernel project with mode `world-rpg`.
- **Suitable for:** Free-form world exploration with worldbook.
- **Limits:** Full Worldbook V2 is not complete; exact future scope is not defined in this document.

## tabletop (Experimental / Tabletop V2 service closure)

- **Entry:** Module factory via `/api/modules/create`.
- **Suitable for:** Solo tabletop-style narrative with dice, clocks, scenes.
- **Limits:** Not a full DND or ruleset engine; current implementation is a service-level closure with playable thin slice.

## mystery-puzzle (Experimental / Detective V2 service closure)

- **Entry:** Kernel project with mode `mystery-puzzle`.
- **Suitable for:** Mystery scenario with clues, hypotheses, and hidden truth protection.
- **Limits:** Not a full mystery reasoning engine; current implementation is a service-level closure with playable slice.

## strategy-sim (Minimal slice / Strategy V2 incomplete)

- **Entry:** Kernel project with mode `strategy-sim`.
- **Suitable for:** Resource/decision prototyping with numeric/probability substrate.
- **Limits:** Strategy V2 is not complete; current implementation is a minimal strategy resource/decision slice, not full 4X. Exact future scope is not defined in this document.

## murder-mystery (Experimental / ScriptKill V2 service closure)

- **Entry:** Kernel project with mode `murder-mystery`.
- **Suitable for:** Solo script-kill with suspects, clues, and truth lock.
- **Limits:** Requires user-provided or future bundled script package; Single Player ScriptKill V2 service closure complete but product-facing bundled content is outside this scope unless separately documented.

## creation-forge (Producer tool)

- **Entry:** Alchemy routes `/api/alchemy/*`.
- **Suitable for:** Material ingestion, preview, review, and blueprint creation.
- **Limits:** Producer tool, not a normal play entry; candidate-only workflow.

## Hidden Truth / Answer Lock Protection

Modes `mystery-puzzle` and `murder-mystery` enforce hidden truth visibility boundaries. The proposal/canon gate ensures hidden data is not exposed in candidate proposals without explicit approval. V2-ready visibility/lifecycle validators enforce these boundaries at runtime.
