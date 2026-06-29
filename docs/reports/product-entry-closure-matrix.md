# Product Entry Closure Matrix

Date: 2026-06-29

Status: PARTIAL. This matrix records current product-entry evidence without adding first-run example content.

## Constraint

First-run example content is intentionally deferred. `defaults/examples/manifest.json` remains empty under the current requirement, so Productization Closure cannot be claimed as complete.

## Matrix

| Entry | User story | Route/UI used | Write path | Readback path | Test evidence | Manual smoke status | Known limitations |
|---|---|---|---|---|---|---|---|
| Quick Setting | Paste a short idea, create a project draft, start chat, and export later. | `/api/modules/create`, `/api/modules/load`, `/api/chat/message`, world-pack routes | `engine/worlds/<world>/`, `shared/`, `runtime/` | `/api/modules`, `/api/modules/load`, `.worldtree` roundtrip | `npm run test:integration` includes quick project, quick-setting roundtrip, and first-turn persistence paths | NOT RUN in browser for this closure pass | Product UX closure still needs browser proof and first-run guided content. |
| Creation Forge / Alchemy | Enter idea or setting, get a plan, select targets, preview, localize, confirm delivery, and open the created world. | G1 UI in `world-tree-console.js`; `/api/alchemy/plan`, `/api/alchemy/generate-preview`, `/api/alchemy/localize`, `/api/alchemy/deliver`, `/api/alchemy/deliveries` | selected local world/shared/runtime files, delivery log, snapshots | delivery log, created module folder, module load path | `npm run test:alchemy-closure` 26/26; `docs/reports/alchemy-g1-evidence.md` | NOT RUN in browser; checklist exists at `docs/manual-smoke/alchemy-g1-smoke.md` | Browser flow and first real turn from a delivered world still need manual evidence. |
| Worldbook | Load entries, edit/save entry, test trigger, and export/import. | `/api/worldbook`, `/api/worldbook/test`, world-pack routes | worldbook/shared files under the selected world | `/api/worldbook`, trigger test, `.worldtree` roundtrip | `npm run test:worldbook-v2`; integration worldbook V1 chain and roundtrip | NOT RUN in browser for this closure pass | Current truth source still marks Worldbook V2 product editor/API closure incomplete. |
| Character | Create/import a character, preview, confirm save, and start chat. | `/api/characters/*`, `/api/characters/v2/*`, character UI | character files and V2 sidecars/candidates | character load/list/export, runtime chat/state | `test:character-v2-long-term` via `test:world-tree-v2-entries`; integration character roundtrip | NOT RUN in browser for this closure pass | Advanced product editor is incomplete; avatar remains UI-only by design. |
| Strategy Sim | Generate or load a strategy spec, validate/seal, start sim, make one decision, and keep public view scrubbed. | current mode/workflow routes plus Strategy Sim V2 services | project runtime/proposal paths | strategy state/tests, first-turn mock chat persistence | `npm run test:strategy-sim-v2`; integration strategy project/turn/roundtrip | NOT RUN in browser for this closure pass | Product API/UI closure is not complete; current evidence is foundation plus thin runtime paths. |
| Tabletop | Import/preview module, start session, roll/check action, save/read run state. | `/api/tabletop-v2/*`, tabletop entry paths | tabletop run/runtime/save/branch paths | load-run, restore-save, export-run, project roundtrip | `test:tabletop-v2-full` via `test:world-tree-v2-entries`; integration tabletop project/turn/roundtrip | NOT RUN in browser for this closure pass | Not a full DND engine; product smoke still needs import/start/turn/save proof. |
| Detective / Mystery | Create/import a case, show public premise, track clues, submit deduction, protect truth lock. | `/api/detective-v2/*`, mystery entry paths | detective case/run/notebook paths | investigate/interrogate/notebook/deduction/export routes | `test:detective-v2-full` via `test:world-tree-v2-entries`; integration mystery project/turn/roundtrip | NOT RUN in browser for this closure pass | Not a full mystery reasoning engine; browser proof of clue/deduction flow still missing. |
| Single Player ScriptKill | Import/preview package, confirm import, choose role, start run, perform public/private/search/vote/debrief path. | `/api/single-player-scriptkill-v2/*`, murder-mystery identity | scriptkill package/run state paths | runs/load-run/export/debrief routes | `npm run test:single-player-scriptkill-v2`; audit script in preflight | NOT RUN in browser for this closure pass | Bundled product content is deferred; product smoke still missing. |

## Closure Decision

Current entry closure status is PARTIAL:

- Automated coverage exists across major entry foundations and service slices.
- Creation Forge / Alchemy G1 automated closure is strong.
- Browser/manual smoke evidence is still missing for all major product entries in this closure pass.
- First-run example content is intentionally not added under the current requirement.
