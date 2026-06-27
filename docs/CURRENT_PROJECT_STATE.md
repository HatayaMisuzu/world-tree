# Current Project State

> 当前真相源。任何 AI agent 接手时必须先读本文件。
> 本文件在 `docs/` 和 `AI-GUIDE` 中被引用为优先阅读入口。

## Trusted Baseline

| Item | Value |
|------|-------|
| **Current trusted baseline** | `v0.4.1-v2-entry-closure.0` |
| **Current branch** | `main` |
| **Latest audited commit** | `44b53c8` plus validated UX_ALIAS_REPAIR_P1 patch in current HEAD |
| **Remote CI** | `UNKNOWN` |
| **Status** | **V2_ENTRY_CLOSURE_SEALED_PENDING_REMOTE_CI** |
| **Current patch overlay** | LLM_ROUTING_ALIGNMENT_COMPLETE + UX_ENTRY_COHERENCE_COMPLETE + FEATURE_ALIAS_REGISTRY_COMPLETE |
| **Old tag** `v0.4.0-pre-v2-closure` | Audit-invalidated historical marker at `0ee1852` |
| **Full V2** | Full product-wide V2 not complete; four V2 entry closures complete |
| **Browser QA** | Not run for this UX alias patch; covered by command audits, not visual browser proof |
| **Preflight** | PASS (includes V2 entry gates + project-complete-audit) |
| **userData isolation** | PASS (real userData unchanged before/after full suite) |

## Status Table

| Layer | Status | Evidence |
|-------|:---:|------|
| P0 Living World Kernel | COMPLETE | `npm run test:p0` 7/7 |
| P1 Experience Stability Kernel | COMPLETE | `npm run test:p1` 8/8 |
| P2 Long Play Kernel | COMPLETE | `npm run test:p2` 40/40 |
| Prompt Orchestration Layer v1 | COMPLETE | 22 prompt blocks, 8 canonical mode profiles, 9 task contracts, `npm run test:prompts` |
| LLM_ROUTING_ALIGNMENT | COMPLETE-P0 | Prompt task contracts and safe routing gates covered by `npm run test:llm-routing` |
| FEATURE_ALIAS_REGISTRY | COMPLETE-P1 | Exactly 8 canonical product features; ScriptKill, Detective V2, Tabletop V2 are aliases/runtime slices |
| UX_ENTRY_COHERENCE | COMPLETE-P1 | `npm run ux:check` covers Tabletop V2 preview, state sync, health wording, progress profiles, aliases |
| P3 M1-M11 Legacy Mechanism Kernel | COMPLETE | 11 mechanisms, test:legacy-mechanisms 22/22 |
| Asset Maturation Stage 0-4 | COMPLETE | test:assets, test:authority, test:legacy-modernization, test:workflow-readiness |
| Real Workflow Integration W0-W4 | COMPLETE | test:workflows, workflow:check 0 errors |
| Service Deepening Core | COMPLETE | character/mystery/strategy use real M4-M8, play-turn has LLM adapter |
| Workflow HTTP Baseline | COMPLETE | POST /api/workflow/run, GET /api/workflow/types, GET /api/workflow/status |
| Console Workflow Panel | COMPLETE | 真实 chat surface 可见挂载；desktop/mobile browser QA；interface-audit |
| Real Play Scenario Runner | COMPLETE | 6 个离线 scenarios；`npm run real-play:smoke` |
| Mode Productization Slices | COMPLETE-PARTIAL | tabletop dice、mystery clue board、strategy resources 均可运行；不是完整 DND/推理引擎/4X |
| Narrative Experience Slices | COMPLETE-PARTIAL | immersive proposal UI、fallback recap、goal tracker、rhythm tag；不等同长期记忆或 quest engine |
| Universal Mode V2-ready Foundation | COMPLETE-PARTIAL | universal metadata/visibility/lifecycle/capability；8 模式 normalizer/fixture/test；V2 Entry Closure (sealed) 系统 |

## What Is Current

