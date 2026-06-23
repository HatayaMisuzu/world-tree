# AI Agent 详细操作规范

本文档是对根目录 AI-GUIDE.md 的详细补充。

## 修改流程

1. 先读取 README.md、docs/INDEX.md、AI-GUIDE.md，以及 **`docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`**（防遗失清单，确认不误删已有机制）
2. 定位相关 mode capsule 文档
3. 运行 git status --short 确认工作区干净
4. 定位真实源文件，不凭记忆改动
5. 修改最小必要文件（不要顺手重构）
6. 增加或更新对应测试
7. 运行目标测试直到全绿
8. 运行 npm run preflight
9. 报告：新增文件、修改文件、测试结果、风险、未做事项

## 测试策略

- 单元测试: npm run test:unit（每次修改后）
- 集成测试: npm run test:integration（发布前）
- 全量检查: npm run preflight（提交前）

## 文档更新策略

- 修改功能时必须同步更新对应文档
- 新增 API 时必须更新 docs/API_REFERENCE.md
- 新增模式时必须在 docs/INDEX.md 添加链接
- 新增/删除/迁移任何机制时必须同步更新 `docs/WORLD_TREE_ASSET_FUNCTION_MECHANISM_INVENTORY.md`

## 如何判断历史文档

- docs/archive/ 中的文件不代表当前能力
- 以 README.md、PROJECT_OVERVIEW.md、FEATURES.md、API_REFERENCE.md、ARCHITECTURE_V1.md 为准
- 如果旧文档与当前代码冲突，以代码为准并更新文档

## 完成报告格式

完成后必须报告:
- 任务名称
- 新增文件
- 修改文件
- 实现内容
- 明确未做
- 测试结果
- 风险
- 下一步建议

## P0-P2 Kernel 操作约束

Agent 应通过 `createKernelTurnContext()` 获取当前活动分支与 prompt-safe P0/P1/P2 sidecar，不自行拼接 branch 路径。遥测只能写自身 runtime 日志；Auto-light 每请求最多一个 beat；processing 只能投递 Growth Tree 或 proposal queue。任何 shared canon 修改必须创建并批准 proposal，critical 还需二次确认；reverse 也必须保持为待审提案。对外报告应明确区分"真实 turn 已接入""UI/API 可操作"和仍为内部 sidecar 的能力。

## 当前项目状态

- P0/P1/P2 Kernel: COMPLETE
- Prompt Orchestration Layer v1: COMPLETE
- P3 M1-M11 Legacy Mechanism Kernel: COMPLETE
- Asset Maturation Stage 0-4: COMPLETE
- Real Workflow Integration W0-W4: COMPLETE
- Service Deepening + HTTP Wiring: COMPLETE
- 下一步：真实游玩产品化

## 硬性规则

- 不得把 README 当作 AI 维护指南——维护信息在 docs/INDEX.md 和本文件。
- 不得暴露 prototype-hidden 或 declared-only 模块为用户可见功能。
- 普通 workflow 不得直接写 shared canon。写入必须走 proposal approved / initialization write / manual canon edit。
- 不得删除 asset inventory 或 status matrix 条目而不替换或注明迁移。
- 不得在未运行 preflight 的情况下报告完成，除非明确说明为何未运行。
- 不得混淆历史验证报告与当前真相源——以 docs/INDEX.md 为准。
