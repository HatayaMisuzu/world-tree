# 文档状态表

| 文件 | 状态 | 对象 | 真相源 | 备注 |
| --- | --- | --- | --- | --- |
| README.md | current | 用户/开发者 | 是 | 主入口 |
| CHANGELOG.md | current | 维护者/AI | 是 | V1 closure + test debt cleanup 已记录 |
| AI-GUIDE.md | current | AI agent | 是 | V1 full-closure |
| docs/INDEX.md | current | 所有人 | 是 | 导航 |
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
| docs/archive/ | archived | — | 否 | 历史执行/设计记录 |

## 测试状态 (2026-06-23)

| 套件 | 结果 | 备注 |
| --- | --- | --- |
| test:unit | 399 PASS, 0 FAIL | 全绿 — 旧语法错误+断言过期已修复 |
| test:integration | 72 PASS, 0 FAIL | 全绿 — 旧 create/import/roundtrip 已修复 |
| docs:check | 24 checks, 0 failures | 全绿 |
| preflight | 0 错误 | 全绿 — README/AI-GUIDE/CHANGELOG 版本已同步 |

## 已知 partial 能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| exportWorldTreeSave | partial (snapshot_bridge) | 轻量快照桥接；完整 .worldtree 打包由旧 world-pack API 承担 |
| importWorldTreeSave | partial (bridge) | 参见 world-pack import handler |