- 工作流层完整的创建/导入/游玩/角色/推理/策略/观测管线
- V2-ready foundation：通用 metadata/visibility/lifecycle/capability contracts 已建立
- 8 个模式入口均有 V2-ready normalizer、fixture、test
- 产品功能数仍为 8 个 canonical features；`single-player-scriptkill-v2` 是 `murder-mystery` 的服务别名，`detective-v2` 是 `mystery-puzzle` 的服务别名，`tabletop-v2` 是 `tabletop` 的服务别名
- quick-setting 支持 DeepSeek 风格原始设定 intake，保留原文
- strategy 保留固定状态面板 + 数值/概率底座
- 所有 V2-ready 能力遵守 runtime/candidate/proposal/shared canon 边界
- Server workflow HTTP 端点可调用
- LLM adapter 支持真实/离线/测试三种模式
- 所有 workflow 默认 candidate-only，不直接写 shared canon
- Console workflow panel 已在真实 chat surface 可见挂载
- 离线 scenario runner 覆盖 workflow/creation/alchemy/play/character/mystery/strategy

## What Is Historical

- WORKFLOW_INTEGRATION_REPORT — 已被 Service Deepening 替代
- v0.3.0 审查建议 — 进入 ROADMAP_CANDIDATES，不代表当前能力
- v0.4.0-pre-v2-closure (tag at `0ee1852`) — audit-invalidated; superseded by `v0.4.1-v2-entry-closure.0` at `87472741c229afe2597a6229d98059b29d61913c`

## Pre-V2 Closure — Stages Completed

| Stage | Summary |
|-------|---------|
| 5A-5Z | Safe baseline & inventory: docs cleanup, legacy removal, warning reconciliation, asset gate, mode-specific readback |
| 6 | Architecture & diagnostics: server runtime boundary extraction, architecture map, maintenance/debugging guides, route/mode inventories |
| 7 | Product usability closure: user quickstart, LLM setup guide, play mode guide, no-gateway runtime QA, Pre-V2 Closure report |

## Blocker Repair

P0/P1 blockers found in audit were repaired on `hermes/pre-v2-closure-blocker-repair` and merged to `main`:

| Blocker | Fix |
|---------|-----|
| P0: userData test pollution | `WORLD_TREE_USER_DATA_DIR` env var; `src/server/user-data-root.js`; integration helper auto-creates temp dir |
| P1: request-body contract | `req.resume()` replaces `req.destroy()`; `INVALID_JSON_BODY` for non-object JSON; `requireObject` default |
| P1: creation-forge authority | `POST /api/modules/create` rejects `mode=creation-forge` with `MODE_PROJECT_CREATION_DISABLED` |
| P1: version truth conflict | Unified to `0.4.0-pre-v2-closure.1` across package/lock/manifest/README/CHANGELOG/AI-GUIDE |

## Current Guarantees

- `npm run audit`: 0 errors
- `npm run check`: PASS
- `npm run docs:check`: 24/24
- `npm run asset:check`: 0 errors, 0 warnings
- `npm run interface-audit`: 149 passes, 0 warnings
- `npm run test:unit`: 416 pass
- `npm run test:integration`: 119 pass
- `npm run preflight`: PASS (includes V2 entry gates + project-complete-audit)
- userData isolation verified: real `userData/` files unchanged before/after full test suite

## Current Limitations

- Tabletop 不是完整 DND；Mystery 不是完整推理引擎；Strategy 不是完整 4X
- Chapter recap 以 deterministic fallback 为基线，LLM summary 不是已验证能力
- 目标追踪是轻量 runtime UI，不是完整 quest engine
- 完整 Worldbook V2 / Character Capsule V2 仍未实现
- `server.js` still owns route dispatch (monolithic if-chain)
- `world-tree-console.js` is a monolithic ES module
- Browser QA was not performed (gateway unstable)
- UX alias repair is command-audited; browser visual QA remains not automated in this baseline
- No TypeScript migration; no automated browser testing

## Boundary

Status: **AUDIT-INVALIDATED / REPAIR CANDIDATE**

Stages 5-7 landed on `main`, but the full local audit at `0ee1852` invalidated the claimed final seal. The current repair candidate is `0.4.0-pre-v2-closure.1` on `codex/pre-v2-closure-blocker-repair` and requires re-audit before any trusted seal.

Scope: 8 stages of baseline inventory, documentation cleanup, legacy removal, warning reconciliation, asset integration gate, and mode-specific shared readback integration.

