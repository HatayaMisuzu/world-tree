# Detective V2 Module Asset & Runtime Isolation

> Detective V2 与现有模式（Tabletop V2、Character V2）的联动与隔离契约。

## 允许复用（资产层）

| 复用类型 | 说明 | 约束 |
|----------|------|------|
| 世界书条目引用 | 案件引用世界书地点/历史作为场景背景 | 只读引用，不静默写入 |
| 角色胶囊引用 | 证人/嫌疑人引用 Character Capsule 的口吻/人物 | 只读快照 |
| 地点资产引用 | 案件复用项目地点资产 | 不写入案件独有内容到地点资产 |
| 文档资产引用 | 引用报纸/档案等文档资产 | 只读 |
| UI 组件模式复用 | 卡片/抽屉/笔记本面板的渲染模式 | 状态隔离 |
| 导出配置复用 | 通用导出框架的模式 | 内容隔离 |

## 禁止混用（运行时）

| 禁用的混用 | 说明 |
|-----------|------|
| 运行状态 | Detective run 不存入 tabletop-v2/runs，反之亦然 |
| 缓存 | 独立 `detective-v2` 缓存命名空间 |
| 存档槽 | 独立 `detective-v2` 存档 |
| 分支状态 | 独立 `detective-v2` 分支 |
| LLM 调用路径 | 独立 context builder，不复用 Tabletop GM context |
| 隐藏状态 | Truth Ledger 不写入 Worldbook 或共享日志 |
| 调试日志 | 按 `detective-v2` 命名空间隔离 |
| Character V2 live runtime | 案件证据发现不写入 Character V2 live |

## 命名空间约定

```text
engine/detective-v2/cases/<caseId>/case.json
engine/detective-v2/runs/<runId>/run-state.json
engine/detective-v2/runs/<runId>/saves/<saveId>.json
engine/detective-v2/runs/<runId>/branches/<branchId>.json
engine/detective-v2/cache/<runId>/...
```

## 运行时隔离元数据

每个 Detective V2 运行必须携带：

```js
runtimeIsolation: {
  mode: "detective",
  runNamespace: "detective-v2",
  cacheNamespace: "detective-v2",
  saveNamespace: "detective-v2",
  branchNamespace: "detective-v2",
  llmContextNamespace: "detective-v2",
  hiddenStateNamespace: "detective-v2"
}
```

禁止任何命名空间包含 `tabletop-v2`、`character-v2-live`、`worldbook-runtime`。
