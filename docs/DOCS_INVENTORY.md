# Docs Inventory

> Stage 5A: `docs/` 目录真实结构盘点。按用途分类，标注状态和问题。

## Truth Source Docs

当前真相源文件（AI agent 必须优先阅读）：

| Document | Status | Notes |
|---|---|---|
| `CURRENT_PROJECT_STATE.md` | ✅ 当前 | 真相源入口；已包含 Stage 0-4 状态 |
| `INDEX.md` | ⚠️ 需更新 | 顶部里程碑未列出 Stage 4；未索引 `V2_READY_FOUNDATION_REPORT.md` |
| `PROJECT_OVERVIEW.md` | ✅ 当前 | 项目全景，8 模式入口，关系图 |
| `FEATURES.md` | ✅ 当前 | 功能清单 + P0-P2 + Real Play + workflows |
| `API_REFERENCE.md` | ✅ 当前 | API 详细协议（委托 `API_ROUTE_INVENTORY.md` 为路由总表） |
| `API_ROUTE_INVENTORY.md` | ✅ 当前 | 当前真实 API 路由总表（2026-06-24 生成） |

## Architecture Docs

| Document | Status | Notes |
|---|---|---|
| `ARCHITECTURE_V1.md` | ✅ 当前 | V1 架构主文档 |
| `PROPOSAL_AND_REVIEW_SYSTEM.md` | ✅ 当前 | 提案与审核系统 |
| `PROMPT_ORCHESTRATION_LAYER.md` | ✅ 当前 | 提示词编排与边界治理 |
| `REAL_WORKFLOW_INTEGRATION_LAYER.md` | ✅ 当前 | 工作流接入层架构 |
| `LIVING_WORLD_KERNEL_P0.md` | ✅ 当前 | P0 活世界 Kernel |
| `EXPERIENCE_STABILITY_KERNEL_P1.md` | ✅ 当前 | P1 体验稳定 Kernel |
| `P2_LONG_PLAY_KERNEL.md` | ✅ 当前 | P2 长期游玩 Kernel |
| `MODE_ROUTING_AND_CAPSULES.md` | ✅ 当前 | 路由与模式胶囊 |
| `MODE_PROMPTS_AND_PACKETS.md` | ✅ 当前 | 提示词与数据包 |
| `CANON_RUNTIME_CANDIDATE_POLICY.md` | ✅ 当前 | Canon/Runtime/Candidate 分层规则 |
| `LEGACY_COMPATIBILITY_POLICY.md` | ✅ 当前 | 旧模块兼容策略 |

## User Docs

| Document | Status | Notes |
|---|---|---|
| `README.md` (root) | ✅ 当前 | 项目入门 |
| `SAVE_SYSTEM_AND_WORLD_PACK.md` | ✅ 当前 | 存档与导入导出 |
| `SCRIPTS_AND_CHECKS.md` | ⚠️ 过时 | preflight 顺序描述不准确（见 TECH_DEBT_INVENTORY P1-2） |

缺口：无 quickstart / setup / play guide 独立文档（README 承担了入门角色）。

## AI Agent Docs

| Document | Status | Notes |
|---|---|---|
| `AI-GUIDE.md` (root) | ✅ 当前 | AI Agent 工作手册 v0.3.1 |
| `AI_AGENT_OPERATING_GUIDE.md` | ✅ 当前 | Agent 详细操作规范 |
| `WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md` | ✅ 当前 | 资产防遗失清单 (preservation ledger) |
| `ASSET_STATUS_MATRIX.md` | ✅ 当前 | 资产成熟化状态矩阵 |
| `LEGACY_REDUNDANCY_AUDIT.md` | ✅ 当前 | Legacy 资产审计 |
| `LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md` | ✅ 当前 | 兼容与升级计划 |
| `DOCUMENTATION_STATUS.md` | ✅ 当前 | 文档状态 |

## Reports (Current)

| Document | Status | Notes |
|---|---|---|
| `ASSET_MATURATION_REPORT.md` | ✅ 当前 | Asset Maturation 报告 |
| `REAL_PLAY_PRODUCTIZATION_REPORT.md` | ✅ v0.3.1 | Real Play 0-3 报告 |
| `archive/stage-reports/REAL_PLAY_PRODUCTIZATION_CLOSURE_REPORT.md` | ✅ 当前 | Real Play 收尾闭环报告 |
| `V2_READY_FOUNDATION_REPORT.md` | ✅ 当前 | Stage 4 V2-ready Foundation 报告 |
| `WORKFLOW_SERVICE_DEEPENING_REPORT.md` | ✅ 当前 | Service Deepening 报告 |
| `FINAL_DOCUMENTATION_CLEANUP_REPORT.md` | ✅ 当前 | 文档清理收口报告 |
| `archive/stage-reports/PRE_V2_CLOSURE_BASELINE.md` | 🆕 Stage 5A | 本步新增 |
| `TECH_DEBT_INVENTORY.md` | 🆕 Stage 5A | 本步新增 |
| `DOCS_INVENTORY.md` | 🆕 Stage 5A | 本步新增（即本文） |

