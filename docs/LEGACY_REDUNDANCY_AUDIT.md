# Legacy Redundancy Audit

> **本报告不删除任何文件。** 仅盘点旧资产在 V1 体系中的身份和状态。

## Scope

- `src/core/engine/` — 旧引擎模块 (35 files)
- `src/core/data/` — 旧数据模型 (29 files)
- `src/server/` — 服务层旧 API/桥接
- `docs/` — 历史执行/设计文档 (36 files)
- `scripts/` — 检查/审计脚本 (6 files)
- `tests/` — 测试夹具

## Summary

| 分类 | 数量 | 说明 |
|------|------|------|
| current-source | ~15 | 当前真相源，不标 legacy |
| active-compatibility | ~25 | 仍被引用但已有新替代的兼容层 |
| legacy-bridge | ~5 | 旧 API 路径被新系统桥接调用 |
| archived-design | ~15 | 历史执行/设计记录 |
| superseded-reference | ~15 | 已被新文档覆盖的旧参考 |
| test-fixture | ~40+ | 测试文件 |
| orphan-candidate | ~3 | 未被引用的孤立文件 |

## Classification

### current-source

当前真相源，保留不动：

| 文件 | 说明 |
|------|------|
| `README.md`, `AI-GUIDE.md`, `CHANGELOG.md` | 项目入口 |
| `docs/ARCHITECTURE_V1.md` | V1 架构真相源 |
| `docs/API_REFERENCE.md` | API 真相源 |
| `docs/FEATURES.md`, `docs/PROJECT_OVERVIEW.md` | 功能/全景 |
| `docs/SAVE_SYSTEM_AND_WORLD_PACK.md` | 存档系统 |
| `docs/PROPOSAL_AND_REVIEW_SYSTEM.md` | 提案系统 |
| `docs/MODE_ROUTING_AND_CAPSULES.md` | 路由与胶囊 |
| `docs/MODE_PROMPTS_AND_PACKETS.md` | 提示词与数据包 |
| `docs/SCRIPTS_AND_CHECKS.md` | 脚本说明 |
| `docs/AI_AGENT_OPERATING_GUIDE.md` | Agent 规范 |
| `docs/DOCUMENTATION_STATUS.md` | 文档状态 |
| `src/core/system/*` | V1 系统闭环 |
| `src/core/prompts/*` | V1 提示词注册 |
| `src/core/modes/*` | V1 模式清单与工厂 |
| `src/core/modules/*` | V1 模块运行时 |
| `scripts/audit.mjs`, `check-docs.mjs`, `check.mjs`, `test.mjs`, `interface-audit.mjs` | 当前检查脚本 |

### active-compatibility

仍被当前系统使用的兼容层，保留但不作为主入口：

#### Engine bridge files

| 文件 | 引用者 | 说明 |
|------|--------|------|
| `src/core/engine/rpg.js` | `world-engine.js:10,22` | RPG_DM_INSTRUCTION + re-export as `rpg` |
| `src/core/engine/tabletop.js` | `world-engine.js:9,21` | TABLETOP_DM_INSTRUCTION + re-export as `tabletop` |
| `src/core/engine/sim.js` | `world-engine.js:11,23` | SIM_DM_INSTRUCTION + re-export as `sim` |
| `src/core/engine/murder-mystery.js` | `world-engine.js:12,24` | MURDER_MYSTERY_DM_INSTRUCTION + re-export as `murderMystery` |
| `src/core/engine/modules.js` | `world-engine.js:4` | ENGINE_VERSION, MODULES, MODULE_PRESETS, DEFAULT_ENGINE_STATE |
| `src/core/engine/lifecycle.js` | `world-engine.js:2,19` | prepareTurn, completeTurn |
| `src/core/engine/commands.js` | `world-engine.js:3,17` | classifyWorldTreeInput |
| `src/core/engine/context-engine.js` | `world-engine.js:13` | assembleContext |
| `src/core/engine/emotion-state.js` | `world-engine.js:8` | getEmotionProfile |
| `src/core/engine/world-telemetry.js` | `world-engine.js:15` | telemetryForLLM |
| `src/core/engine/director-modes.js` | `world-engine.js:14` | directorModePromptBlock |
| `src/core/engine/context-budget.js` | `world-engine.js:5` | budgetFor |
| `src/core/engine/output-parser.js` | `world-engine.js:18` | parseMarkedOutput, sectionsToOverlayPatch |
| `src/core/engine/storytellers.js` | `world-engine.js:25` | re-export as `storytellers` |

#### Data bridge files

| 文件 | 引用者 | 说明 |
|------|--------|------|
| `src/core/data/character-card.js` | `world-engine.js:6` | cardModeNarrativeHint, characterCardMode |
| `src/core/data/templates.js` | `world-engine.js:7` | presetSummary, styleInstruction |
| `src/core/data/alchemy/alchemy-engine.js` | `creation-alchemy.wrapper.js` | detectFormat — 供 creation-forge 使用 |
| `src/core/data/alchemy/digester.js` | self + wrapper | digest 管线 |

#### Server bridge files

| 文件 | 说明 |
|------|------|
| `src/server/module-service.js` | 旧模式初始化路径（world-rpg/tabletop/mystery/strategy/murder/creation-forge），已被新系统调用 |
| `src/server/data-import-service.js` | world-pack 导入导出服务 |
| `src/server/persistence-service.js` | 文件持久化服务 |
| `src/server/fs-utils.js` | 原子写入工具 |
| `src/server/path-security.js` | 路径安全 |

> **注意**: 这些文件已被新系统（V1 full-closure）调用。它们是 compatibility bridge，不是旧代码残留。不要删除。

### legacy-bridge

旧 API 路径被新系统桥接调用：

