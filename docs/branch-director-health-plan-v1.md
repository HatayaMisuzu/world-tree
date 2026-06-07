# 枝干系统 + 叙事导演 + 世界健康度 · 实施计划 v1

> 三个功能互相咬合——叙事导演决定事件走向 → 事件走向产生分支 → 分支影响世界健康度 → 健康度反作用于导演决策。

---

## 一、枝干系统

### 1.1 现状评估

| 已有能力 | 缺失能力 |
|---------|---------|
| `world:copy` / `world:branch` IPC — 深拷贝创建分支 | 无分支树可视化数据结构 |
| `timeline-tree.json` — 分支元数据存储 | 无"嫁接"(merge branch)能力 |
| `world-manager.js` — 世界文件夹管理 | 无"枯枝"(abandon)标记和管理 |
| `archive-state.js` — 存档快照 | 无分支差异对比 |
| | 无主线/支线/枯枝/嫁接四态管理 |
| | UI 层无分支树可视化 |

### 1.2 设计

#### 1.2.1 四态分支模型

```
主干 (trunk)
  ├── 分支 A (branch)        ← 用户选择产生的分歧
  │   ├── 分支 A-1 (branch)  ← 子分支
  │   └── [嫁接回主干]       ← 合并
  ├── 分支 B (branch)
  │   └── ✗ 枯枝 (dead)      ← 废弃路线
  └── 分支 C (branch)
      └── ✓ 收束 (merged)    ← 已合并回主线
```

#### 1.2.2 新增数据文件

```
branches/<branch>/
├── runtime.json          ← 已有
├── canon_state.json      ← 已有
└── branch-meta.json      ← 新增：分支元数据
    {
      "branchId": "main",
      "parentBranch": null,
      "createdFrom": null,          // 从哪个事件分叉
      "createdAtRound": 0,
      "status": "active",           // active | dead | merged
      "label": "主线",
      "description": "",
      "divergeEvent": null,         // 分叉事件 ID
      "mergeTarget": null,          // 合并目标分支
      "mergeEvent": null,           // 合并事件 ID
      "lastPlayedAt": null,
      "playCount": 0,
      "tags": []
    }
```

#### 1.2.3 新增模块：`src/core/engine/branch-system.js`

```
核心 API:
  createBranch(worldName, label, divergeEvent)
    → 深拷贝当前分支 → 新分支文件夹 → 写入 branch-meta.json

  mergeBranch(sourceBranch, targetBranch, mergeEvent)
    → 将 source 的 canon 差异合并到 target
    → 标记 source 为 "merged"
    → 产生 merge commit 记录

  abandonBranch(branchId, reason)
    → 标记分支为 "dead"
    → 保留数据不删除（可复活）

  compareBranches(branchA, branchB)
    → 对比两个分支的 canon_state / characters / timeline 差异
    → 返回 { added: [], removed: [], modified: [] }

  getBranchTree(worldName)
    → 返回完整分支树结构 { trunk, branches: [{ id, parent, status, children }] }

  getActiveBranches(worldName)
    → 返回所有非 dead/merged 分支

  getPlayableBranches(worldName)
    → 返回 active + 最近玩的 dead 分支（可复活）
```

#### 1.2.4 嫁接（merge）机制

嫁接不是简单文件覆盖，而是**差异化合并**：

```
源分支 canon_state.diff(目标分支 canon_state)
  ↓
生成 merge proposal 列表：
  - 新增角色 "张三" → 目标分支没有 → 提案: 新增
  - 角色 "艾琳" status 不同 → 提案: 更新（展示差异）
  - 事件 "X" 仅在源分支 → 提案: 同步
  ↓
用户逐项确认（复用炼金台的 proposal 确认模式）
  ↓
写入目标分支 + 记录 merge commit
```

#### 1.2.5 实施步骤