## Reports (Historical / Superseded)

| Document | Status | Notes |
|---|---|---|
| `WORKFLOW_INTEGRATION_REPORT.md` | ⚠️ 被替代 | 已被 Service Deepening 替代（`INDEX.md` 已标注） |
| `WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md` | 📋 执行入口 | 仓库内执行指令，非报告 |

## Roadmap / Backlog / Ideas

| Document | Status | Notes |
|---|---|---|
| `ROADMAP_CANDIDATES.md` | ✅ 正确 | 明确标记为候选，不代表已实现；包含已完成项 "Real Play 0-3"（已完成但保留为历史记录） |

## Historical P1 Execution Reports

以下 11 个文件是 P1 阶段执行记录（命名模式 `WORLD_TREE_*_P1.md`），不代表当前架构：

- `WORLD_TREE_CHARACTER_CAPSULE_FULL_V1.md`
- `WORLD_TREE_EXISTING_MODULE_AUDIT.md`
- `WORLD_TREE_LEGACY_ASSET_AUDIT_P1.md`
- `WORLD_TREE_LEGACY_ASSET_RENOVATION_PLAN_P1.md`
- `WORLD_TREE_LEGACY_MODULE_RECLASSIFICATION_P1.md`
- `WORLD_TREE_LEGACY_MODULE_STANDARDIZATION_P1.md`
- `WORLD_TREE_MODE_MODULE_ARCHITECTURE.md`
- `WORLD_TREE_MODE_PROJECT_FACTORY_P1.md`
- `WORLD_TREE_MODE_RUNTIME_CORE_P1.md`
- `WORLD_TREE_MODE_STATE_SCHEMA_P1.md`
- `WORLD_TREE_MODULE_RUNTIME_ORCHESTRATOR_P1.md`

以上文件建议后续移入 `docs/archive/`。

## Other Docs (no clear category)

- `WORLD_TREE_MULTI_MODE_ENTRY_CLOSURE_P1.md` — P1 多模式入口收尾
- `WORLD_TREE_PRE_FEATURE_READINESS_REPORT.md` — Pre-Feature 就绪报告
- `WORLD_TREE_QUICK_SETTING_SLICE.md` — Quick Setting 薄切片
- `v0.3.0-baseline-audit.md` — v0.3.0 基线审计
- `context-engine-design-v1.md` — Context Engine 设计
- `memory-layers-design-v1.md` — Memory Layers 设计
- `branch-director-health-plan-v1.md` — Branch Director Health Plan
- `codex-interface.md` — Codex 接口文档
- `content-provenance.md` — 内容溯源
- `content-system-design-v1.md` — 内容系统设计
- `alchemy-station-design-v1.md` — 炼金台设计
- `World-Tree-开源发布执行计划书.md` — 开源发布执行计划

## Archive

| Path | Content |
|---|---|
| `docs/archive/` | 仅 1 个文件：`PRODUCT-PROPOSAL-v2.2.1.md`（原始产品提案） |

## Problems Found

1. **`docs/INDEX.md` 顶部里程碑未列 Stage 4** — 缺少 "Universal Mode V2-ready Foundation" 条目。
2. **`docs/INDEX.md` 未索引 `V2_READY_FOUNDATION_REPORT.md`** — Stage 4 报告未被索引。
3. **历史 P1 执行报告混在活跃文档中** — 11 个 `WORLD_TREE_*_P1.md` 文件未归档。
4. **`docs/SCRIPTS_AND_CHECKS.md` 与实际 preflight 不一致** — 描述简化版 preflight，实际包含 15+ 个子命令。
5. **命名不统一** — `WORLD_TREE_` 前缀 vs 无前缀 vs `v0.3.0-` 前缀混用。
6. **56 个文档文件，`archive/` 仅 1 个** — 归档严重不足，历史文档与当前文档混放。
7. **缺口：无 quickstart guide、setup guide、play guide 独立文档**（README 承担入门角色）。
