# World Tree Maintenance Entry

> This is the mandatory entry point for any AI or human maintenance work.
> Read this before cleanup, refactor, deletion, migration, architecture simplification, or V2-preparation work.

## 1. Mandatory Reading Order

1. `docs/PROJECT_TRUTH_SOURCE.md`
2. `docs/CURRENT_PROJECT_STATE.md`
3. `docs/V2_ENGINEERING_CLOSURE_STATUS.md`
4. `docs/V2_ENTRY_COMPLETION_STATUS.md`
5. `AI-GUIDE.md`
6. `docs/AI_AGENT_OPERATING_GUIDE.md`
7. `docs/MAINTENANCE_ENTRY.md` (this file)
8. `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`
9. `docs/ASSET_STATUS_MATRIX.md`
10. `docs/LEGACY_REDUNDANCY_AUDIT.md`
11. `docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md`
12. `docs/TECH_DEBT_INVENTORY.md`

Pre-V2 Closure gates are historical unless referenced by current truth-source files.
9. `docs/TECH_DEBT_INVENTORY.md`

## 2. Absolute Rule

Do not treat cleanup as deletion.

World Tree contains active systems, partial systems, V2-ready sockets, legacy candidates, preserved mechanisms, and historical design assets. A file may look old while still preserving a mechanism, a future integration path, or product advantage.

## 3. Asset Preservation & Integration

Assets must not be silently:
- deleted
- detached
- disconnected
- downgraded
- orphaned
- hidden in archive without a reactivation path
- removed from index/entry/test/runtime flow without replacement proof

Before any asset-impacting change, answer:

| Question | Required |
|---|---|
| What asset is affected? | yes |
| Where is it recorded? | yes |
| What is its current role? | yes |
| What is its current entry point? | yes |
| Will it remain reachable? | yes |
| Will it remain indexed? | yes |
| Will it remain tested or explicitly marked untested? | yes |
| What is the replacement or reactivation path? | yes |
| Is owner approval required? | yes |
| Was owner approval received? | yes/no |

## 4. Asset Categories

- `ACTIVE`: currently connected to product/runtime flow.
- `ACTIVE-PARTIAL`: partially connected; keep entry point and limitations.
- `V2-READY-SOCKET`: not full feature yet, but has a socket for future V2 integration.
- `PRESERVATION-REFERENCE`: not directly active, but design semantics and reactivation path must remain indexed.
- `LEGACY-CANDIDATE`: old mechanism candidate; cannot be deleted or detached without replacement proof and owner approval.
- `ARCHIVED-HISTORICAL`: historical record; may be archived but must stay indexed as history.
- `DEPRECATION-CANDIDATE`: suspected removable; requires dedicated review and owner approval.

## 5. Required Checks Before Deletion / Archive / Refactor

- reference search
- asset inventory check
- asset status check
- legacy audit check
- replacement path
- rollback plan
- target tests
- `npm run asset:check`

## 6. Default Decision

If unsure, do not delete.
If unsure, do not detach.
If unsure, preserve and document.
