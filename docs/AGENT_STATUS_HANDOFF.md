# Agent Status Handoff

Version: `0.4.2-v2-engineering-foundation-truth.0`  
Audience: AI agents only.

## Mandatory read order

1. `docs/PROJECT_TRUTH_SOURCE.md`
2. `docs/CURRENT_PROJECT_STATE.md`
3. `docs/V2_ENGINEERING_CLOSURE_STATUS.md`
4. `docs/V2_ENTRY_COMPLETION_STATUS.md`
5. `docs/PLAY_MODE_GUIDE.md`
6. `AI-GUIDE.md`

## Current objective status

Do not infer from old docs or archive reports.

| Claim | Current truth |
|---|---|
| Full V2 complete | False |
| Product-wide playable closure complete | False |
| V2 entry closure for Tabletop/Detective/Character/ScriptKill | Engineering/service closure complete |
| Strategy Sim V2 | Engineering foundation complete; product closure not complete |
| Worldbook V2 | Engineering foundation complete; product closure not complete |
| Creation Forge | Producer tool, not normal play entry |
| Asset inventory | Preservation ledger / evidence index, not implementation proof by itself |

## Safe wording

Use:

```text
Worldbook V2 engineering foundation is complete; product closure is not complete.
Strategy Sim V2 engineering foundation is complete; product closure is not complete.
```

Avoid:

```text
\"WV2 done\" — unqualified, no engineering/product split
\"SV2 done\" — unqualified, no engineering/product split
\"Full V2 done\" — unqualified
\"WV2 unfinished\" — unqualified, no engineering/product split
\"SV2 unfinished\" — unqualified, no engineering/product split
```

When in doubt, state engineering status and product status separately.

## Required validation before status edits

```bash
npm run truth:check
npm run docs:check
```

For V2 foundation edits:

```bash
npm run test:worldbook-v2
npm run test:strategy-sim-v2
```
