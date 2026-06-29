<!-- WORLD_TREE_TRUTH_SOURCE_SYNC:START -->
## Current truth-source documents

| Document | Role |
|---|---|
| [PROJECT_TRUTH_SOURCE.md](PROJECT_TRUTH_SOURCE.md) | Current truth-source index |
| [CURRENT_PROJECT_STATE.md](CURRENT_PROJECT_STATE.md) | Current project state |
| [V2_ENGINEERING_CLOSURE_STATUS.md](V2_ENGINEERING_CLOSURE_STATUS.md) | Engineering foundation/service closure status |
| [V2_ENTRY_COMPLETION_STATUS.md](V2_ENTRY_COMPLETION_STATUS.md) | Entry-specific closure status |
| [STATUS_TERMINOLOGY.md](STATUS_TERMINOLOGY.md) | Required status vocabulary |
| [AGENT_STATUS_HANDOFF.md](AGENT_STATUS_HANDOFF.md) | Agent handoff summary |

Current status: Full V2 is not complete. Strategy Sim V2 and Worldbook V2 are engineering foundation complete; product closure is not complete.
Productization Closure is in progress. Creation Forge / Alchemy G1 engineering loop is implemented. User-created content closure and blank template infrastructure are recorded as PASS; bundled story examples, tutorials/onboarding content, product-wide manual smoke, and release readiness remain deferred or incomplete until recorded in closure reports.
<!-- WORLD_TREE_TRUTH_SOURCE_SYNC:END -->

# World Tree 文档索引

> 当前里程碑状态：P0-P2 Kernel COMPLETE · Prompt/LLM Routing Alignment COMPLETE · UX Entry Coherence COMPLETE · Feature Alias Registry COMPLETE · P3 M1-M11 COMPLETE · Asset Maturation COMPLETE · Workflow Integration W0-W4 COMPLETE · Service Deepening + HTTP Wiring COMPLETE · Real Play Productization 0-3 COMPLETE-PARTIAL · Universal Mode V2-ready Foundation (Stage 4) COMPLETE-PARTIAL · Documentation Truth-Source Alignment COMPLETE
>
> **真相源优先级**：
> PROJECT_TRUTH_SOURCE > CURRENT_PROJECT_STATE > V2_ENGINEERING_CLOSURE_STATUS > V2_ENTRY_COMPLETION_STATUS > PLAY_MODE_GUIDE > README/AI-GUIDE/docs/INDEX > 活跃架构文档 > 历史报告/archive
>
> Full product-wide V2 is not complete.
> V2 entry closure is engineering/service closure for selected entries.
> Product-wide playable closure is not complete.

---

## Current Trusted Baseline

- **Trusted tag**: `v0.4.2-v2-engineering-foundation-truth.0`
- **Current branch**: `main`
- **Latest audited commit**: `dbb4634` (CI productization gates baseline; final report commit is listed in git history).
- **Remote CI**: `UNKNOWN`
- **Status**: V2 Entry Closure sealed; Prompt/LLM routing alignment and UX alias coherence added; pending remote CI
- **Full V2**: Full product-wide V2 not complete; V2 entry closure complete for four entries
- **Browser QA**: not run for UX alias patch; command audits cover routing and coherence

Product feature identity:

- World Tree has exactly 8 canonical product features.
- `tabletop-v2`, `detective-v2`, `character-v2`, and `single-player-scriptkill-v2` are runtime/service slices or aliases of existing features, not additional product features.
- ScriptKill resolves to `murder-mystery`; Detective V2 resolves to `mystery-puzzle`; Tabletop V2 resolves to `tabletop`.

Key entry points for the current baseline:

