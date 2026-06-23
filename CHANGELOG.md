# World Tree · CHANGELOG

> 面向维护者、用户和 AI agent 的变更记录。
> 当前能力以最新 Unreleased / V1 里程碑为准。

## Unreleased / V1 Closure

**最新提交**: 0ed95c9

### Added
- V1 完整闭环系统: route index, prompt registry, mode input/output packets, isolation policy, proposal bus, save system, mode runner (src/core/system/, src/core/prompts/)
- 系统闭环测试 31 项 (tests/unit/system-closure.test.js)
- 炼金台 V1 (creation-forge): 输入理解/目标检测/追问/蓝图/资产契约/校验/实例化/导出
- 四入口 V1: tabletop, mystery-puzzle, strategy-sim, murder-mystery (各 3 files + 集成测试)
- 大世界模式 V1 完成与加固: Grand World adapter, turn planner, state, objectives
- 世界书基础层 V1: schema/normalizer/validator/context-activator/packet/proposal (10 files)
- 旧资产盘点与翻新合并计划: 44 模块 5 分类
- Character Capsule V1: parser/profile/prompt/lore/persona/module-integration/OOC/adapter/exporter
- Pre-Feature Architecture Completion: factory wiring, P2-A wrappers, reclassification
- Core Architecture: Mode Runtime Core, Module Runtime Orchestrator, State Schema, Project Factory

### Changed
- World Tree 从旧本地 AI 叙事控制台重定义为本地优先多模式叙事与创作工作台
- package version = 0.3.0, 功能里程碑 = V1 完整闭环
- creation-forge: producer/factory 模式，非普通玩法入口
- world-rpg: 世界书大世界模式，非传统 RPG
- 文档体系重写: README, CHANGELOG, AI-GUIDE, 14+ docs/ 文件

### Safety / Boundaries
- shared 文件是项目真相源，AI 生成变更必须走 proposal gate
- hidden facts (truthLock, answerLock) 不得进入玩家可见上下文
- 跨模式缓存写隔离: 每个模式只能写自己的 runtime/cache
- creation-forge 实例化必须用户确认

### Known Limits
- V1 本地优先、单人用户导向
- 不做多人房间、市场、插件生态、向量检索、高级可视化编辑器
- 不做 V2 深玩法 (完整 DND、4X、多角色群聊、长期记忆等)