| 步骤 | 内容 | 文件 |
|:---:|------|------|
| 1 | `branch-meta.json` 格式定义 | 新建 |
| 2 | `branch-system.js` 核心逻辑 | 新建 `engine/branch-system.js` |
| 3 | `world-manager.js` 集成 — `world:branch` 升级 | 修改 |
| 4 | 分支差异对比引擎 | `branch-system.js` 内 |
| 5 | 嫁接合并引擎 | `branch-system.js` 内 |
| 6 | IPC 通道：`branch:tree` / `branch:merge` / `branch:abandon` / `branch:compare` | main.cjs + preload.cjs |
| 7 | 集成测试 | 新建 |

---

## 二、叙事导演模式

### 2.1 现状评估

| 已有能力 | 缺失能力 |
|---------|---------|
| 8 种叙事者预设 + 事件评分修正器 | 仅影响事件频率/压力，不影响检索策略 |
| 疲劳保护硬截断 | 不改变 LLM prompt 结构 |
| `director.js` 的事件评分/缓存/节奏 | 不改变上下文注入策略 |
| UI 选择器 | 仅切换配置参数 |

**当前 storyteller 只是配置参数集合，不是"模式"。**

### 2.2 设计

#### 2.2.1 导演模式 vs 叙事者风格

```
叙事者风格 (storyteller) — 已有，继续维护
  → 控制事件调度: frequency / pressure / randomness / fatigue
  → 8 种预设，可自定义参数

导演模式 (directorMode) — 新增
  → 控制全局叙事行为: 检索策略 / 上下文注入 / 输出格式 / 风险控制
  → 6 种模式，每种是完整的行为配置
```

| 导演模式 | 检索策略 | 上下文注入 | 风险控制 | 输出格式 | 适用场景 |
|---------|---------|-----------|---------|---------|---------|
| **轻小说** | 关系优先 | 角色对话历史权重高 | 宽松 | 自然段+对话 | 角色卡、日常 |
| **跑团 DM** | 规则优先 | 规则+状态面板 | 严格 | 旁白+骰子 | TRPG |
| **黑暗奇幻** | 冲突优先 | 危险+代价突出 | 硬约束 | 氛围描写 | 末日、黑暗 |
| **治愈日常** | 情绪优先 | 忽略冲突线索 | 零压力 | 温暖细腻 | 日常、治愈 |
| **悬疑调查** | 线索优先 | 线索链+矛盾 | 线索一致性 | 细节+留白 | 推理、调查 |
| **战争史诗** | 阵营优先 | 势力+战力注入 | 战力体系 | 宏大叙事 | 战争、政治 |
| **沙盒模拟** | 全量均衡 | 全部模块注入 | 无约束 | 自由格式 | 开放世界 |

#### 2.2.2 每个模式的配置维度

```js
{
  id: "light_novel",
  name: "轻小说",
  // ① 上下文注入策略
  contextStrategy: {
    relationWeight: 0.8,       // 关系信息权重
    ruleWeight: 0.2,           // 规则信息权重
    conflictWeight: 0.3,       // 冲突信息权重
    worldStateWeight: 0.5,     // 世界状态权重
    maxWorldbookEntries: 3,    // 最多注入条目数
    preferRecentMemory: true   // 优先近期记忆
  },
  // ② LLM prompt 模板
  promptTemplate: {
    systemPrefix: "你是一个轻小说风格的叙事者...",
    outputFormat: "自然段落，角色对话用「」包裹",
    forbiddenPatterns: ["旁白:", "[系统]", "★提案"],
    toneHints: ["轻松", "角色互动优先", "适度幽默"]
  },
  // ③ 风险控制
  riskControl: {
    maxPressurePerScene: 0.5,
    minRestWindow: 3,          // 至少 3 轮喘息
    forbidCharacterDeath: true,
    forbidWorldDestruction: true,
    autoResolveConflict: true  // 自动化解严重冲突
  },
  // ④ 事件生成策略
  eventStrategy: {
    preferredTypes: ["relation", "slice_of_life", "humor"],
    avoidedTypes: ["catastrophe", "war", "death"],
    eventFrequency: 0.3,
    maxEventIntensity: "moderate"
  },
  // ⑤ 兼容的叙事者风格（可叠加）
  compatibleStorytellers: ["gentle", "intimate", "classic"]
}
```