| Document | Purpose |
|----------|---------|
| [CURRENT_PROJECT_STATE.md](CURRENT_PROJECT_STATE.md) | Current project truth source |
| [PRE_V2_CLOSURE_REPORT.md](archive/stage-reports/PRE_V2_CLOSURE_REPORT.md) | Final Pre-V2 Closure report |
| [RELEASE_NOTES_v0.4.0_PRE_V2_CLOSURE.md](archive/stage-reports/RELEASE_NOTES_v0.4.0_PRE_V2_CLOSURE.md) | Release notes for repaired baseline |
| [RELEASE_SEAL_AUDIT_INVALIDATION_NOTE.md](RELEASE_SEAL_AUDIT_INVALIDATION_NOTE.md) | Old tag invalidation (superseded) |
| [NO_GATEWAY_RUNTIME_QA_REPORT.md](NO_GATEWAY_RUNTIME_QA_REPORT.md) | No-gateway runtime QA |
| [SCRIPTS_AND_CHECKS.md](SCRIPTS_AND_CHECKS.md) | Scripts and checks reference |
| [ASSET_CLASSIFICATION_TODO.md](ASSET_CLASSIFICATION_TODO.md) | Asset classification status |
| [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md) | Architecture map |
| [API_ROUTE_INVENTORY.md](API_ROUTE_INVENTORY.md) | API route inventory |
| [MODE_BOUNDARY_MAP.md](MODE_BOUNDARY_MAP.md) | Mode boundary map |
| [Productization Reality Check](reports/productization-reality-check.md) | R0 Productization Closure reality check |

---

## 给用户（体验和游玩）

| 文档 | 用途 |
|------|------|
| [README.md](../README.md) | 项目入门：是什么、怎么装、怎么玩 |
| [CURRENT_PROJECT_STATE.md](CURRENT_PROJECT_STATE.md) | 当前项目真相源 |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | 项目全景 |
| [FEATURES.md](FEATURES.md) | 功能清单 |
| [API_REFERENCE.md](API_REFERENCE.md) | API 文档 |
| [API_ROUTE_INVENTORY.md](API_ROUTE_INVENTORY.md) | 当前真实 API 路由总表 |
| [API_PRODUCT_CONTRACT.md](API_PRODUCT_CONTRACT.md) | 产品入口 API 合同草案 |
| [API_ALCHEMY_CONTRACT.md](API_ALCHEMY_CONTRACT.md) | 炼金台 G1 API 合同 |
| [SAVE_SYSTEM_AND_WORLD_PACK.md](SAVE_SYSTEM_AND_WORLD_PACK.md) | 存档与导入导出 |
| [INSTALL_AND_FIRST_RUN.md](INSTALL_AND_FIRST_RUN.md) | 安装与首次运行 |
| [RELEASE_READINESS.md](RELEASE_READINESS.md) | 发布准备状态 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 常见问题排查 |
| [ROADMAP_CANDIDATES.md](ROADMAP_CANDIDATES.md) | 路线候选建议（不代表已实现） |

## 给维护者（架构和工作流）

| 文档 | 用途 |
|------|------|
| [ARCHITECTURE_V1.md](ARCHITECTURE_V1.md) | V1 架构 |
| [PROPOSAL_AND_REVIEW_SYSTEM.md](PROPOSAL_AND_REVIEW_SYSTEM.md) | 提案与审核系统 |
| [PROMPT_ORCHESTRATION_LAYER.md](PROMPT_ORCHESTRATION_LAYER.md) | 提示词编排与边界治理层 |
| [REAL_WORKFLOW_INTEGRATION_LAYER.md](REAL_WORKFLOW_INTEGRATION_LAYER.md) | 工作流接入层架构 |
| [Living World Kernel P0](LIVING_WORLD_KERNEL_P0.md) | P0 活世界 Kernel |
| [Experience Stability Kernel P1](EXPERIENCE_STABILITY_KERNEL_P1.md) | P1 体验稳定 Kernel |
| [Long Play Kernel P2](P2_LONG_PLAY_KERNEL.md) | P2 长期游玩 Kernel |
| [SCRIPTS_AND_CHECKS.md](SCRIPTS_AND_CHECKS.md) | 脚本与检查 |
| [DOCUMENTATION_STATUS.md](DOCUMENTATION_STATUS.md) | 文档状态 |
| [WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md](WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md) | Real Play 0-3 仓库内执行入口 |
| [CHARACTER_CAPSULE_V2_PRODUCT_SPEC.md](CHARACTER_CAPSULE_V2_PRODUCT_SPEC.md) | Character Capsule V2 Text-first 产品与边界设计（V2 text-first / long-term entry closure implemented; full advanced editor deferred） |
| [CHARACTER_CAPSULE_V2_UI_RULES.md](CHARACTER_CAPSULE_V2_UI_RULES.md) | Character Capsule V2 普通 UI / 高级设置折叠规则（V2 text-first / long-term entry closure implemented; full advanced editor deferred） |
| [CHARACTER_CAPSULE_V2_ROADMAP.md](CHARACTER_CAPSULE_V2_ROADMAP.md) | Character Capsule V2 分步执行路线（V2 text-first / long-term entry closure implemented; full advanced editor deferred） |