| Stage | Summary | Commit |
|---|---|---|
| 5A | Baseline & Inventory | `0bd25f3` |
| 5B | Safe Documentation Cleanup | `8e67179` |
| 5C | Legacy Workflow Directory Removal | `4401594` |
| 5D | Inventory Reconciliation & Warning Proof | `2089c81` |
| 5E | Asset Inventory Warning Resolution | `8eb2547` |
| 5F | Interface-Audit Proof & Closure Gates | `a8a67f7` |
| 5G | Maintenance Entry & Asset Integration Gate | `e07d5aa` |
| 5H | Mode-Specific Shared Readback | `349f99d` |
| 5Z | Final Audit & Merge Readiness | `2ef932a` |

Historical checks and current repair requirements:
- `npm run asset:check`: 0 errors, 0 warnings
- `npm run interface-audit`: 0 warnings (149 passes)
- The prior integration/preflight claim is invalidated. The real failure was a reproducible request-body socket error, not an accepted flaky port race.
- Repair completion requires full `npm run preflight` PASS and unchanged repository `userData/` hashes.
- All 8 mode-specific shared seed files integrated into `moduleData.modeSpecific`
- Maintenance entry: `docs/MAINTENANCE_ENTRY.md`
- Asset Preservation & Integration Gate: `docs/PRE_V2_CLOSURE_GATES.md`
- Mode-specific shared files read back into `moduleData.modeSpecific`
- No assets deleted, detached, or downgraded

Boundary:
- This is not full V2.
- This does not implement complete mode-specific gameplay engines.
- Stage 5 closure is now landed on `main`; Stage 6 closure continues the Pre-V2 baseline on `main`.

## Stage 6 Status

Stage 6 has completed server runtime boundary extraction and architecture diagnostics closure.

Completed:
- `src/server/http-response.js`
- `src/server/http-request.js`
- `src/server/local-access.js`
- `docs/ARCHITECTURE_MAP.md`
- `docs/MAINTENANCE_GUIDE.md`
- `docs/DEBUGGING_GUIDE.md`
- `docs/API_ROUTE_INVENTORY.md`
- `docs/MODE_BOUNDARY_MAP.md`

Boundary:
- Stage 6 does not implement full V2.
- Stage 6 does not fully split API routes.
- Stage 6 does not change persistence, proposal/canon, LLM adapter, or mode business behavior.

## Stage 7 Status

Stage 7 previously claimed a usable sealed baseline. The full local audit invalidated that seal evidence; the historical artifacts remain, but they are not current release proof.

Completed:
- `docs/USER_QUICKSTART.md`
- `docs/LOCAL_LLM_SETUP.md`
- `docs/PLAY_MODE_GUIDE.md`
- `docs/NO_GATEWAY_RUNTIME_QA_REPORT.md`
- `docs/PRE_V2_CLOSURE_REPORT.md`
- README updated with current state

Boundary:
- Browser gateway QA was intentionally not used (gateway unstable).
## Prior v0.4.0 Pre-V2 Closure Tag

Status: **AUDIT-INVALIDATED AS TRUSTED FINAL SEAL**

The tag `v0.4.0-pre-v2-closure` still exists at `0ee1852feb9496755ecc27f722dbe672732c2d65`. It was not moved or deleted. The full local audit found P0/P1 blockers, so the tag is a historical repository fact, not trusted final-seal proof.

The repair candidate is not full V2 and is not a new seal. See `docs/RELEASE_SEAL_AUDIT_INVALIDATION_NOTE.md` and `docs/PRE_V2_BLOCKER_REPAIR_REPORT.md`.

Completed:
- Stage 5: safety baseline, debt cleanup, warning reconciliation, asset protection and integration gate
- Stage 6: server runtime boundary extraction, architecture map, maintenance/debugging guides, route/mode inventories
- Stage 7: no-gateway runtime QA, user quickstart, LLM setup guide, play mode guide, final Pre-V2 Closure report

Boundary:
- No full V2 implementation.
- No persistence format rewrite.
- No proposal/canon rewrite.
- No LLM adapter rewrite.
- No mode engine rewrite.
- No browser gateway QA claim.
- No tag was moved/deleted and no new tag was created during blocker repair.