#### 2.2.3 与 storytellers 的关系

```
用户选择:
  导演模式: "悬疑调查"
  叙事者风格: "悬疑织网者"
    ↓
合并策略: 导演模式定义结构性约束 (检索/注入/格式)
         叙事者风格定义调度参数 (频率/压力/随机)
         冲突时 → 导演模式优先
    ↓
生成最终配置 → director.js 使用
```

#### 2.2.4 实施步骤

| 步骤 | 内容 | 文件 |
|:---:|------|------|
| 1 | 6 种导演模式配置定义 | 新建 `engine/director-modes.js` |
| 2 | 模式配置合并引擎（director mode + storyteller → 最终配置） | `director-modes.js` 内 |
| 3 | `world-engine.js` 集成 — buildWorldbookPacket 按模式调整注入 | 修改 |
| 4 | `director.js` 集成 — 按模式调整事件生成策略 | 修改 |
| 5 | `lifecycle.js` 集成 — prepareTurn 按模式调整上下文 | 修改 |
| 6 | IPC 通道：`director:modes` / `director:setMode` | main.cjs + preload.cjs |
| 7 | 集成测试 | 新建 |

---

## 三、世界健康度

### 3.1 现状评估

| 已有能力 | 缺失能力 |
|---------|---------|
| `world-state.js` v2 — 八维状态面板 | 无数值评分系统 |
| `emotion-state.js` — 情绪追踪 | 无跨维度综合评分 |
| `guardian.js` — 规则/一致性检查 | 无健康度趋势图 |
| `global-memory.js` — 叙事记忆快照 | 无评分历史 |

### 3.2 设计

#### 3.2.1 七维评分模型

```
世界健康度 = 加权综合评分 0-100
  ├── 稳定度 (25%)  ← 冲突强度、势力平衡
  ├── 混乱度 (15%)  ← 随机事件密度、未解决事件数
  ├── 神秘度 (10%)  ← 未回收伏笔、未知线索
  ├── 战争风险 (15%) ← 敌对关系数、势力紧张度
  ├── 角色压力 (15%) ← 全员情绪均值
  ├── 阵营冲突 (10%) ← 关系网敌对密度
  └── 规则完整度 (10%) ← canon 覆盖度、schema 填充率
```

#### 3.2.2 评分计算

```
每轮对话后自动计算：

稳定度 = 100 - (当前冲突强度 × 25) - (未解决事件 × 5)
混乱度 = (随机事件数/10 + 场景切换频率) × 50
神秘度 = 未回收伏笔数 × 10 + 未知线索数 × 8
战争风险 = 敌对关系数 × 8 + 势力紧张度 × 15
角色压力 = 全员 (100 - 情绪积极度) 的均值
阵营冲突 = (敌对关系数 / 总关系数) × 100
规则完整度 = (canon.confirmed 条目数 / 理想条目数) × 100
```

#### 3.2.3 新增模块：`src/core/engine/world-health.js`

```
核心 API:
  calculateHealth(worldState, relations, timeline, characters, canon)
    → 返回 { overall, dimensions: { stability, chaos, ... }, trend, alerts }

  getHealthHistory(worldName, limit = 20)
    → 返回最近 N 轮评分趋势

  getAlerts()
    → 返回需要关注的异常指标
    → 例: "战争风险飙升(35→72)", "角色压力持续高位(3轮)"

  healthTrendSummary()
    → LLM 注入用紧凑摘要
    → 例: "世界稳定度72(↓5) | 战争风险45(↑12⚠️) | 角色压力38(→)"
```

#### 3.2.4 存储

```
data/engine/health/snapshots.json  ← 追加式，每轮一条
{
  "snapshots": [{
    "round": 15,
    "overall": 68,
    "dimensions": { stability: 72, chaos: 35, ... },
    "alerts": ["战争风险上升"],
    "timestamp": "..."
  }]
}
```

#### 3.2.5 触发联动

健康度不只是展示——它影响游戏行为：

