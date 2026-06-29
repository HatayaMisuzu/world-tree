# API Product Contract

Status: Productization Closure contract draft

This document describes product-facing route contracts at the closure boundary. `server.js` remains the current dispatcher; this document is not a router rewrite.

## Global Rules

- Local-only access remains required for all routes.
- Routes that write disk must be explicit about write targets.
- AI/LLM output may recommend, infer, and draft, but final writes require user-selected targets and/or confirmation where the route performs delivery or canon changes.
- Player-visible responses must not leak API keys, tokens, secrets, local filesystem paths, hidden truth, `gm_only`, `system_only`, or script/style/html/js payloads.
- Legacy compatibility routes remain valid until replacement routes, UI migration, readback tests, and manual smoke evidence exist.

## Product Route Groups

| Entry | Route group | Writes disk? | Confirmation required? | Current coverage |
|---|---|---:|---:|---|
| Quick Setting | `/api/modules/*` | yes | creation/finalization routes are explicit user actions | `test:integration`, module lifecycle and quick-setting roundtrip tests |
| Creation Forge / Alchemy | `/api/alchemy/*` | yes for delivery/commit paths | yes for G1 delivery; selected targets required | `test:alchemy-closure` |
| Worldbook | `/api/worldbook`, `/api/worldbook/test` | yes for save/update route | user action via UI/API | `test:worldbook-v2`, integration worldbook roundtrip |
| Character | `/api/characters/*`, `/api/characters/v2/*` | yes for import/update/candidate decisions/export | confirmation/candidate decision required for V2 canon sidecars | `test:character-v2-long-term`, `test:integration` |
| Strategy Sim | mode/workflow routes, Strategy Sim V2 services | yes through project/runtime paths | candidate/proposal boundaries apply | `test:strategy-sim-v2`, `test:integration` |
| Tabletop | `/api/tabletop-v2/*` | yes for start/save/import/branch/run operations | import/start/save are explicit user actions | `test:tabletop-v2-full` |
| Detective / Mystery | `/api/detective-v2/*` | yes for import/start/notebook/run operations | import/generation commit routes are explicit user actions | `test:detective-v2-full` |
| Single Player ScriptKill | `/api/single-player-scriptkill-v2/*` | yes for import/start/run state operations | import/start/action routes are explicit user actions | `test:single-player-scriptkill-v2` |

## Closure Gate Notes

- Product contract presence is not product closure by itself.
- Browser/manual smoke must prove first-run loading and at least one real user path for major entries.
- CI must include product closure gates before final closure can be claimed.
- `docs/API_ROUTE_INVENTORY.md` remains the source-grounded route table.

## Error Contract Baseline

Routes should prefer structured JSON errors:

```json
{
  "status": "error",
  "code": "MACHINE_READABLE_CODE",
  "errorMsg": "Human-readable message"
}
```

Existing routes that use legacy shapes should be documented before migration rather than changed blindly.
