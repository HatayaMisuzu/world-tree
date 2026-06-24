# Tech Debt Inventory

> Stage 5A: 技术债清单。只分类记录，不执行清理。每项必须有路径、证据、风险和建议阶段。

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
| Evidence | `tests/unit/workflow-context-envelope.test.js` migrated to NEW path; zero code/test imports remain for OLD; OLD directory removed |
| Date | 2026-06-24 |

| Field | Value |
|---|---|
| Path | `src/core/workflow/` (2 files: `p3-context-builder.js`, `workflow-context-envelope.js`) — **REMOVED in Stage 5C** |
| Reason | `src/core/workflows/` 是当前主目录（19 files），`src/core/workflow/` 是旧目录，唯一的测试引用已迁移 |
| Evidence | `search_files` 确认两个目录同时存在；`workflow-context-envelope.js` 在两处各有一份 |
| References | `server.js` 从 `src/core/workflows/` import |
| Risk | Low — 需确认旧文件无隐藏引用后归档 |
| Suggested action | Investigate (Stage 5B) |

### P1-2: `docs/SCRIPTS_AND_CHECKS.md` outdated

| Field | Value |
|---|---|
| Path | `docs/SCRIPTS_AND_CHECKS.md` |
| Reason | 声称 preflight 顺序为 `audit → check → test:unit → test:integration → interface-audit`，但实际 `package.json` 中 preflight 包含远多于这些的命令（p0/p1/p2/kernel/prompts/legacy-mechanisms/assets/authority/legacy-modernization/workflow-readiness/workflow:check/test:workflows 等） |
| Evidence | 对比 `package.json` scripts.preflight 实际内容 |
| Risk | Low — 仅文档过时 |
| Suggested action | Update or replace with reference to package.json |

### P1-3: `docs/` 中 v0.3.0 历史执行报告命名不统一

| Field | Value |
|---|---|
| Path | 多个 `WORLD_TREE_*_P1.md` 文件（如 `WORLD_TREE_MODE_RUNTIME_CORE_P1.md`、`WORLD_TREE_MODULE_RUNTIME_ORCHESTRATOR_P1.md` 等 11 个） |
| Reason | 这些是 P1 阶段的阶段性执行报告，命名风格与当前文档不一致（`WORLD_TREE_` 前缀 + `_P1` 后缀），可能被误认为是当前架构文档 |
| Evidence | `docs/` 目录下有 11 个 `WORLD_TREE_*_P1.md` |
| Risk | Low — 仅命名问题 |
| Suggested action | Archive later (Stage 5B+) |

## P2: Needs Investigation

看起来可能冗余，但证据不足，不能判定为债务。需要更深入的引用搜索。

- `src/core/legacy/` 目录中多个文件的当前引用状态（`legacy-modernization-registry.js`、`p3-merge-map.js`）
- `src/core/data/` 目录下的 `alchemy/types.js` 等是否仍有活跃引用
- `src/core/engine/` 下的 `rpg.js`、`sim.js`、`tabletop.js`、`murder-mystery.js` 是否已被 mode-specific 模块替代

## P3: Documentation Debt

| # | Problem | Location | Severity |
|---|---|---|---|
| D1 | `docs/INDEX.md` 顶部里程碑未列出 Stage 4 (V2-ready Foundation) | `docs/INDEX.md` line 3 | Low |
| D2 | `docs/INDEX.md` 未索引 Stage 4 报告 (`V2_READY_FOUNDATION_REPORT.md`) | `docs/INDEX.md` | Low |
| D3 | `docs/SCRIPTS_AND_CHECKS.md` preflight 描述与实际不一致 | `docs/SCRIPTS_AND_CHECKS.md` | Low |
| D4 | 多名历史执行报告（`WORLD_TREE_*_P1.md`）混在活跃文档中 | `docs/` | Low |
| D5 | `docs/ROADMAP_CANDIDATES.md` 包含已完成的 "Real Play Productization 0-3" 标记，可能引起混淆 | `docs/ROADMAP_CANDIDATES.md` | Low |
| D6 | `docs/` 目录下有 56 个文件，命名风格不统一（`WORLD_TREE_` 前缀 vs 无前缀 vs `v0.3.0-` 前缀） | `docs/` | Medium |

## P4: Test/Script Debt

| # | Problem | Evidence | Severity |
|---|---|---|---|
| T1 | `scripts/` 目录有 10 个脚本，部分无文档说明（如 `generate-knowledge-cards.mjs`） | 仅 `SCRIPTS_AND_CHECKS.md` 列出了 5 个，实际有 10 个 | Low |
| T2 | `scripts/test.mjs` 用途不明（`package.json` 中 `npm test` 指向它但所有特定测试都有独立命令） | `scripts/test.mjs` 存在 | Low |
| T3 | V2-ready tests (67 items) 已计入 `test:unit` 但不单独有 npm script | `package.json` 无 `test:v2-ready` | Low |
| T4 | Browser QA 未脚本化（仅手动 browser QA 验证） | docs 记录 | Medium |

## P5: Warning Debt (Pre-existing)

| Source | Count | Description |
|---|---|---|
| `npm run asset:check` | 11 | P3 M1-M11 inventory missing references（M1-creation-wizard 到 M11-observability） |
| `npm run interface-audit` | 8 | shared/*.json files: createModule writes but buildModuleModel doesn't read |

All warnings are pre-existing and non-blocking (exit code 0). They should be addressed in Stage 5B or later, not in Stage 5A.

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