| 健康度指标 | 触发行为 |
|-----------|---------|
| 战争风险 > 80 | 导演模式自动注入冲突事件，概率翻倍 |
| 角色压力 > 75 | 强制触发喘息事件，暂停高压事件生成 |
| 稳定度 < 30 | Guardian 升级为严格模式，更频繁校验 |
| 混乱度 > 70 | 随机事件频率增加，叙事者风格自动偏移 |
| 规则完整度 < 40 | 提示用户补充世界设定 |

#### 3.2.6 实施步骤

| 步骤 | 内容 | 文件 |
|:---:|------|------|
| 1 | `world-health.js` 七维评分引擎 | 新建 `engine/world-health.js` |
| 2 | `world-state.js` 集成 — 每轮 tick 后自动计算 | 修改 `lifecycle.js` |
| 3 | 健康度历史存储 + 趋势计算 | `world-health.js` 内 |
| 4 | 告警系统 + 阈值触发 | `world-health.js` 内 |
| 5 | 导演模式联动 — 健康度触发事件策略调整 | 修改 `director.js` |
| 6 | IPC 通道 | main.cjs + preload.cjs |
| 7 | 集成测试 | 新建 |

---

## 四、三功能联动架构

```
                     ┌──────────────┐
                     │  导演模式     │
                     │  (6种模式)   │
                     └──┬───────┬──┘
                        │       │ 检索策略/注入/格式
       事件策略/风险控制│       │
                        ▼       ▼
              ┌─────────────┐  ┌──────────────┐
              │  枝干系统    │  │  世界健康度    │
              │  (分支树)   │◄─┤  (七维评分)   │
              └──────┬──────┘  └──────┬───────┘
                     │                │
        分支创建/合并│                │健康度联动
                     ▼                ▼
              ┌─────────────┐  ┌──────────────┐
              │ director.js │  │  guardian.js  │
              │ (事件调度)   │  │  (校验升级)   │
              └─────────────┘  └──────────────┘
```

### 4.1 两个联动回路

**回路 1：导演模式 → 事件 → 分支 → 健康度**
```
导演模式"黑暗奇幻" → 高压事件策略 → 玩家面临艰难选择
  → 选择 A 产生分支 → 分支 A 获得不同 canon
  → 健康度中战争风险上升 → Director 注入更多冲突
```

**回路 2：健康度 → 导演模式自适应 → 叙事调整**
```
健康度检测"角色压力 82(⚠️)" → 告警触发
  → director 的 fatigueProtection 强制介入
  → 即使导演模式是"黑暗奇幻"，也强制插入喘息事件
  → 健康度恢复到安全范围 → 恢复正常策略
```

---

## 五、实施优先级

| 顺序 | 功能 | 理由 |
|:---:|------|------|
| **1** | 枝干系统 | 已有 world-manager 基础，主要工作是四态管理 + 嫁接引擎 |
| **2** | 世界健康度 | 纯计算引擎，不依赖 UI，可与枝干并行开发 |
| **3** | 叙事导演模式 | 需要枝干和健康度就绪后才能完整联动 |

### 5.1 并行方案

枝干系统（`engine/branch-system.js`）和世界健康度（`engine/world-health.js`）可以并行开发——它们互不依赖。叙事导演模式最后做，因为它需要消费前两者的输出。

---

## 六、文件清单

```
新增:
  src/core/engine/branch-system.js        # 枝干系统核心
  src/core/engine/director-modes.js        # 6种导演模式定义
  src/core/engine/world-health.js          # 七维评分引擎

修改:
  src/core/engine/world-manager.js         # 集成 branch-system
  src/core/engine/director.js              # 集成 director-modes
  src/core/engine/lifecycle.js             # 集成 world-health 每轮计算
  src/core/engine/world-engine.js          # 按导演模式调整 prompt 注入
  src/main.cjs                             # 新增 IPC 通道
  src/preload.cjs                          # 新增 IPC API

数据:
  data/engine/branches/<branch>/branch-meta.json  # 分支元数据
  data/engine/health/snapshots.json                # 健康度历史
```
