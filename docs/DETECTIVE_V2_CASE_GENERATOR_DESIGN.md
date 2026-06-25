# Detective V2 Case Generator Design

> 案件生成器的完整设计。不是简单模板——吸收 GUMSHOE、Consulting Detective、Obra Dinn、Roottrees 的结构精华。

## 设计目标

`planCaseCapsuleFromPremise(premise, options)` 产出一个**规划脚手架**，不是完整可玩案件。后续 Step 2 的 runtime 将消费此脚手架填充具体内容。

## 核心机制

### 1. 复杂度配置 (Complexity Profile)

三级难度预设：

| 难度 | 嫌疑人 | 地点 | 核心线索 | 误导 | 证言 | 推理锁 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| easy | 3 | 2 | 3 | 1 | 4 | 4 |
| standard | 4 | 3 | 5 | 3 | 6 | 6 |
| hard | 5 | 4 | 7 | 5 | 8 | 7 |

### 2. 谜题逻辑图 (Mystery Logic Graph)

包含：受害者档案、嫌疑人动机、关键关系、隐藏事件、红鲱鱼、欺骗网络（谎言/半真/错误/保护）

### 3. 线索计划 (Clue Plan)

- 核心线索：每个核心线索至少一条可达路径 + 备选路径
- 误导线索槽：预留给误导的线索位置
- 无死胡同保证（GUMSHOE 原则）

### 4. 证言计划 (Testimony Plan)

欺骗类型分布（非单一"只有凶手说谎"）：
- truthful 30% / partial_truth 25% / mistaken 15% / self_protective 10% / protecting_other 10% / lie 10%

### 5. 推理锁 (Deduction Locks)

多维度结案：凶手 / 动机 / 手法 / 时间线 / 关键证据 / 矛盾证言 / 识破误导

### 6. 可解性检查表 (Solvability Checklist)

自动检查：嫌疑人数量、核心线索路径、动机完整性、欺骗多样性、无死胡同、回合数、推理锁数量

### 7. 防速通校验 (Anti-speedrun Validator)

触发警告条件：
- standard/hard 难度嫌疑人 < 4
- 推理锁 < 5
- 核心线索路径 < 2
- 仅使用一种欺骗类型
- 动机数 < 2
- 核心线索 < 3
- 证言数 < 4

## 生成器不做什么

- 不生成完整案件内容
- 不生成 NPC 对话
- 不生成场景描写
- 不生成具体证据文本
- 这些留给 Step 2 runtime + AI 叙事
