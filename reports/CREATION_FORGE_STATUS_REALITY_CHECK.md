# Creation Forge Status Reality Check

Generated for `world-tree-fix-execution-package-v2.1`.

## Summary

`creation-forge` is not consistently labelled across every registry surface, but the project-creation gate still treats it as planned and refuses production creation by default. This report records the divergence only; no status field was changed.

## Observed State

| Source | Observed value |
| --- | --- |
| `src/core/modes/mode-manifest.js` | `MODE_STATUS.PLANNED`, `defaultVisibility: false`, note says the mode must not be opened in this round. |
| `src/core/system/world-tree-route-index.js` | route entry says `status: "active"` with role `producer`. |
| `src/core/modes/mode-capsule-registry.js` | capsule entry says `status: "deferred"`. |
| `src/core/creation-forge/creation-forge-mode-adapter.js` | adapter context and turn runner return `status: "ready"`. |
| `assertModeProjectCanBeCreated("creation-forge", {})` | `{ allowed: false, reason: "Mode creation-forge is planned and not enabled for project creation yet. Use createModeProjectDraft() for structural preview." }` |
| `assertModeProjectCanBeCreated("creation-forge", { allowPlannedModeDraft: true })` | `{ allowed: true, reason: "planned mode draft (not for production)" }` |

## Risk Note

The user-facing creation gate currently follows `mode-manifest.js`, so production project creation remains closed. The route/capsule/adapter labels are descriptive runtime metadata and should be reconciled in a dedicated creation-forge status pass before publicly enabling the mode.
