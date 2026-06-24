# Tech Debt Inventory

> Stage 5A 基线，Stage 5B+5C+5D 持续更新。已完成项标 RESOLVED。

## P0: Do Not Touch Without Dedicated Plan

以下区域任何修改必须单独开执行文件，不得在常规清理/重构中顺手改动：

| Area | Reason | Risk |
|---|---|---|
| `server.js` route behavior | 3209 行单体 HTTP 服务器，路由交织 | 静默破坏 API 契约 |
| persistence/save format | `.worldtree` 导出/导入 + engineState snapshot | 破坏存档兼容性 |
| proposal/canon gate | `workflow-authority-gate.js` + `proposal-bus.js` | shared canon 写入未被授权 |
| LLM adapter | `llm-workflow-adapter.js` | 真实/离线/测试三模式切换 |
| path-security | `path-security.js` + `persistence-service.js` | 路径穿越 |
| v2-ready visibility/lifecycle | `visibility-policy.js` + `lifecycle-state.js` | hidden_truth 泄露、canon write 绕过 |
| `creation-forge` mode contract | producer mode，不是普通 consumer 入口 | 资产生产工厂被当作玩法入口 |

## P1: Confirmed Cleanup Candidates

仅列出已通过引用搜索初步确认的候选。Stage 5A 不执行任何清理。每项标出证据和建议阶段。

### P1-1: `src/core/workflow/` vs `src/core/workflows/` duplicate directory — RESOLVED (Stage 5C)

| Field | Value |
|---|---|
| Status | **RESOLVED in Stage 5C** |
| Original issue | `src/core/workflow/` duplicated the active `src/core/workflows/` workflow spine |
| Action | Migrated the single active test import to `src/core/workflows/`; removed `src/core/workflow/` |
| Evidence | `src/core/workflow/` has 0 code/test references after Stage 5C; `p3-context-builder` and `buildP3MechanismContext` have 0 code/test references |
| Safety | No production workflow logic changed; only test import migration + orphaned OLD directory deletion |
| Report | `docs/STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md` |

### P1-2: `docs/SCRIPTS_AND_CHECKS.md` outdated — RESOLVED (Stage 5B)

| Field | Value |
|---|---|
| Status | **RESOLVED in Stage 5B** |
| Original issue | Preflight description listed only 5 commands; actual `package.json` preflight has 19 sub-commands |
| Action | Rewrote `docs/SCRIPTS_AND_CHECKS.md` with full preflight chain, 10 scripts listed, test suite summary |

### P1-3: `docs/` P1 historical reports naming/placement — RESOLVED (Stage 5B)

| Field | Value |
|---|---|
| Status | **RESOLVED in Stage 5B** |
| Original issue | 14 `WORLD_TREE_*.md` historical P1 execution reports mixed with active docs |
| Action | Archived to `docs/archive/p1-reports/` via `git mv`; updated `DOCUMENTATION_STATUS.md` paths

## P2: Needs Investigation

看起来可能冗余，但证据不足，不能判定为债务。需要更深入的引用搜索。

- `src/core/legacy/` 目录中多个文件的当前引用状态（`legacy-modernization-registry.js`、`p3-merge-map.js`）
- `src/core/data/` 目录下的 `alchemy/types.js` 等是否仍有活跃引用
- `src/core/engine/` 下的 `rpg.js`、`sim.js`、`tabletop.js`、`murder-mystery.js` 是否已被 mode-specific 模块替代

## P3: Documentation Debt

| # | Problem | Location | Status | Stage |
|---|---|---|---|---|---|
| D1 | INDEX 顶部里程碑未列出 Stage 4 | `docs/INDEX.md` | **RESOLVED** | Stage 5A |
| D2 | INDEX 未索引 Stage 4/5A/5B/5C 报告 | `docs/INDEX.md` | **RESOLVED** | Stage 5A+5B+5C |
| D3 | SCRIPTS_AND_CHECKS preflight 描述与实际不一致 | `docs/SCRIPTS_AND_CHECKS.md` | **RESOLVED** | Stage 5B |
| D4 | 历史执行报告（WORLD_TREE_*_P1.md）混在活跃文档中 | `docs/` | **RESOLVED** | Stage 5B (archived) |
| D5 | ROADMAP_CANDIDATES 已完成项可能误导 | `docs/ROADMAP_CANDIDATES.md` | **RESOLVED** | Stage 5B (historical annotation added) |
| D6 | 文档命名风格不统一 | `docs/` | **PARTIAL** | Partially addressed by Stage 5B archive |

## P4: Test/Script Debt

| # | Problem | Evidence | Severity |
|---|---|---|---|
| T1 | `scripts/` 目录有 10 个脚本，部分无文档说明（如 `generate-knowledge-cards.mjs`） | 仅 `SCRIPTS_AND_CHECKS.md` 列出了 5 个，实际有 10 个 | Low |
| T2 | `scripts/test.mjs` 用途不明（`package.json` 中 `npm test` 指向它但所有特定测试都有独立命令） | `scripts/test.mjs` 存在 | Low |
| T3 | V2-ready tests (67 items) 已计入 `test:unit` 但不单独有 npm script | `package.json` 无 `test:v2-ready` | Low |
| T4 | Browser QA 未脚本化（仅手动 browser QA 验证） | docs 记录 | Medium |

## P5: Warning Debt

| Source | Count | Status | Description |
|---|---:|---|---|
| `npm run asset:check` | 0 | **RESOLVED in Stage 5E** | P3 M1-M11 exact references added to asset inventory |
| `npm run interface-audit` | 0 | **RESOLVED in Stage 5H** | Mode-specific shared seed files are now read back into `moduleData.modeSpecific`; interface-audit recognizes the dynamic contract readback |

Asset warnings resolved by `docs/STAGE_5E_ASSET_INVENTORY_RECONCILIATION_REPORT.md`. Interface warnings resolved by `docs/STAGE_5H_MODE_SPECIFIC_READBACK_REPORT.md`.

## Non-Debt: Historical Records to Preserve

以下文档是历史记录，包含有价值的决策上下文，不应删除：

| Document | Why Preserve |
|---|---|
| `docs/REAL_PLAY_PRODUCTIZATION_REPORT.md` | Stage 0-3 完成报告，记录真实游玩链路建立过程 |
| `docs/REAL_PLAY_PRODUCTIZATION_CLOSURE_REPORT.md` | Codex→Hermes 收尾闭环报告，记录测试覆盖和修复 |
| `docs/V2_READY_FOUNDATION_REPORT.md` | Stage 4 完成报告，记录 V2-ready foundation 建立过程 |
| `docs/FINAL_DOCUMENTATION_CLEANUP_REPORT.md` | 文档收口报告 |
| `docs/archive/PRODUCT-PROPOSAL-v2.2.1.md` | 原始产品提案，历史参考价值 |
| `docs/v0.3.0-baseline-audit.md` | v0.3.0 基线审计 |
| All `WORLD_TREE_*_P1.md` files | P1 阶段执行记录，共 11 个文件 |
