# Tabletop V2 运行态与资产隔离

## 核心原则

Tabletop V2 运行态与 Detective V2 / Character V2 完全隔离。

## 命名空间

每次 run 创建独立的命名空间：
- `engine/tabletop-v2/modules/{moduleId}/` — 模组持久化
- `engine/tabletop-v2/runs/{runId}/` — 运行态
- `engine/tabletop-v2/runs/{runId}/saves/` — 存档槽
- `engine/tabletop-v2/runs/{runId}/branches/` — 分支

## 资产引用规则

- worldbook / character / ruleset / randomTable 引用均为**只读快照**
- 运行态变更写入 Tabletop run state，**不写回源资产**
- 角色卡作为 NPC/PC 引用时，创建快照，不共享 Character V2 的 live memory/relationship
- GM hidden notes 不写回 worldbook

## 缓存与 LLM 隔离

- cache namespace: `tabletop-v2:{moduleId}:{runId}:cache`
- save namespace: `tabletop-v2:{moduleId}:{runId}:save`
- branch namespace: `tabletop-v2:{moduleId}:{runId}:branch`
- llm namespace: `tabletop-v2:{moduleId}:{runId}:llm`

## 安全扫描

每回合 GM 循环包含 hidden leak scanner：
- 检查叙事文本是否包含 gmBook.hiddenTruth
- 检查是否泄露隐藏时钟标签
- 检查是否泄露 NPC 秘密
- 发现泄露自动替换为 `【已隐藏】`
