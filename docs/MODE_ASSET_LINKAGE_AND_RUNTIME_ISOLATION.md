# Mode Asset Linkage & Runtime Isolation

> World Tree 模式间资产联动与运行时隔离的显式契约。
> 在 Detective V2 实施之前冻结，防止未来模式间运行时混淆。

## 定义

### 资产联动 (Asset Linkage)

模式**可以**通过模块层引用其他模式或项目共用的资产。引用是只读快照或单向引用，不静默写入。

| 允许 | 示例 |
|------|------|
| 世界书条目引用 | Tabletop V2 run 引用世界书设定作为场景背景 |
| 角色资产引用 | Tabletop V2 run 引用角色资产作为 NPC/PC 表 |
| 规则集引用 | 多个模式共用同一规则集配置 |
| 时钟模板引用 | 冒险模组引用项目定义的时钟模板 |
| UI 组件复用 | 渲染辅助函数（卡片/面板/状态条）跨模式使用 |
| 架构模式复用 | 相同的 contract/normalizer/validator 模式 |

### 运行时隔离 (Runtime Isolation)

每个模式**必须**拥有独立的运行时命名空间。运行时对象不得跨模式存储。

| 禁止 | 说明 |
|------|------|
| 运行时状态混用 | Tabletop 状态不写入 Detective 运行时目录 |
| 缓存混用 | 每个 mode/run 独立缓存命名空间 |
| 存档/分支混用 | 每个 mode/run 独立存档和分支文件 |
| LLM 调用路径混用 | 每个模式独立 context builder/adapter |
| 隐藏数据泄漏 | GM 书/案件真相不跨模式不在共享日志中出现 |
| 调试日志混用 | 调试日志按 mode/run 命名空间隔离 |

### UI 复用与隔离

| 层 | 可共享/复用？ | 需隔离？ | 备注 |
|----|:---:|:---:|------|
| 模组资产引用 | ✅ | 不静默写入 | 只读/快照 |
| UI 渲染辅助函数 | ✅ | 状态/动作命名空间 | 不跨模式写状态 |
| 运行时状态 | ❌ | ✅ | 按 mode/run |
| 缓存 | ❌ | ✅ | 按 mode/run/context kind |
| 存档/分支 | ❌ | ✅ | 按 mode/run |
| LLM 调用路径 | ❌ | ✅ | 按 mode adapter/context builder |
| 隐藏 GM/案件数据 | ❌ | ✅ | 永不泄漏给玩家/共享日志 |

## 运行时命名空间约定

```text
engine/tabletop-v2/runs/<runId>/run-state.json
engine/tabletop-v2/runs/<runId>/saves/<saveId>.json
engine/tabletop-v2/runs/<runId>/branches/<branchId>.json
engine/tabletop-v2/cache/<runId>/...

engine/detective-v2/runs/<runId>/...
engine/detective-v2/cases/<caseId>/...
```

## Tabletop V2 当前状态

- 模组契约包含 `worldbookRefs`、`characterRefs`、`assetLinks` 等资产引用字段
- 服务层已独立于通用聊天 LLM 路径（使用确定性裁决文本）
- 运行时数据存储在 `engine/tabletop-v2/` 下
- UI 状态在 `AS.tabletopV2` 下，动作前缀 `tabletop-v2-`
- UI 面板和 API wrapper 已存在

## Detective V2 未来指南

- 必须复用本资产联动契约
- 必须使用 `detective-v2` 运行时命名空间
- 可引用世界书/角色资产
- 不可使用 tabletop-v2 的 runs/saves/cache/LLM context
- 不可将案件笔记存入 Tabletop V2 状态
- 必须保持 Truth Ledger 隐藏、玩家笔记本公开
- 实现前应冻结本契约并运行全部审计

## 不可破坏的不变量

1. 任何模式运行时不得调用另一模式的运行时服务
2. 共享代码仅限纯函数、无状态工具、或显式以 modeId/runId 为命名空间的函数
3. UI 状态和动作处理器必须按模式作用域隔离
4. 通用辅助函数必须接收显式 `modeId`/`runtimeNamespace` 参数，不得从全局可变状态推断模式
5. 新增模式必须在本契约中注册其命名空间和隔离策略