| 文件 | 说明 |
|------|------|
| `server.js` (world-pack routes) | `/api/world-pack/export`, `/api/world-pack/import` — 处理旧 .worldtree 格式 |
| `src/core/world-engine.js` | 旧引擎入口，桥接 engine/ + data/ 模块 |

> 这些是 active 的 legacy bridge。它们的 API 仍被使用，内部实现可能逐步收敛到新胶囊。

### archived-design

历史执行/设计记录，不代表当前能力：

| 文件 | 原用途 |
|------|--------|
| `docs/WORLD_TREE_QUICK_SETTING_SLICE.md` | quick-setting 初始设计 |
| `docs/WORLD_TREE_MODE_RUNTIME_CORE_P1.md` | mode runtime core P1 执行记录 |
| `docs/WORLD_TREE_MODE_STATE_SCHEMA_P1.md` | mode state schema P1 |
| `docs/WORLD_TREE_MODE_PROJECT_FACTORY_P1.md` | project factory P1 |
| `docs/WORLD_TREE_MODULE_RUNTIME_ORCHESTRATOR_P1.md` | orchestrator P1 |
| `docs/WORLD_TREE_MULTI_MODE_ENTRY_CLOSURE_P1.md` | multi-mode entry closure P1 |
| `docs/WORLD_TREE_LEGACY_MODULE_RECLASSIFICATION_P1.md` | legacy module reclassification |
| `docs/WORLD_TREE_LEGACY_MODULE_STANDARDIZATION_P1.md` | legacy module standardization |
| `docs/WORLD_TREE_PRE_FEATURE_READINESS_REPORT.md` | pre-feature readiness report |
| `docs/WORLD_TREE_EXISTING_MODULE_AUDIT.md` | existing module audit |
| `docs/WORLD_TREE_MODE_MODULE_ARCHITECTURE.md` | mode module architecture |
| `docs/World-Tree-开源发布执行计划书.md` | 开源发布执行计划 |

> 这些文档是项目历史的宝贵记录。它们描述了 V1 的构建过程，但当前能力以 `ARCHITECTURE_V1.md` 为准。

### superseded-reference

已被当前新文档覆盖，但仍有参考价值：

| 文件 | 当前替代 |
|------|----------|
| `docs/WORLD_TREE_CHARACTER_CAPSULE_FULL_V1.md` | `ARCHITECTURE_V1.md` + character mode |
| `docs/WORLD_TREE_LEGACY_ASSET_AUDIT_P1.md` | 本文档 (`LEGACY_REDUNDANCY_AUDIT.md`) |
| `docs/WORLD_TREE_LEGACY_ASSET_RENOVATION_PLAN_P1.md` | `LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md` |
| `docs/v0.3.0-baseline-audit.md` | 当前测试/文档状态 |
| `docs/context-engine-design-v1.md` | `ARCHITECTURE_V1.md` |
| `docs/memory-layers-design-v1.md` | `ARCHITECTURE_V1.md` |
| `docs/branch-director-health-plan-v1.md` | `ARCHITECTURE_V1.md` |
| `docs/content-system-design-v1.md` | `ARCHITECTURE_V1.md` |
| `docs/alchemy-station-design-v1.md` | creation-forge mode |
| `docs/codex-interface.md` | `AI-GUIDE.md` |

> 这些文件描述了历史设计方案。当前实现可能与原始设计有出入。查阅时以最新架构文档为准。

### orphan-candidate

当前未被引用、不是文档真相源、也不是测试夹具：

| 文件 | 说明 | 建议 |
|------|------|------|
| `scripts/generate-knowledge-cards.mjs` | 知识卡生成脚本，V1 中未使用 | 保留，可能在 creation-forge 中复用 |
| `src/core/data/` 中部分旧数据模型 | 如 cognition.js, prediction.js 等 — 当前未被 world-engine 或 V1 胶囊引用 | 保留作为参考/备用模型 |

> orphan-candidate **不删除**。它们是候选，后续由人工确认是否需要归档或复用。

### test-fixture

测试文件（`tests/unit/*`, `tests/integration/*`）：

全部保留。它们是 V1 回归保护的基础。其中 testing legacy bridge 的测试已标注在测试文件名或注释中。

## Files That Must Not Be Deleted

以下文件在 V1 中被活跃引用，**绝对不能删除**：

1. `src/core/engine/rpg.js`, `tabletop.js`, `sim.js`, `murder-mystery.js`
2. `src/core/engine/modules.js`
3. `src/core/engine/lifecycle.js`, `context-engine.js`
4. `src/core/data/alchemy/` 全目录
5. `src/core/data/character-card.js`, `templates.js`
6. `src/core/world-engine.js`
7. `src/server/module-service.js`, `data-import-service.js`
8. `server.js` (world-pack API routes)

## Upgrade Opportunities

1. **Old engine DM instruction files** (`rpg.js/tabletop.js/sim.js/murder-mystery.js`): 可逐步将 DM instruction 迁移到 `src/core/<mode>/` 下的新胶囊，但当前桥接稳定，不急。
2. **world-engine.js**: 作为旧引擎入口，可逐步将调用收敛到 `mode-runner.js`。
3. **alchemy → creation-forge**: alchemy 管道已通过 wrapper 桥接到 creation-forge，可评估是否需要更紧密整合。
4. **docs historical files**: 已在本文档和 DOCUMENTATION_STATUS 中标注状态，不需要额外处理。

## Recommendations

1. **不要删除任何文件**。
2. 旧 engine 文件加文件头注释标明 compatibility bridge 身份。
3. 历史执行文档在 DOCUMENTATION_STATUS 中标为 `archived-design`。
4. orphan-candidate 保留，后续版本评估是否归档。
5. 新增 `docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md` 作为升级路线图。
