# 上下文引擎 · 架构设计 v1

> 定位：统一的世界上下文组装流水线，替代原有的三个独立 buildXxxPacket。

## 整体架构

```
assembleContext(model, options)
  │
  ├─ ① Context Router (定向查表)
  │   场景帧 → 场景+位置+角色 → 查索引表 → 返回相关场景/角色/位置
  │
  ├─ ② Context Indexer (全文搜索)
  │   用户输入 → 加权检索(角色/组织/场景/世界书) → 5机制降噪 → 聚类
  │
  ├─ ③ Context Assembler (合并排序)
  │   Router结果 + Indexer结果 → 去重 → 按优先级/相关性排序 → 格式化为 blocks
  │
  └─ ④ Mode Strategy (模式策略)
       worldbook / character_card / preset → 控制各组件启闭 + token 预算
```

## 组件详解

### ① Context Router (`context-router.js`)

| 能力 | 说明 |
|------|------|
| **场景帧构建** | 从模型数据提取当前场景、位置、活动角色 |
| **定向路由** | 场景→索引表查询：场景涉及的地点×角色×组织 |
| **输出** | 结构化的上下文块（场景描述、相关角色摘要、位置信息） |

### ② Context Indexer (`context-indexer.js`)

| 能力 | 说明 |
|------|------|
| **全文索搜** | 加权字段检索（角色名权重 > 背景文本） |
| **五机制降噪** | 关键词密度 / 位置 / 长度 / 重叠度 / 时效性 |
| **K-Means 聚类** | 将相关条目聚类成主题，避免碎片化注入 |
| **输出** | 排序+聚类后的相关条目列表 |

### ③ Context Assembler (`context-assembler.js`)

| 能力 | 说明 |
|------|------|
| **合并去重** | Router 和 Indexer 结果去重（按 ID/内容哈希） |
| **优先级排序** | L1 短期记忆 > L2 角色记忆 > L3 场景帧 > L4 全文匹配 |
| **Token 预算** | 受 budgetFor() 控制，超出时裁剪低优先级块 |
| **输出** | 格式化的 Prompt blocks |

## 模式策略

| dataMode | Router | Indexer | 预算 | 世界状态 | 角色记忆 | 时间线 |
|:--------:|:------:|:-------:|:----:|:--------:|:--------:|:-----:|
| worldbook | ✅ | ✅ | 4000t | ✅ | ✅ | ✅ |
| character_card | ✅(限角色) | ❌ | 1500t | ❌ | ✅ | ❌ |
| preset | ✅ | ✅ | 2500t | ✅ | ❌ | ❌ |

## 与 Director 层的关系

```
prepareTurn
  → 情绪更新 → 记忆检索 → 节奏分析 → 事件评分
  → assembleContext()  ← 上下文引擎在此注入
  → Director 生成方向包
  → Story Writer (LLM)
```

> v1.0.0 实现：三模式策略 + 完整路由/索引/合并管线。  
> vNext：向量检索集成、增量索引更新、跨会话上下文持久化。
