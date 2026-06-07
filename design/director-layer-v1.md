# Director Layer v1 — 叙事导演层设计

## 问题

当前事件系统 `random-events.js` 纯用 `Math.random()` 决定事件：
- 核心剧情和路边小花絮用同一套随机机制
- 没有考虑玩家情绪状态
- 没有"叙事节奏"概念——重要时刻不该被随机事件打断

## 方案：三层决策链

```
用户输入
    ↓
prepareTurn
    ↓
┌─────────────────────────────────────┐
│          Director 层 (new)           │
│                                     │
│  1. 情绪状态机 ← 更新玩家情绪维度      │
│     (engagement / tension /          │
│      fatigue / curiosity)            │
│                                     │
│  2. 叙事需求评估                      │
│     → 当前是高潮还是过渡？             │
│     → 核心环是否紧张？                │
│     → 上次事件过去了多久？             │
│                                     │
│  3. 事件评分 vs 随机判定              │
│     → 核心剧情/情绪触发 → 计分制       │
│     → 环境小调剂/气氛 → 概率制         │
│     → 综合得分=eventScore决定是否触发   │
│                                     │
│  4. 节奏控制                          │
│     → 紧张时不插入打断型随机事件        │
│     → 疲劳/低好奇 → 触发新线索         │
│                                     │
└─────────────────────────────────────┘
    ↓
buildEnginePacket (注入情绪/节奏指令到 prompt)
    ↓
LLM 输出（可含【情绪】标记段）
    ↓
completeTurn (解析标记段，回写情绪状态)
```

## 模块拆分

### a) `src/core/engine/emotion-state.js` — 情绪状态机

```
玩家情绪维度（0-10）：
  engagement  投入度  — 沉浸/出戏
  tension     紧张度  — 放松/紧绷
  fatigue     疲劳度  — 精力/疲倦  
  curiosity   好奇心  — 满足/饥渴

updateEmotion(input, response, prevState) → newState
  - 输入长度↑ → engagement↑ （主动参与者）
  - 输入含紧张信号 → tension↑
  - 连续轮数↑ → fatigue↑
  - 输入含疑问 → curiosity↑
  - 括号事件 → curiosity↓, engagement↑
  
getEmotionProfile(state) → {dominant, signals, advice}
  - 返回此刻的主要情绪特征和建议动作
```

### b) `src/core/engine/director.js` — 导演调度层

```
calculateEventScore(context) → {score, reason, type}
  输入：proximityEntities, emotionState, round, plotState
  因子：角色在场数 × 情绪张力 × 叙事阶段 × 上次事件冷却
  输出：score 0-100, 类别(core/ambient/both)

shouldTriggerEvent(score, context) → {trigger, method, event}
  - score > 75 → 判断模式(直接触发)
  - score 40-75 → 概率模式(weight = score/100)
  - score < 40 → 不触发(除非环境需求)

analyzePacing(emotionState, round) → {tempo, advice}
  - 检测节奏是否过紧/过松
```

### c) 修改 `random-events.js` — 保留概率部分

```
- 保留 generateLightDiversion() 概率制（气氛用）
- 删除 proposeRandomEvent() 中的纯随机判定
- 改为 Director 层调用 eventScore 后决定是否触发
- 单文件无外部依赖
```

### d) 修改 `lifecycle.js` — 集成 Director

```
prepareTurn 后插入 Director 评估
  → 情绪更新 → 叙事需求分析 → 事件评分 → 节奏建议

completeTurn 中解析 LLM 的【情绪】标记段
  → 反馈到情绪状态机
```

### e) 修改 `world-engine.js` — 注入情绪指令

```
在 prompt 中加入：
- 当前玩家情绪状态（LLM 可见）
- 叙事节奏指令
- 允许 LLM 输出【情绪】标记来反馈/调整
```

## 实施顺序

1. ✅ `emotion-state.js` — 情绪状态机（独立，无依赖）
2. ✅ `director.js` — 导演调度层（依赖 emotion-state + random-events）
3. ✅ 修改 `random-events.js` — 分离概率/判断
4. ✅ 修改 `lifecycle.js` — 集成Director
5. ✅ 修改 `world-engine.js` — 注入情绪/节奏
6. ✅ `director.js` — 事件预测缓存（cacheEventPrediction / checkEventCache / 边界分自动缓存）
7. ✅ `character-card.js` — 情绪响应梯度（parseEmotionalGradients / selectEmotionalGradient）
8. 🔲 模拟运行模式（⑤）
9. ✅ `global-memory.js` — 全局记忆快照（createMemorySnapshot / searchMemorySnapshots + lifecycle集成）

## 事件预测缓存设计

```
directNarrative 每轮流程：
  情绪更新 → 节奏分析
     ↓
  ┌─ 检查缓存(checkEventCache) ──→ 有可升级事件 → 直接触发(cache_promotion)
  │
  ├─ 节奏阻止(pacing.blockNewEvents) → 评分 → 边缘分(20-50)→存缓存
  │
  └─ 正常评估 → shouldTriggerEvent
       ├─ 触发 → 正常输出
       └─ 未触发 → 边缘分(20-50)→ 存缓存 → 后续轮次自然冒泡

缓存升级条件：
  - 等待轮次给予加成: effectiveScore = score + min(15, waitRounds × 3)
  - effectiveScore >= 50 → 直接触发
  - effectiveScore >= 35 + 场景变化 → 触发
  - 缓存有效期: 8轮，超时自动过期
  - 最大缓存: 5个 pending 事件，超限淘汰最旧
  - 条件恶化检测：核心事件但场景无人 → 标记 stale 但不触发
```
