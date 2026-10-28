# Documentation Status

Version: `0.5.0-product-experience-rebuild.0`
Status: CURRENT DOCUMENT LIFECYCLE INDEX

## Current Truth Sources

| File | Role | Audience | Current? |
|---|---|---|---|
| PROJECT_TRUTH_SOURCE.md | Truth-source index | agents/maintainers | yes |
| CURRENT_PROJECT_STATE.md | Current project state | agents/maintainers/users | yes |
| V2_ENGINEERING_CLOSURE_STATUS.md | V2 engineering/product closure status | agents/maintainers | yes |
| V2_ENTRY_COMPLETION_STATUS.md | Entry-specific closure status | agents/maintainers | yes |
| STATUS_TERMINOLOGY.md | Required status vocabulary | agents/maintainers | yes |
| AGENT_STATUS_HANDOFF.md | Agent handoff summary | agents | yes |

## Current User Docs

| File | Role |
|---|---|
| README.md | Chinese user entry + light status summary |
| README.en.md | English user entry + secondary summary |
| PLAY_MODE_GUIDE.md | Current mode status and limitations |
| FEATURES.md | Feature list |
| USER_QUICKSTART.md | Quickstart guide |

## Current Agent Docs

| File | Role |
|---|---|
| AI-GUIDE.md | Root-level agent operating guide |
| AI_AGENT_OPERATING_GUIDE.md | Detailed agent operating guide |
| MAINTENANCE_ENTRY.md | Maintenance/cleanup entry point |
| DOCUMENT_RETENTION_POLICY.md | Document retention/archive/deletion rules |

## Current Reference Docs

| File | Role |
|---|---|
| ARCHITECTURE_MAP.md | Current architecture map |
| API_ROUTE_INVENTORY.md | API route inventory |
| MODE_BOUNDARY_MAP.md | Mode boundary map |
| WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md | Asset preservation ledger |
| ASSET_STATUS_MATRIX.md | Asset maturation status |
| SCRIPTS_AND_CHECKS.md | Scripts and checks reference |

## Current Status/Reports

| File | Role |
|---|---|
| CURRENT_DOCUMENTATION_INVENTORY.md | Current documentation inventory |
| DOCUMENTATION_STATUS.md | This file |
| STRATEGY_SIM_V2_REALITY_CHECK.md | Strategy Sim V2 reality check |
| WORLDBOOK_V2_REALITY_CHECK.md | Worldbook V2 reality check |

## Historical / Superseded Docs

See `docs/archive/` for historical stage reports.
`DOCS_INVENTORY.md` is superseded by `CURRENT_DOCUMENTATION_INVENTORY.md`.

## Test Result Policy

Do not hardcode test pass counts here. Current test results belong in execution reports or Reality Check files. `package.json` is the source of truth for scripts.

## Legacy status

Legacy classification vocabulary used by `docs/LEGACY_REDUNDANCY_AUDIT.md` and `npm run legacy:check`. Full inventories live in the audit; this section only defines the status enum.

| Status | Meaning |
|---|---|
| `active-compatibility` | Still referenced; kept as a compatibility layer while a newer path exists |
| `legacy-bridge` | Old API/path retained so newer systems can call through a bridge |
| `archived-design` | Historical design or execution record; not current truth |
| `orphan-candidate` | Unreferenced candidate; keep until a human decides archive or reuse |

Do not treat `orphan-candidate` as permission to delete. Prefer the audit and upgrade plan over inventing new inventories here.