## 给 AI Agent（操作规则和保护清单）

| 文档 | 用途 |
|------|------|
| [AI-GUIDE.md](../AI-GUIDE.md) | AI Agent 工作手册 |
| [AI_AGENT_OPERATING_GUIDE.md](AI_AGENT_OPERATING_GUIDE.md) | Agent 详细操作规范 |
| [Asset / Function / Mechanism Inventory](WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md) | 资产防遗失清单 (preservation ledger) |
| [Asset Status Matrix](ASSET_STATUS_MATRIX.md) | 资产成熟化状态矩阵 |

## 验证报告（历史快照）

| 文档 | 状态 |
|------|------|
| [Asset Maturation Report](ASSET_MATURATION_REPORT.md) | ✅ 当前 |
| [Real Play Productization Report](REAL_PLAY_PRODUCTIZATION_REPORT.md) | ✅ v0.3.1 当前 |
| [Productization Closure Report](reports/productization-closure-report.md) | PARTIAL: user-created content PASS, blank templates PASS, story examples/tutorials deferred |
| [User-Created Content Closure Evidence](reports/user-created-content-closure-evidence.md) | PASS evidence for Flow A, Flow B, and browser smoke |
| [Product Entry Closure Matrix](reports/product-entry-closure-matrix.md) | PARTIAL entry evidence matrix |
| [Workflow Integration Report](WORKFLOW_INTEGRATION_REPORT.md) | ⚠️ 已被 Service Deepening 替代 |
| [MODE_ROUTING_AND_CAPSULES.md](MODE_ROUTING_AND_CAPSULES.md) | 路由与模式胶囊 |
| [MODE_PROMPTS_AND_PACKETS.md](MODE_PROMPTS_AND_PACKETS.md) | 提示词与数据包 |

## Pre-V2 Closure 盘点 (Stage 5A)

> 以下 5 个文档为 Stage 5A Baseline & Inventory 新增。只做盘点记录，不做清理/重构。

