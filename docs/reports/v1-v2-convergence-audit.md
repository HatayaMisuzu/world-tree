# V1 / V2 Convergence Audit

Date: 2026-06-29

## Scope

This is the Phase M1 convergence audit for Productization Closure. It is an inventory and deprecation-readiness report, not a removal plan. No legacy route is approved for deletion by this document alone.

## Summary

World Tree currently runs a mixed architecture:

- V1-style routes and UI flows still provide user-facing product access for modules, characters, worldbook, chat, import/export, and legacy alchemy review.
- V2 route groups exist for Tabletop, Detective, Character, and Single Player ScriptKill service/runtime slices.
- Strategy Sim V2 and Worldbook V2 have engineering foundations and tests, but the current truth source still marks their product closure incomplete.
- Creation Forge / Alchemy G1 is the active unified creation-entry engineering loop, while older alchemy preview/review routes remain compatibility surfaces.

Conclusion: convergence should proceed by documentation, labels, compatibility warnings, and tests before any removal. Blind deletion would risk breaking active product entry paths.

## Current Route Inventory

| Area | Current user-facing routes | V2 / G1 routes | Current status | Removal stance |
|---|---|---|---|---|
| Modules / Quick Setting | `/api/modules`, `/api/modules/create`, `/api/modules/load`, `/api/modules/finalize-draft`, `/api/modules/delete`, `/api/modules/{id}/history` | none | User-facing base project loop | Keep |
| Creation Forge / Alchemy | legacy `/api/alchemy/import`, `/api/alchemy/preview`, `/api/alchemy/refine`, `/api/alchemy/commit`, `/api/alchemy/digest`, `/api/alchemy/review` | G1 `/api/alchemy/capabilities`, `/api/alchemy/plan`, `/api/alchemy/generate-preview`, `/api/alchemy/localize`, `/api/alchemy/deliver`, `/api/alchemy/deliveries` | G1 engineering loop implemented; legacy preview/review remains visible compatibility path | Keep; label legacy as advanced/compat before any future removal |
| Character | `/api/characters`, `/api/characters/import`, `/api/characters/update`, `/api/characters/load`, `/api/characters/delete`, `/api/characters/backup` | `/api/characters/v2/turn`, `/api/characters/v2/candidates/*`, `/api/characters/v2/export` | V2 service/runtime slice exists, legacy character CRUD still user-facing | Keep both |
| Worldbook | `/api/worldbook`, `/api/worldbook/test` | no complete product V2 API group yet | Engineering foundation complete, product API/UI closure incomplete | Keep legacy route; do not claim V2 product closure |
| Strategy Sim | legacy mode/module runtime paths | no complete product V2 API group yet | Engineering foundation complete, product API/UI closure incomplete | Keep existing mode path; add product API only with tests |
| Tabletop | legacy mode/module runtime paths | `/api/tabletop-v2/import-preview`, `/api/tabletop-v2/start`, `/api/tabletop-v2/turn`, `/api/tabletop-v2/save`, `/api/tabletop-v2/branch`, `/api/tabletop-v2/end-summary`, `/api/tabletop-v2/import-commit`, `/api/tabletop-v2/runs`, `/api/tabletop-v2/load-run`, `/api/tabletop-v2/restore-save`, `/api/tabletop-v2/switch-branch`, `/api/tabletop-v2/export-run` | V2 service closure routes exist | Keep; product UI/manual smoke still needed for closure claim |
| Detective / Mystery | legacy mode/module runtime paths | `/api/detective-v2/import-preview`, `/api/detective-v2/import-commit`, `/api/detective-v2/start`, `/api/detective-v2/investigate`, `/api/detective-v2/interrogate`, `/api/detective-v2/notebook/*`, `/api/detective-v2/deduction/submit`, `/api/detective-v2/generate-*`, `/api/detective-v2/quality-check`, `/api/detective-v2/review-case-quality`, `/api/detective-v2/export-*` | V2 service closure routes exist | Keep; product UI/manual smoke still needed for closure claim |
| Single Player ScriptKill | legacy murder-mystery feature identity | `/api/single-player-scriptkill-v2/import-preview`, `/api/single-player-scriptkill-v2/import-commit`, `/api/single-player-scriptkill-v2/start`, `/api/single-player-scriptkill-v2/read-role-act`, `/api/single-player-scriptkill-v2/public-talk`, `/api/single-player-scriptkill-v2/private-chat`, `/api/single-player-scriptkill-v2/search`, `/api/single-player-scriptkill-v2/reveal-clue`, `/api/single-player-scriptkill-v2/advance-phase`, `/api/single-player-scriptkill-v2/vote`, `/api/single-player-scriptkill-v2/debrief`, `/api/single-player-scriptkill-v2/export-run`, `/api/single-player-scriptkill-v2/runs`, `/api/single-player-scriptkill-v2/load-run` | V2 service closure routes exist; bundled content closure incomplete | Keep |

