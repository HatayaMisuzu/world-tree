# 五层记忆体系 · 架构设计 v1

> 定位：global-memory.js（快照层）之上的结构化记忆分层管理，提供检索优先级和持久化策略。

## 五层架构

```
L1 短期记忆 (STM)
  └─ 最近对话轮次上下文集。每轮自动轮转，maxEntries=10。
  └─ 持久化：不持久（仅运行时）。
  └─ 字段: round, userInput, narrativeSummary, keywords, emotion

L2 会话记忆 (Session)
  └─ 本次冒险重要内容，跨场景保留。
  └─ 子集: keyEvents / decisions / discoveries
  └─ 持久化：会话级（世界会话周期）。

L3 角色记忆 (Character)
  └─ 某角色知道什么/不知道什么（认知边界模拟）。
  └─ 子集: known / suspected / unknown / misconceptions / secrets
  └─ 持久化：按角色文件（per-character.json）。

L4 世界记忆 (World)
  └─ 已成为世界事实的内容（canon）。
  └─ 字段: fact, source, confidence, category
  └─ 持久化：世界级（world-canon.json）。

L5 玩家记忆 (Player)
  └─ 用户偏好/选择风格/行为模式。
  └─ 子集: preferences / choices / patterns
  └─ 持久化：跨会话（player-profile.json）。
```

## 检索优先级

```
L1 (STM) > L2 (Session) > L3 (Character) > L4 (World) > L5 (Player)

说明：
- 输入匹配时，优先从 L1 找最近上下文
- L1/L2 命中 → 直接注入 prompt
- L3/L4 命中 → 经 Global Memory 快照系统去重
- L5 仅在生成方向包时参考
```

## 与 global-memory.js 的关系

```
global-memory.js (v0.9.0)
  └─ 快照系统：每轮创建 [_why + _provenance] 可解释快照
  └─ 检索系统：关键词 + 情绪 + 时效 + 因果链加分
  └─ 提供 createMemorySnapshot / searchMemorySnapshots

memory-layers.js (v1)
  └─ 分层管理：在快照之上增加层级路由
  └─ 跨层检索：从 L1 开始逐层向下搜，直到找到足够匹配
  └─ 认知边界：L3 限制某角色能"知道"什么（防 LLM 全知）
```

## 关键接口

```js
// 写入
pushSTM(round, input, narrative, emotion)    // L1 追加
pushSessionEvent(type, summary, importance)  // L2 记录
setCharacterKnowledge(name, known, unknown)  // L3 设认知边界
confirmWorldFact(fact, source)               // L4 确认事实
recordPlayerChoice(choice, context)          // L5 记录选择

// 检索
searchAll(text, emotion, depth)    // 从 L1 向下搜到指定层
getContextWindow(rounds)           // 取最近 N 轮 L1
getCharacterKnowledge(name)        // 取某角色 L3 认知边界

// 持久化
saveToDisk(worldName)   // 将 L2-L5 写入世界文件夹
loadFromDisk(worldName) // 从世界文件夹恢复 L2-L5
```

> v1.0.0 实现：五层数据结构 + 基础写入/检索接口 + L1 自动轮转。  
> vNext：认知边界自动推断（从叙事文本提取角色"不知道"什么）、L5 行为模式学习。
