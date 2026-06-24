# 文档状态表

## 当前真相源

| 文件 | 状态 | 对象 | 真相源 | 备注 |
| --- | --- | --- | --- | --- |
| README.md | current | 用户/开发者 | 是 | 主入口 |
| CHANGELOG.md | current | 维护者/AI | 是 | V1 closure + test debt cleanup 已记录 |
| AI-GUIDE.md | current | AI agent | 是 | Workflow HTTP Baseline + Service Deepening Complete |
| docs/INDEX.md | current | 所有人 | 是 | 按受众分类的文档路由器 |
| docs/CURRENT_PROJECT_STATE.md | current | 所有人/AI 优先 | 是 | **真相源第一优先级** |
| docs/ROADMAP_CANDIDATES.md | current | 维护者/AI | 否 | 候选建议，不代表已实现 |
| docs/WORKFLOW_SERVICE_DEEPENING_REPORT.md | current | 维护者/AI | 是 | Service Deepening 完成验证 |
| docs/PROJECT_OVERVIEW.md | current | 所有人 | 是 | 项目全景 |
| docs/FEATURES.md | current | 用户/开发者 | 是 | 功能清单 |
| docs/ARCHITECTURE_V1.md | current | 开发者/AI | 是 | 架构说明 |
| docs/API_REFERENCE.md | current | 开发者 | 是 | API 文档 |
| docs/SAVE_SYSTEM_AND_WORLD_PACK.md | current | 开发者 | 是 | 存档系统；export bridge 标注为 partial |
| docs/PROPOSAL_AND_REVIEW_SYSTEM.md | current | 开发者 | 是 | 提案系统 |
| docs/MODE_ROUTING_AND_CAPSULES.md | current | 开发者 | 是 | 路由与胶囊 |
| docs/MODE_PROMPTS_AND_PACKETS.md | current | 开发者/AI | 是 | 提示词与数据包 |
| docs/SCRIPTS_AND_CHECKS.md | current | 开发者 | 是 | 脚本说明 |
| docs/AI_AGENT_OPERATING_GUIDE.md | current | AI agent | 是 | Agent 操作规范 |
| docs/DOCUMENTATION_STATUS.md | current | 维护者 | 是 | 本文档 |

## Legacy / Compatibility

| 文件 | 状态 | 当前真相源 | 替代文档 | 备注 |
| --- | --- | --- | --- | --- |
| docs/LEGACY_REDUNDANCY_AUDIT.md | current | 是 | — | Legacy 资产审计（本任务新建） |
| docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md | current | 是 | — | 兼容与升级计划（本任务新建） |
| src/core/engine/rpg.js | active-compatibility | 否 | src/core/grand-world/ | DM instruction bridge, world-engine 引用 |
| src/core/engine/tabletop.js | active-compatibility | 否 | src/core/tabletop/ | DM instruction bridge, world-engine 引用 |
| src/core/engine/sim.js | active-compatibility | 否 | src/core/strategy-sim/ | DM instruction bridge, world-engine 引用 |
| src/core/engine/murder-mystery.js | active-compatibility | 否 | src/core/murder-mystery/ | DM instruction bridge, world-engine 引用 |
| src/core/engine/modules.js | active-compatibility | 否 | — | 旧引擎注册表, world-engine 引用 |
| src/core/data/alchemy/ | active-compatibility | 否 | src/core/creation-forge/ | 通过 wrapper 桥接到 creation-forge |
| src/core/data/character-card.js | active-compatibility | 否 | src/core/character/ | world-engine 引用 |
| src/core/world-engine.js | legacy-bridge | 否 | src/core/system/mode-runner.js | 旧引擎入口，桥接 engine/data 模块 |
| server.js (world-pack API) | legacy-bridge | 否 | src/core/system/world-tree-save-system.js | 旧 import/export API |
| src/server/module-service.js | active-compatibility | 否 | — | 模式初始化服务 |
| src/server/data-import-service.js | legacy-bridge | 否 | — | 数据导入服务 |
| docs/archive/p1-reports/ (~14 个) | archived-design | 否 | docs/ARCHITECTURE_V1.md | 历史 P1 执行记录，Stage 5B 已归档 |
| docs/archive/p1-reports/WORLD_TREE_LEGACY_ASSET_AUDIT_P1.md | superseded-reference | 否 | docs/LEGACY_REDUNDANCY_AUDIT.md | 旧审计已被新审计替代，已归档 |
| docs/archive/p1-reports/WORLD_TREE_LEGACY_ASSET_RENOVATION_PLAN_P1.md | superseded-reference | 否 | docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md | 旧计划已被新计划替代，已归档 |
| docs/v0.3.0-baseline-audit.md | superseded-reference | 否 | — | 历史基线审计 |
| docs/context-engine-design-v1.md | superseded-reference | 否 | docs/ARCHITECTURE_V1.md | 旧设计文档 |
| docs/memory-layers-design-v1.md | superseded-reference | 否 | docs/ARCHITECTURE_V1.md | 旧设计文档 |
| docs/alchemy-station-design-v1.md | superseded-reference | 否 | docs/ARCHITECTURE_V1.md | 旧设计文档 |
| scripts/generate-knowledge-cards.mjs | orphan-candidate | 否 | — | 未被引用，可保留备用 |
| docs/archive/ | archived | — | — | 历史执行/设计记录 |

**状态枚举**: `current` | `active-compatibility` | `legacy-bridge` | `archived-design` | `superseded-reference` | `test-fixture` | `orphan-candidate`

## 测试状态 (2026-06-23)

| 套件 | 结果 | 备注 |
| --- | --- | --- |
| test:unit | 399 PASS, 0 FAIL | 全绿 |
| test:integration | 72 PASS, 0 FAIL | 全绿 |
| docs:check | 24 checks, 0 failures | 全绿 |
| preflight | 0 错误 | 全绿 |

## 已知 partial 能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| exportWorldTreeSave | partial (snapshot_bridge) | 轻量快照桥接；完整 .worldtree 打包由旧 world-pack API 承担 |
| importWorldTreeSave | partial (bridge) | 参见 world-pack import handler |