## UI Entry Points

Current canonical product identity remains eight top-level entries:

| Entry | Current convergence note |
|---|---|
| Quick Setting | Still depends on the base module/project creation loop. It should not be replaced by Creation Forge until direct open/play evidence exists. |
| Creation Forge / Alchemy | G1 is the unified creation entry for plan -> preview -> localize -> confirmed delivery. Legacy preview/review remains available for compatibility. |
| Worldbook | Existing UI route is still the product surface; V2 foundation is not yet a complete product editor/runtime flow. |
| Character | V1 CRUD/import remains necessary; V2 runtime/candidate routes add service depth. |
| Strategy Sim | Engineering foundation exists, but product API/UI closure is not complete. |
| Tabletop | V2 routes are service-ready; product smoke must still prove import/start/turn/save/readback. |
| Detective / Mystery | V2 routes are service-ready; product smoke must still prove public premise, clue tracking, deduction, and truth lock. |
| Single Player ScriptKill | V2 routes are service-ready; bundled content and product smoke remain closure blockers. |

## Test Coverage Inventory

| Area | Current test evidence |
|---|---|
| Creation Forge / Alchemy G1 | `npm run test:alchemy-closure` |
| Worldbook V2 foundation | `npm run test:worldbook-v2` |
| Strategy Sim V2 foundation | `npm run test:strategy-sim-v2` |
| Tabletop V2 service closure | `npm run test:tabletop-v2-full` |
| Detective V2 service closure | `npm run test:detective-v2-full` |
| Character V2 long-term/service | `npm run test:character-v2-long-term` |
| Single Player ScriptKill V2 service | `npm run test:single-player-scriptkill-v2`, `npm run test:single-player-scriptkill-v2-audit` |
| Cross-entry audit | `npm run test:entry-closures`, `npm run test:final-v2-closures`, `npm run test:world-tree-v2-entries` |

## Compatibility-Only Candidates

These may become future deprecation candidates only after replacement routes, UI migration, readback tests, and manual smoke are recorded:

- Legacy alchemy preview/review routes if G1 fully supersedes import/refine/commit workflows.
- Legacy mode-specific fallbacks for Tabletop, Detective, Character, and ScriptKill after V2 UI entry flows are browser-proven.
- Any duplicated internal aliases that are no longer reachable from canonical product entries.

## Safe Later Deprecation Requirements

Before removing or hiding any route:

1. Confirm whether the route is still called from `world-tree-console.js`.
2. Confirm whether the route is documented in `docs/API_ROUTE_INVENTORY.md`.
3. Add or update tests that prove the replacement path.
4. Preserve import/export and readback behavior.
5. Record the deprecation in current truth-source docs.
6. Run `npm run test:unit` and `npm run test:integration`.

## M1 Decision

No code deletion is approved in Phase M1. Current action is documentation-only convergence:

- Keep legacy user-facing paths.
- Keep V2 route groups where already implemented.
- Treat Worldbook V2 and Strategy Sim V2 as engineering foundations until product closure is separately proven.
- Treat Creation Forge / Alchemy G1 as implemented engineering loop, not full product-wide closure.
