# V2 Product Playable Closure Matrix

Date: 2026-06-30

| Entry | Scope | Route/UI used | Write path | Readback path | Smoke evidence | Hidden/private data boundary | Status | Known limitation |
|---|---|---|---|---|---|---|---|---|
| Worldbook V2 | User-provided or blank structural worldbook entries | `/api/worldbook-v2/load`, `/save`, `/candidates/create`, `/candidates/decision`, `/inject-preview`, `/export` | `engine/worlds/<world>/shared/worldbook.json`, `runtime/worldbook-v2/*.jsonl` | `/api/worldbook-v2/load`, `/export` | `audit/v2-product-playable-closure-1782786268226/evidence.json` | preview/export filter hiddenTruth/gm_only/system/private entries | PRODUCT LOOP PASS | Browser UI editor remains minimal/PARTIAL. |
| Strategy Sim V2 | User-provided StrategySimSpec runtime | `/api/strategy-sim-v2/spec/validate`, `/spec/seal`, `/start`, `/turn`, `/save`, `/load-run`, `/runs`, `/export-run` | `engine/runs/strategy-sim-v2/<runId>/` | `/load-run`, `/export-run` | `audit/v2-product-playable-closure-1782786268226/evidence.json` | product public view removes hidden/secret variables and raw RNG/roll internals | PRODUCT LOOP PASS | Not a full 4X or complete strategy game. |
| Tabletop | Minimal structural or imported tabletop module | existing `/api/tabletop-v2/*` routes | `engine/tabletop-v2/runs/<runId>/` | `/load-run`, `/export-run`, restore save | `audit/v2-product-playable-closure-1782786268226/evidence.json` | player-visible responses exclude GM book/hidden roll details | PRODUCT LOOP PASS | Not a full DND engine. |
| Detective | User-provided case/run loop | existing `/api/detective-v2/*` routes | `engine/detective-v2/cases/`, `engine/detective-v2/runs/` | investigate/interrogate/notebook/export routes | `audit/v2-product-playable-closure-1782786268226/evidence.json` | player pack/run excludes truthLedger, hiddenMeaning, deceptionReason, culprit truth; GM pack remains separate | PRODUCT LOOP PASS | Not a full mystery reasoning engine. |
| ScriptKill | User-provided scriptkill package/run loop | existing `/api/single-player-scriptkill-v2/*` routes | `engine/single-player-scriptkill-v2/packages/`, `runs/` | `/load-run`, `/export-run` | `audit/v2-product-playable-closure-1782786268226/evidence.json` | role view excludes DM manual/fullTruth/other-role private knowledge before debrief | PRODUCT LOOP PASS | Bundled scriptkill content remains deferred. |

## Closure Decision

Selected V2 product-playable loops are PASS for user-provided or structural-content paths. Productization Closure remains PARTIAL because bundled first-run content is DEFERRED and full product-wide manual/browser closure is not claimed.