| 文档 | 用途 |
|------|------|
| [PRE_V2_CLOSURE_BASELINE.md](archive/stage-reports/PRE_V2_CLOSURE_BASELINE.md) | Pre-V2 Closure 基线快照 |
| [TECH_DEBT_INVENTORY.md](TECH_DEBT_INVENTORY.md) | 技术债清单（分类+证据） |
| [DOCS_INVENTORY.md](archive/stage-reports/DOCS_INVENTORY_STAGE_5A.md) | 文档盘点（Stage 5A 快照，已归档） |
| [CURRENT_DOCUMENTATION_INVENTORY.md](CURRENT_DOCUMENTATION_INVENTORY.md) | 当前文档生命周期盘点 |
| [TESTS_INVENTORY.md](TESTS_INVENTORY.md) | 测试体系真实盘点 |
| [ARCHITECTURE_REALITY_CHECK.md](ARCHITECTURE_REALITY_CHECK.md) | 当前真实架构地图 |
| [STAGE_5B_SAFE_CLEANUP_REPORT.md](archive/stage-reports/STAGE_5B_SAFE_CLEANUP_REPORT.md) | Stage 5B 安全文档清理与引用证明 |
| [STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md](archive/stage-reports/STAGE_5C_SAFE_CODE_CLEANUP_REPORT.md) | Stage 5C workflow 旧目录安全收束报告 |
| [STAGE_5D_WARNING_DEBT_REALITY_CHECK_REPORT.md](archive/stage-reports/STAGE_5D_WARNING_DEBT_REALITY_CHECK_REPORT.md) | Stage 5D 清单对账与警告债真实定位 |
| [STAGE_5E_ASSET_INVENTORY_RECONCILIATION_REPORT.md](archive/stage-reports/STAGE_5E_ASSET_INVENTORY_RECONCILIATION_REPORT.md) | Stage 5E 资产清单 warning 收束报告 |
| [STAGE_5F_INTERFACE_AUDIT_ARCHITECTURE_PROOF.md](archive/stage-reports/STAGE_5F_INTERFACE_AUDIT_ARCHITECTURE_PROOF.md) | Stage 5F interface-audit 架构证明 |
| [PRE_V2_CLOSURE_GATES.md](archive/stage-reports/PRE_V2_CLOSURE_GATES.md) | Pre-V2 Closure 硬门槛规则 |
| [MAINTENANCE_ENTRY.md](MAINTENANCE_ENTRY.md) | 维护入口：AI/人类维护前必须阅读 |
| [STAGE_5G_ASSET_INTEGRATION_GATE_REPORT.md](archive/stage-reports/STAGE_5G_ASSET_INTEGRATION_GATE_REPORT.md) | Stage 5G 资产接入门槛与 interface proof 纠偏 |
| [STAGE_5H_MODE_SPECIFIC_READBACK_REPORT.md](archive/stage-reports/STAGE_5H_MODE_SPECIFIC_READBACK_REPORT.md) | Stage 5H mode-specific 读回接入报告 |
| [PRE_V2_CLOSURE_FINAL_REPORT.md](archive/stage-reports/PRE_V2_CLOSURE_FINAL_REPORT.md) | Pre-V2 Closure 最终审计与合并准备报告 |
| [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md) | Stage 6 架构当前地图 |
| [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md) | Stage 6 维护指南 |
| [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md) | Stage 6 调试指南 |
| [API_ROUTE_INVENTORY.md](API_ROUTE_INVENTORY.md) | API Route 清单 |
| [MODE_BOUNDARY_MAP.md](MODE_BOUNDARY_MAP.md) | Mode 边界与资产地图 |
| [STAGE_6_ARCHITECTURE_DIAGNOSTICS_CLOSURE_REPORT.md](archive/stage-reports/STAGE_6_ARCHITECTURE_DIAGNOSTICS_CLOSURE_REPORT.md) | Stage 6 架构诊断收口报告 |
| [USER_QUICKSTART.md](USER_QUICKSTART.md) | 用户快速开始指南 |
| [LOCAL_LLM_SETUP.md](LOCAL_LLM_SETUP.md) | 本地/远程 LLM 设置指南 |
| [PLAY_MODE_GUIDE.md](PLAY_MODE_GUIDE.md) | 当前模式状态与限制 |
| [NO_GATEWAY_RUNTIME_QA_REPORT.md](NO_GATEWAY_RUNTIME_QA_REPORT.md) | 无网关 Runtime QA 报告 |
| [PRE_V2_CLOSURE_REPORT.md](archive/stage-reports/PRE_V2_CLOSURE_REPORT.md) | Pre-V2 Closure 最终报告 |
| [RELEASE_NOTES_v0.4.0_PRE_V2_CLOSURE.md](archive/stage-reports/RELEASE_NOTES_v0.4.0_PRE_V2_CLOSURE.md) | v0.4.0 Pre-V2 Closure Release Notes |

## 历史与归档

- [archive/](archive/) — 历史设计/执行记录（含 P1 报告），不代表当前能力
- [LEGACY_REDUNDANCY_AUDIT.md](LEGACY_REDUNDANCY_AUDIT.md) — Legacy 资产审计
- [LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md](LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md) — 兼容与升级计划
- [V2 Entry Completion Status](V2_ENTRY_COMPLETION_STATUS.md)
