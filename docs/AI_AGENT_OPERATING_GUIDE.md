# AI Agent Detailed Operating Guide

> Version: `0.4.2-v2-engineering-foundation-truth.0`

## Mandatory Reading Order

1. `docs/PROJECT_TRUTH_SOURCE.md`
2. `docs/CURRENT_PROJECT_STATE.md`
3. `docs/V2_ENGINEERING_CLOSURE_STATUS.md`
4. `docs/V2_ENTRY_COMPLETION_STATUS.md`
5. `docs/STATUS_TERMINOLOGY.md`
6. `docs/PLAY_MODE_GUIDE.md`
7. `AI-GUIDE.md`
8. `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`

## Status Interpretation Rules

- State engineering status and product status separately.
- Asset inventory is an evidence index, not implementation proof.
- Archive and stage reports are historical unless promoted by current truth source.
- Engineering/service closure does not mean full gameplay/product closure.
- Engineering foundation complete does not mean product closure complete.

## Current Status Snapshot

| Area | Status |
|---|---|
| Full product-wide V2 | NOT COMPLETE |
| Product-wide playable closure | NOT COMPLETE |
| Tabletop V2 | Engineering/service closure complete; product/gameplay closure partial |
| Detective V2 | Engineering/service closure complete; product/gameplay closure partial |
| Character V2 long-term | Engineering/service closure complete; product closure partial |
| Single Player ScriptKill V2 | Engineering/service closure complete; product closure partial |
| Strategy Sim V2 | Engineering foundation complete; product closure not complete |
| Worldbook V2 | Engineering foundation complete; product closure not complete |
| Creation Forge | Producer tool; not a normal play entry |

## Modification Protocol

1. Locate real files, not from memory.
2. Make minimal necessary changes.
3. Add or update tests.
4. Run target tests.
5. Run `npm run truth:check`, `npm run docs:check`.
6. Report new files, modified files, test results, risks, and omissions.

## Documentation Protocol

When adding/modifying features, synchronize:

- `PROJECT_TRUTH_SOURCE.md` if global status changes
- `CURRENT_PROJECT_STATE.md` if current status changes
- `V2_ENGINEERING_CLOSURE_STATUS.md` if V2 engineering/product status changes
- `V2_ENTRY_COMPLETION_STATUS.md` if entry status changes
- `DOCUMENTATION_STATUS.md` / `CURRENT_DOCUMENTATION_INVENTORY.md` if docs lifecycle changes

## Required Checks

```bash
npm run truth:check           # Truth-source consistency
npm run docs:check            # Documentation completeness
npm run asset:check           # Asset inventory validation
npm run test:worldbook-v2     # Worldbook V2
npm run test:strategy-sim-v2  # Strategy Sim V2
```

Run target tests for the area being modified before committing.
