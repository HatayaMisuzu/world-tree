# V2 Product Playable Closure Matrix

Date: 2026-06-30

| Entry | Scope | Route/API used | Write path | Readback path | Smoke evidence | Hidden/private data boundary | API loop status | Browser/UI loop status | Known limitation |
|---|---|---|---|---|---|---|---|---|---|
| Worldbook V2 | User-provided or blank structural worldbook entries | `/api/worldbook-v2/load`, `/save`, `/candidates/create`, `/candidates/decision`, `/inject-preview`, `/export` | `engine/worlds/<world>/shared/worldbook.json`, `runtime/worldbook-v2/*.jsonl` | `/api/worldbook-v2/load`, `/export` | `audit/v2-product-playable-closure-1782787449943/evidence.json` | preview/export filter hiddenTruth/gm_only/system/private entries | API LOOP PASS | PARTIAL / NOT PROVEN as full editor flow | Browser UI editor remains minimal/PARTIAL. |
| Strategy Sim V2 | User-provided StrategySimSpec runtime | `/api/strategy-sim-v2/spec/validate`, `/spec/seal`, `/start`, `/turn`, `/save`, `/load-run`, `/runs`, `/export-run` | `engine/runs/strategy-sim-v2/<runId>/` | `/load-run`, `/export-run` | `audit/v2-product-playable-closure-1782787449943/evidence.json` | product public view removes hidden/secret variables and raw RNG/roll internals | API LOOP PASS | NOT PROVEN | Not a full 4X or complete strategy game. |
| Tabletop | Minimal structural or imported tabletop module | existing `/api/tabletop-v2/*` routes | `engine/tabletop-v2/runs/<runId>/` | `/load-run`, `/export-run`, restore save | `audit/v2-product-playable-closure-1782787449943/evidence.json` | player-visible responses exclude GM book/hidden roll details | SERVICE/API LOOP PASS | NOT PROVEN | Not a full DND engine. |
| Detective | User-provided case/run loop | existing `/api/detective-v2/*` routes | `engine/detective-v2/cases/`, `engine/detective-v2/runs/` | investigate/interrogate/notebook/deduction/export routes | `audit/v2-product-playable-closure-1782787449943/evidence.json` | player pack/run excludes truthLedger, hiddenMeaning, deceptionReason, culprit truth; GM pack remains separate | SERVICE/API LOOP PASS | NOT PROVEN | Not a full mystery reasoning engine. |
| ScriptKill | User-provided scriptkill package/run loop | existing `/api/single-player-scriptkill-v2/*` routes | `engine/single-player-scriptkill-v2/packages/`, `runs/` | `/load-run`, `/export-run` | `audit/v2-product-playable-closure-1782787449943/evidence.json` | role view excludes DM manual/fullTruth/other-role private knowledge before debrief | SERVICE/API LOOP PASS | NOT PROVEN | Bundled scriptkill content remains deferred. |

## Closure Decision

Selected V2 API/service loops are PASS for user-provided or structural-content paths. Browser/UI entry loops are PARTIAL or NOT PROVEN. Productization Closure remains PARTIAL because bundled first-run content is DEFERRED and full product-wide manual/browser closure is not claimed.
