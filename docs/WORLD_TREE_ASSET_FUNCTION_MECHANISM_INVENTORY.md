# World Tree Asset / Function / Mechanism Inventory

> **文件用途**：这是 World Tree 的"资产、功能、机制防遗失清单"。  
> 它不是路线图，也不是待办清单，而是项目长期演进时的 **preservation ledger / anti-regression manifest**。  
> 任何 Agent、Codex、Hermes、维护者在升级项目时，都必须先阅读本文件，确认不会把已有能力、已设计能力、旧包中待吸收的高价值机制误删、遗忘、降级或重复造轮子。

---

## 0. 使用规则

### 0.1 本文件保护什么

本文件保护三类内容：

1. **当前仓库已存在并应继续保留的功能 / 机制 / 架构资产**
2. **P0-P2 已完成接入的 Kernel 能力**
3. **旧包和早期版本中发现、但当前仓库尚未完全吸收的高价值机制**

### 0.2 更新要求

任何一次功能升级、重构、清理、目录调整、提示词升级、UI 调整，都必须遵守：

```text
如果一个机制被删除、改名、合并、迁移、降级、替代，
必须同步更新本文件，并说明：

1. 为什么改
2. 原机制去哪了
3. 新机制是否完全覆盖旧能力
4. 哪些测试证明没有丢失
5. 是否需要文档迁移
```

### 0.3 禁止事项

```text
禁止因为"没在当前 sprint 用到"就删除机制。
禁止因为"旧包结构老"就忽略旧包中的机制价值。
禁止把已完成机制改成只剩文档。
禁止把可运行功能退化成孤立函数。
禁止让 UI / API / docs 与 core 能力脱节。
禁止在没有测试覆盖的情况下删除或替换核心机制。
```

### 0.4 状态枚举

| 状态 | 含义 |
|---|---|
| `ACTIVE` | 当前仓库已有并应继续维护 |
| `ACTIVE-PARTIAL` | 当前已有部分实现，但还需要补齐 |
| `KERNEL-COMPLETE` | P0-P2 Kernel 已完成验证 |
| `PLANNED` | 已决定后续实现 |
| `LEGACY-CANDIDATE` | 旧包中发现，值得选择性吸收 |
| `DEFERRED` | 暂缓，不应现在实现 |
| `DO-NOT-IMPLEMENT` | 明确不建议实现 |
| `WATCH` | 需要持续观察，防止回归 |

---

# 1. 项目核心架构资产

## 1.1 Mode / Module 架构

| ID | 名称 | 状态 | 当前定位 | 保护规则 |
|---|---|---|---|---|
| ARCH-001 | Mode System | ACTIVE | 多入口模式系统，承载 quick-setting / character / world-rpg / tabletop / mystery-puzzle / strategy-sim / murder-mystery / creation-forge | 不得被单一 RPG 引擎替代 |
| ARCH-002 | Module Registry / Manifest | ACTIVE | 模块注册与能力声明 | 新模块必须注册，不得绕过 |
| ARCH-003 | Module Contract | ACTIVE | 模块输入输出边界 | 新 wrapper / mode 必须遵守 |
| ARCH-004 | Module Wrappers | ACTIVE | 旧能力与新模块之间的适配层 | wrapper 不得直接写 canon |
| ARCH-005 | Mode Module Map | ACTIVE | mode → module 基础映射 | P2 profile 只能 overlay，不得替换 |
| ARCH-006 | Module Composer | ACTIVE | mode base + profile overlay + user options 组合 | 不能启用未注册模块 |
| ARCH-007 | Mode Runner | ACTIVE | 模式运行统一入口 | 不得塞成巨大上帝文件 |
| ARCH-008 | Kernel Turn Context | KERNEL-COMPLETE | P0-P2 的真实 turn 接入入口 | 必须继续进入真实 LLM turn 和 mode-runner |

### 必须保留的入口

```text
quick-setting
character
world-rpg
tabletop
mystery-puzzle
strategy-sim
murder-mystery
creation-forge
```

---

## 1.2 Runtime / Save / Proposal 架构

| ID | 名称 | 状态 | 当前定位 | 保护规则 |
|---|---|---|---|---|
| SYS-001 | proposal-bus | ACTIVE | 所有 canon 修改的审核通道 | 不得重写；只能兼容扩展 |
| SYS-002 | world-tree-save-system | ACTIVE | 项目保存与导出基础 | 不得绕过 path-security |
| SYS-003 | branch-local runtime | KERNEL-COMPLETE | P2 分支隔离 runtime | 所有分支读写必须走 active branch root |
| SYS-004 | tracking change-log | KERNEL-COMPLETE | 记录变化原因和来源 | rollback 不得删除 tracking |
| SYS-005 | stop-loss window | KERNEL-COMPLETE | major/critical 可逆窗口 | reverse 只能生成 pending proposal |
| SYS-006 | impact gate | KERNEL-COMPLETE | light/medium/major/critical 分级 | critical 必须二次确认 |
| SYS-007 | path security | ACTIVE | 本地文件安全边界 | 任何 API 不得拼接用户路径 |
| SYS-008 | mode isolation policy | ACTIVE | 过滤 hidden truth / answer lock / private plan | 必须深层过滤 |

---

# 2. 当前用户功能入口资产

## 2.1 Quick Setting

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-QS-001 | Quick Setting | ACTIVE | 快速整理最小可启动世界设定 |
| ENTRY-QS-002 | Minimal World Bootstrap | ACTIVE-PARTIAL | 应只生成最小可运行设定，不应扩写成长篇世界书 |
| ENTRY-QS-003 | Missing Field Hints | PLANNED | 提示缺失字段，而不是硬编 |

保护规则：

```text
quick-setting 不能变成完整创作工坊。
quick-setting 不得自动生成隐藏真相。
quick-setting 不得替用户决定核心世界方向。
```

---

## 2.2 Character

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-CHAR-001 | Character Mode | ACTIVE | 人物互动入口 |
| ENTRY-CHAR-002 | Character Capsule / Card Support | ACTIVE | 角色资料承载 |
| ENTRY-CHAR-003 | Emotional Inertia | KERNEL-COMPLETE | 称呼、距离、信任、主动性、秘密透露程度等运行态稳定器 |
| ENTRY-CHAR-004 | Character Knowledge Boundary | LEGACY-CANDIDATE | 旧包中角色知道/不知道/误解的信息边界 |
| ENTRY-CHAR-005 | Character Response Gradient | LEGACY-CANDIDATE | 角色情绪与关系变化梯度 |
| ENTRY-CHAR-006 | Character Growth Phase | LEGACY-CANDIDATE | 角色阶段性成长与变化规则 |

保护规则：

```text
角色不能自称 AI。
角色不能突然 OOC。
角色不能跳过 Emotional Inertia 直接亲密/坦白/反目。
角色秘密不能直接泄露。
用户角色不能被 LLM 代替行动。
```

---

## 2.3 World RPG / Grand World

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-WRPG-001 | World RPG / Grand World Mode | ACTIVE | 大世界探索与互动 |
| ENTRY-WRPG-002 | Proximity Scope | KERNEL-COMPLETE | 主角邻近范围激活 |
| ENTRY-WRPG-003 | Dynamic World State | KERNEL-COMPLETE | 当前世界状态 |
| ENTRY-WRPG-004 | Bounded Ripple | KERNEL-COMPLETE | 有限因果链建议 |
| ENTRY-WRPG-005 | Scene Summary Chain | KERNEL-COMPLETE | 场景摘要链 |
| ENTRY-WRPG-006 | World Telemetry | KERNEL-COMPLETE | 世界脉象 / 只读读数 |
| ENTRY-WRPG-007 | Random Event Pool | LEGACY-CANDIDATE | 旧包事件池，需候选化接入 Director |
| ENTRY-WRPG-008 | Narrative Momentum Control | ACTIVE-PARTIAL | 已有 Director/Telemetry 基础，仍需更强 prompt 层控制 |

保护规则：

```text
不得硬套等级/职业/装备/经验值。
不得替玩家做重大选择。
重大世界变化必须 proposal。
远端信息不能像全知旁白一样直接落地。
```

---

## 2.4 Tabletop

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-TT-001 | Tabletop Mode | ACTIVE | 桌面叙事主持入口 |
| ENTRY-TT-002 | Light Resolution / Consequence | ACTIVE-PARTIAL | 轻量判定与后果 |
| ENTRY-TT-003 | Fail Forward | PLANNED | 失败也推进，不直接卡死 |
| ENTRY-TT-004 | Scene Clock / Tension Clock | LEGACY-CANDIDATE | 可从旧包事件/节奏机制吸收 |
| ENTRY-TT-005 | Bounded Dice Command | ACTIVE | `/roll` 解析、d20 critical、runtime/prompt 注入；不得写 shared canon |

保护规则：

```text
不得变成复杂 DND 克隆。
不得替玩家行动。
每轮最多一个主要后果。
失败要有可玩的后果。
```

---

## 2.5 Mystery Puzzle

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-MYST-001 | Mystery Puzzle Mode | ACTIVE | 解谜调查入口 |
| ENTRY-MYST-002 | Answer Lock / Truth Lock | ACTIVE | 答案锁 / 真相锁过滤 |
| ENTRY-MYST-003 | Clue Candidate Flow | ACTIVE-PARTIAL | 线索应 candidate/proposal 化 |
| ENTRY-MYST-004 | Evidence Chain | LEGACY-CANDIDATE | 证据链完整性机制 |
| ENTRY-MYST-005 | Hint Ladder | LEGACY-CANDIDATE | 分级提示，不直接泄底 |
| ENTRY-MYST-006 | Suspect Knowledge Boundary | LEGACY-CANDIDATE | 嫌疑人知识边界 |
| ENTRY-MYST-007 | Player-visible Clue Board | ACTIVE | discovered clues + hypotheses；hidden truth 不能进入玩家上下文 |

保护规则：

```text
给线索，不给答案。
不得提前说凶手/真相。
不得把推理猜测当 canon。
答案锁只能 system-only。
```

---

## 2.6 Murder Mystery

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-MM-001 | Murder Mystery Mode | ACTIVE | 单人剧本杀入口 |
| ENTRY-MM-002 | Suspect Testimony | ACTIVE-PARTIAL | 嫌疑人证词 |
| ENTRY-MM-003 | Timeline Contradiction | LEGACY-CANDIDATE | 时间线矛盾检测 |
| ENTRY-MM-004 | Role-Specific Knowledge Matrix | LEGACY-CANDIDATE | 每个嫌疑人知道什么 |
| ENTRY-MM-005 | Case Phase Controller | LEGACY-CANDIDATE | 搜证/盘问/推理/锁凶阶段控制 |
| ENTRY-MM-006 | Culprit Non-Self-Expose Rule | PLANNED | 凶手不能无理由自爆 |

保护规则：

```text
真相锁不得进入玩家可见文本。
嫌疑人不是全知。
凶手不能无理由自爆。
案件阶段不能被 LLM 跳过。
```

---

## 2.7 Strategy Sim

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-STRAT-001 | Strategy Sim Mode | ACTIVE | 策略模拟入口 |
| ENTRY-STRAT-002 | Faction State | ACTIVE-PARTIAL | 阵营状态 |
| ENTRY-STRAT-003 | Faction Knowledge Boundary | LEGACY-CANDIDATE | 各阵营知道/误判/隐藏计划 |
| ENTRY-STRAT-004 | Organization / Faction Graph | LEGACY-CANDIDATE | 组织关系图谱 |
| ENTRY-STRAT-005 | Bounded Situation Update | KERNEL-COMPLETE | 有限局势推进 |
| ENTRY-STRAT-006 | Resource / Diplomacy Patch Proposal | ACTIVE-PARTIAL | 四项资源薄切片写 runtime/candidate；重大变化仍走 proposal |
| ENTRY-STRAT-007 | Bounded Resource Panel | ACTIVE | 粮草/军力/民心/外交与四个决策；数值强制 0..max |

保护规则：

```text
不得无限推演。
不得替玩家做战略决定。
阵营不得全知。
重大局势变化走 proposal。
```

---

## 2.8 Creation Forge / Alchemy

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| ENTRY-FORGE-001 | Creation Forge | ACTIVE | 炼金台 / 创作入口 |
| ENTRY-FORGE-002 | Processing Candidate Engine | KERNEL-COMPLETE | 素材 → 候选 |
| ENTRY-FORGE-003 | Material Source Metadata | KERNEL-COMPLETE | source label/hash 保留 |
| ENTRY-FORGE-004 | Candidate Delivery | KERNEL-COMPLETE | deliver 到 Growth Tree 或 proposal queue |
| ENTRY-FORGE-005 | Creation Wizard v2 | LEGACY-CANDIDATE | 六阶段创作向导 |
| ENTRY-FORGE-006 | Digest Mode | LEGACY-CANDIDATE | 旧包素材消化模式 |
| ENTRY-FORGE-007 | Extract Mode | LEGACY-CANDIDATE | 旧包素材提取模式 |
| ENTRY-FORGE-008 | ST Character Card Import | LEGACY-CANDIDATE | 酒馆角色卡导入 |
| ENTRY-FORGE-009 | NAI Lorebook Import | LEGACY-CANDIDATE | Lorebook 导入 |
| ENTRY-FORGE-010 | Markdown / TXT Material Parser | LEGACY-CANDIDATE | 文档素材解析 |
| ENTRY-FORGE-011 | Quickplay Preview | LEGACY-CANDIDATE | 候选项目轻试玩 |
| ENTRY-FORGE-012 | Blueprint Instantiation Plan | LEGACY-CANDIDATE | 从蓝图到项目实例化计划 |

保护规则：

```text
炼金台不是闲聊入口。
炼金台不是小说生成器。
炼金台不得未经确认创建项目。
炼金台不得直接写 canon。
素材只能先进入 candidate / blueprint / proposal。
```

---

## 2.9 P3 M1-M11 Asset References

> 本节用于和 `scripts/validate-asset-inventory.mjs` 的 P3 asset registry 对齐。
> 它是 preservation reference，不代表这些机制全部已完整产品化；具体成熟度以相关架构文档、测试和当前功能文档为准。

| Validator ID | Name | Source Path | Inventory Role | Status |
|---|---|---|---|---|
| `M1-creation-wizard` | Creation Wizard v2 | `src/core/creation-wizard/` | P3 mechanism preservation reference | PRESERVE |
| `M2-alchemy-digest` | Alchemy Digest Candidate Flow | `src/core/alchemy/alchemy-digest.js` | P3 mechanism preservation reference | PRESERVE |
| `M3-material-warehouse` | Material Learning Warehouse | `src/core/materials/material-warehouse.js` | P3 mechanism preservation reference | PRESERVE |
| `M4-character-kernel-v2` | Character Kernel v2 | `src/core/character/character-kernel-v2.js` | P3 mechanism preservation reference | PRESERVE |
| `M5-cognition-matrix` | Character Cognition Matrix | `src/core/cognition/cognition-matrix.js` | P3 mechanism preservation reference | PRESERVE |
| `M6-faction-graph` | Organization / Faction Graph | `src/core/factions/faction-graph.js` | P3 mechanism preservation reference | PRESERVE |
| `M7-world-rules` | World Rules Engine | `src/core/world-rules/world-rules-engine.js` | P3 mechanism preservation reference | PRESERVE |
| `M8-narrative-radar` | Narrative Consistency Radar | `src/core/narrative-radar/narrative-consistency-radar.js` | P3 mechanism preservation reference | PRESERVE |
| `M9-random-events` | Random Event Pool | `src/core/events/random-event-pool.js` | P3 mechanism preservation reference | PRESERVE |
| `M10-macros` | Macro System | `src/core/macros/macro-registry.js` | P3 mechanism preservation reference | PRESERVE |
| `M11-observability` | Observability Terminal | `src/core/observability/observability-packet.js` | P3 mechanism preservation reference | PRESERVE |

---

# 3. P0 Living World Kernel 清单

| ID | 名称 | 状态 | 说明 | 不得丢失的能力 |
|---|---|---|---|---|
| P0-001 | Proximity Scope | KERNEL-COMPLETE | 主角邻近范围 | core/near/far/dormant |
| P0-002 | Tracking Store | KERNEL-COMPLETE | 变化日志 | change-log.jsonl |
| P0-003 | Tracking Digest | KERNEL-COMPLETE | 最近变化摘要 | 给 context/director 使用 |
| P0-004 | Scene Summary Chain | KERNEL-COMPLETE | 场景摘要链 | transitionScene |
| P0-005 | Dynamic World State | KERNEL-COMPLETE | 当前世界状态 | proposal-gated |
| P0-006 | Bounded Ripple | KERNEL-COMPLETE | 有限因果链 | maxDepth/maxFanout/no recursion |
| P0-007 | Worldbook Trigger | KERNEL-COMPLETE | 世界书触发 | base/context/instant |
| P0-008 | Living World Packet | KERNEL-COMPLETE | P0 汇总包 | 真实 turn 可消费 |

必须保护的边界：

```text
P0 不得直接绕过 proposal 写 shared。
Ripple 不得递归。
Worldbook trigger 不得泄露 hiddenTruth。
Scene summary 不是 canon。
```

---

# 4. P1 Experience Stability Kernel 清单

| ID | 名称 | 状态 | 说明 | 不得丢失的能力 |
|---|---|---|---|---|
| P1-001 | Context Engine | KERNEL-COMPLETE | 上下文预算和过滤 | 不无限召回 |
| P1-002 | Director Layer | KERNEL-COMPLETE | plan-only 导演 | 不写正文 |
| P1-003 | Content Registry | KERNEL-COMPLETE | 内容影响登记 | affectedFiles/entities |
| P1-004 | Impact Gate | KERNEL-COMPLETE | 变更分级 | light/medium/major/critical |
| P1-005 | Stop-loss Window | KERNEL-COMPLETE | 可逆窗口 | reverse pending proposal |
| P1-006 | Worldbook Growth Tree | KERNEL-COMPLETE | 世界书候选树 | seed/sprout/branch/pruned |
| P1-007 | Emotional Inertia | KERNEL-COMPLETE | 情绪惯性 | runtime-first |
| P1-008 | Experience Stability Packet | KERNEL-COMPLETE | P1 汇总包 | 真实 turn 可消费 |

必须保护的边界：

```text
Director 不写正文。
Growth Tree 不直写 worldbook。
Critical 必须二次确认。
Emotional Inertia 不做公开数值面板。
```

---

# 5. P2 Long Play Kernel 清单

| ID | 名称 | 状态 | 说明 | 不得丢失的能力 |
|---|---|---|---|---|
| P2-001 | World Profile Overlay | KERNEL-COMPLETE | 世界类型模块叠加 | 不替换 mode map |
| P2-002 | Timeline Branch Tree | KERNEL-COMPLETE | 时间树 / 分支 | create/switch/archive/diff |
| P2-003 | Branch-local Save | KERNEL-COMPLETE | 分支隔离保存 | shared/runtime 隔离 |
| P2-004 | World Telemetry | KERNEL-COMPLETE | 世界脉象 | 只读 canon |
| P2-005 | Auto-light Advance | KERNEL-COMPLETE | 单 beat 预演 | 不替玩家决策 |
| P2-006 | Processing Engine | KERNEL-COMPLETE | 素材处理 | candidate-only |
| P2-007 | Kernel APIs | KERNEL-COMPLETE | 14 个 API 端点 | local/path-secured |
| P2-008 | Minimal Kernel UI | KERNEL-COMPLETE | 世界内核面板 | 分支/遥测/提案/素材 |

必须保护的边界：

```text
不做 branch merge。
Telemetry 不生成剧情。
Auto-light 不审批 proposal。
Processing 不直接写 canon。
```

---

# 6. Prompt Orchestration Layer 清单

| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| PROMPT-001 | Prompt Orchestration Layer | ACTIVE | 提示词编排与边界治理层（v1 已实现） |
| PROMPT-002 | Prompt Block | ACTIVE | 可组合提示块（22 blocks） |
| PROMPT-003 | Prompt Builder | ACTIVE | 拼装最终 prompt |
| PROMPT-004 | Mode Prompt Profiles | ACTIVE | 每入口提示配置（8 profiles） |
| PROMPT-005 | Task Prompt Contracts | ACTIVE | writer/director/proposal/summary 等任务提示（9 contracts） |
| PROMPT-006 | Output Schemas | ACTIVE | 内部任务强制 JSON |
| PROMPT-007 | Final Guard | ACTIVE | 靠近生成点的防跑偏指令 |
| PROMPT-008 | Prompt Activation Log | ACTIVE | 本轮激活了哪些提示 |
| PROMPT-009 | Prompt Inspector | ACTIVE | 查看最终 prompt / prompt blocks |
| PROMPT-010 | Canon / Runtime / Candidate Rule | ACTIVE | 三分法 |
| PROMPT-011 | Visibility Policy Prompt | ACTIVE | public/private/hiddenTruth/playerKnown |
| PROMPT-012 | Anti-Idle / Anti-OOC Prompt | ACTIVE | 防闲聊、防跳出模式 |

必须覆盖的任务：

```text
writer
director
guardian
proposal_extractor
scene_summary
tracking_digest
worldbook_candidate
processing_extractor
emotional_inertia
telemetry_explanation
```

必须覆盖的入口：

```text
quick-setting
character
world-rpg
tabletop
mystery-puzzle
murder-mystery
strategy-sim
creation-forge
```

---

# 6.5 Legacy Mechanism Expansion (P3 M1-M11) — ACTIVE

| ID | 名称 | 状态 | 说明 | 目录 |
|---|---|---|---|---|
| M1-001 | Creation Wizard v2 | ACTIVE | 六阶段世界创建向导（地基→角色→世界→规则→开场→事件→审查），HARD/SOFT/OPTIONAL 字段分级，blueprint candidate delivery | src/core/creation-wizard/ (7 files) |
| M2-001 | Alchemy Digest Candidate Flow | ACTIVE | 外部素材消化器：parse → extract → dedupe → conflict detect → classify risk。10 种候选类型 | src/core/alchemy/alchemy-digest.js |
| M3-001 | Material Learning Warehouse | ACTIVE | 素材记忆仓库：source registry + candidate index + adoption ledger。防重复导入 | src/core/materials/material-warehouse.js |
| M4-001 | Character Kernel v2 | ACTIVE | 角色结构化底盘：canonProfile + expressionDNA + responseLadder + growthPhase + boundaries | src/core/character/character-kernel-v2.js |
| M5-001 | Character Cognition Matrix | ACTIVE | 角色知识边界：known/suspected/misunderstood/unknown/forbidden。强制 murder-mystery/mystery-puzzle/character/strategy-sim 启用 | src/core/cognition/cognition-matrix.js |
| M6-001 | Organization / Faction Graph | ACTIVE | 阵营关系图：ally/enemy/neutral/vassal/trade/secret。public/secret 分离 | src/core/factions/faction-graph.js |
| M7-001 | World Rules Engine | ACTIVE | 世界规则审核器：9 种规则类型 + hard/soft/flavor strictness + block/warn/proposal/allow policy | src/core/world-rules/world-rules-engine.js |
| M8-001 | Narrative Consistency Radar | ACTIVE | 六维一致性审查：facts/character/time/rules/rhythm/visibility。block hidden truth leaks | src/core/narrative-radar/narrative-consistency-radar.js |
| M9-001 | Random Event Pool + Scene Direction | ACTIVE | 候选事件池：flavor/clue/conflict/opportunity/pressure + cooldown + weighting。major events → proposal only | src/core/events/random-event-pool.js |
| M10-001 | Macro System | ACTIVE | 安全模板变量替换：{{mode.id}}/{{branch.id}}/{{character.name}} 等。禁止读取 hidden/private/apiKey | src/core/macros/macro-registry.js |
| M11-001 | Observability Terminal | ACTIVE | 回合观测包：kernel/prompt/proposal/radar/event/material 状态汇总 + path/secret redaction | src/core/observability/observability-packet.js |

新增测试：
- `tests/unit/creation-wizard.test.js` (8 tests)
- `tests/integration/legacy-mechanism-expansion.test.js` (14 tests)
- `npm run test:legacy-mechanisms` → 22/22 PASS

所有机制均为 pure in-memory, no filesystem writes。candidate/runtime/canon/debug 分层完整。

---

# 7. 旧包高价值候选机制清单

## 7.1 创作与炼金台机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-FORGE-001 | Creation Wizard v2 | LEGACY-CANDIDATE | 作为 creation-forge 的分阶段向导 |
| LEGACY-FORGE-002 | Six-stage Creation Flow | LEGACY-CANDIDATE | 地基/角色/世界/规则/开场/事件 |
| LEGACY-FORGE-003 | HARD/SOFT/OPTIONAL Field Grading | LEGACY-CANDIDATE | 用于素材缺口判断 |
| LEGACY-FORGE-004 | Cross-module Dependency Check | LEGACY-CANDIDATE | 角色/世界/规则/事件之间依赖检查 |
| LEGACY-FORGE-005 | Technical Cards | LEGACY-CANDIDATE | 作为 creation blueprint 卡片 |
| LEGACY-FORGE-006 | Digest Mode | LEGACY-CANDIDATE | 素材消化候选流 |
| LEGACY-FORGE-007 | Extract Mode | LEGACY-CANDIDATE | 素材提取候选流 |
| LEGACY-FORGE-008 | Quickplay Preview | LEGACY-CANDIDATE | 草稿项目试玩，不落 canon |

---

## 7.2 角色与认知机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-CHAR-001 | Character Card v2 | LEGACY-CANDIDATE | 角色卡结构升级 |
| LEGACY-CHAR-002 | Personality Base | LEGACY-CANDIDATE | 人格底盘 |
| LEGACY-CHAR-003 | Expression DNA | LEGACY-CANDIDATE | 语气/句长/口癖/行为风格 |
| LEGACY-CHAR-004 | Scene Response Pattern | LEGACY-CANDIDATE | 不同场景下的角色反应 |
| LEGACY-CHAR-005 | Knowledge Boundary | LEGACY-CANDIDATE | 角色知道/不知道/误解 |
| LEGACY-CHAR-006 | Relationship Tracker | LEGACY-CANDIDATE | 关系演化记录 |
| LEGACY-CHAR-007 | Growth Phase | LEGACY-CANDIDATE | 角色长期阶段变化 |

---

## 7.3 解谜 / 剧本杀机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-MYST-001 | Evidence Chain | LEGACY-CANDIDATE | 线索链完整性 |
| LEGACY-MYST-002 | Hint Ladder | LEGACY-CANDIDATE | 分级提示系统 |
| LEGACY-MYST-003 | Suspect Knowledge Matrix | LEGACY-CANDIDATE | 嫌疑人知识边界 |
| LEGACY-MYST-004 | Testimony Consistency | LEGACY-CANDIDATE | 证词一致性检测 |
| LEGACY-MYST-005 | Timeline Contradiction Detector | LEGACY-CANDIDATE | 时间线矛盾检测 |
| LEGACY-MYST-006 | Case Phase Controller | LEGACY-CANDIDATE | 搜证/盘问/推理/锁凶阶段 |

---

## 7.4 组织 / 阵营 / 世界状态机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-ORG-001 | Organization Template | LEGACY-CANDIDATE | 组织结构模板 |
| LEGACY-ORG-002 | Faction Graph | LEGACY-CANDIDATE | 阵营关系图 |
| LEGACY-ORG-003 | Role-Organization Link | LEGACY-CANDIDATE | 角色-组织关系 |
| LEGACY-ORG-004 | Multi-Identity | LEGACY-CANDIDATE | 多重身份/卧底 |
| LEGACY-ORG-005 | Secret Alliance | LEGACY-CANDIDATE | 秘密合作 |
| LEGACY-ORG-006 | Diplomacy State | LEGACY-CANDIDATE | 外交关系状态 |

---

## 7.5 世界规则与一致性机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-RULE-001 | World Rules Engine | LEGACY-CANDIDATE | 审核行为是否符合世界规则 |
| LEGACY-RULE-002 | Rule Strictness | LEGACY-CANDIDATE | 规则严格度 |
| LEGACY-RULE-003 | Magic / Tech / Social Rules | LEGACY-CANDIDATE | 世界规则分类 |
| LEGACY-RULE-004 | Boundary Case Handler | LEGACY-CANDIDATE | 规则冲突/边缘情况 |
| LEGACY-RULE-005 | Narrative Consistency Radar | LEGACY-CANDIDATE | facts/character/time/rules/rhythm 五维检查 |

---

## 7.6 事件 / 导演 / 节奏机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-EVENT-001 | Random Event Pool | LEGACY-CANDIDATE | 作为 Director 候选输入 |
| LEGACY-EVENT-002 | Event Weight Adaptation | LEGACY-CANDIDATE | 避免重复事件 |
| LEGACY-EVENT-003 | Event Severity Level | LEGACY-CANDIDATE | light/medium/major/critical |
| LEGACY-EVENT-004 | Scene Direction Prediction | LEGACY-CANDIDATE | 预测场景走向 |
| LEGACY-EVENT-005 | Rhythm Guard | LEGACY-CANDIDATE | 节奏守卫 |

---

## 7.7 观测 / 调试 / 宏机制

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| LEGACY-OBS-001 | Observation Console | LEGACY-CANDIDATE | Debug panel |
| LEGACY-OBS-002 | Prompt Inspector | ACTIVE | 已在 Prompt Orchestration Layer v1 实现 |
| LEGACY-OBS-003 | Activation Log | ACTIVE | 已在 Prompt Orchestration Layer v1 实现 |
| LEGACY-OBS-004 | Macro System | LEGACY-CANDIDATE | prompt/template 变量 |
| LEGACY-OBS-005 | Macro Permission Filter | LEGACY-CANDIDATE | 宏不得解析 hiddenTruth |
| LEGACY-OBS-006 | Scenario Test Pack | LEGACY-CANDIDATE | 回归测试场景包 |

---

# 8. 外部项目可借鉴机制清单

## 8.1 SillyTavern / 酒馆

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| EXT-ST-001 | Prompt Manager | ACTIVE | Prompt Block 管理（已在 Prompt Orchestration Layer v1 实现） |
| EXT-ST-002 | Prompt Ordering | ACTIVE | 提示词顺序控制（已在 Prompt Orchestration Layer v1 实现） |
| EXT-ST-003 | World Info / Lorebook | ACTIVE-PARTIAL | 当前 Worldbook Trigger 已部分覆盖 |
| EXT-ST-004 | Insertion Position | ACTIVE | 系统/角色/历史/最终指令位置（已在 Prompt Orchestration Layer v1 实现） |
| EXT-ST-005 | Post-History Instructions | ACTIVE | Final Guard（已在 Prompt Orchestration Layer v1 实现） |
| EXT-ST-006 | Prompt Preview / Inspector | ACTIVE | Debug 查看最终 prompt（已在 Prompt Orchestration Layer v1 实现） |
| EXT-ST-007 | Character Card Format | LEGACY-CANDIDATE | 炼金台导入格式支持 |
| EXT-ST-008 | Regex / Script Hooks | DEFERRED | 暂不做复杂脚本生态 |

---

## 8.2 RisuAI

| ID | 名称 | 状态 | 推荐吸收方式 |
|---|---|---|---|
| EXT-RISU-001 | Multi-source Lorebook Merge | LEGACY-CANDIDATE | world/character/module material 合并 |
| EXT-RISU-002 | Scan Depth | ACTIVE | Prompt / lore 激活扫描深度（已在 budget/activation log 实现） |
| EXT-RISU-003 | Token Budget | ACTIVE | Prompt block 预算（已在 Prompt Orchestration Layer v1 实现） |
| EXT-RISU-004 | Recursive Scanning Limit | LEGACY-CANDIDATE | 有限递归触发 |
| EXT-RISU-005 | Match Log | ACTIVE | 激活日志（已在 Prompt Orchestration Layer v1 实现） |
| EXT-RISU-006 | Lore Ordering | LEGACY-CANDIDATE | 激活结果排序 |

---

# 9. 暂缓 / 不做清单

## 9.1 暂缓

| ID | 名称 | 原因 |
|---|---|
| DEFER-001 | Branch Merge | 分支隔离尚需长期验证，merge 风险太大 |
| DEFER-002 | Plugin Ecosystem | 当前先稳定核心体验 |
| DEFER-003 | External Engine Export / RPGMV | 容易偏离当前本地体验系统 |
| DEFER-004 | Multi-agent Story Generation | 会增加不可控性 |
| DEFER-005 | Full Auto Campaign | 会替用户玩游戏 |
| DEFER-006 | Complex Rule Combat System | 会把项目拖向重型 RPG 引擎 |
| DEFER-007 | Prompt Regex Script Marketplace | 安全与维护复杂度高 |

## 9.2 不做

| ID | 名称 | 原因 |
|---|---|
| DONT-001 | 自动绕过 proposal 写 canon | 破坏核心边界 |
| DONT-002 | Telemetry 直接生成剧情 | Telemetry 是仪表，不是驾驶员 |
| DONT-003 | Growth Tree 自动入库 | 会污染世界书 |
| DONT-004 | Auto-light 连续自动游玩 | 会替用户决策 |
| DONT-005 | 隐藏真相直接进玩家 prompt | 破坏解谜/剧本杀 |
| DONT-006 | 旧包整包回滚 | 会破坏当前架构 |

---

# 10. 防回归检查清单

每次提交前必须至少检查：

```text
1. npm run preflight
2. npm run test:p0
3. npm run test:p1
4. npm run test:p2
5. npm run test:kernel
6. 若修改提示层：npm run test:prompts
7. 若修改炼金台：processing candidate 不得直写 canon
8. 若修改分支：main / alternate 不得串线
9. 若修改剧本杀/解谜：hiddenTruth / answerLock 不得进入玩家可见输出
10. 若修改角色：Emotional Inertia 不得被绕过
11. 若修改 proposal：critical 仍需二次确认
12. 若修改 stop-loss：reverse 仍是 pending proposal
13. 若修改 worldbook：Growth Tree 仍不得直写 shared/worldbook.json
14. 若修改 prompt：必须保留 Final Guard
15. 若删除/迁移任何机制：必须更新本文件
```

---

# 11. 下一批推荐实现顺序

## 第一批：边界和提示层 ✅（已完成）

```text
1. Prompt Orchestration Layer
2. Prompt Inspector
3. Mode Prompt Profiles
4. Task Prompt Contracts
5. Final Guard + Output Schemas
```

## 第二批：创作与素材消化

```text
1. Creation Wizard v2
2. Alchemy Digest Candidate Flow
3. ST Character Card Import
4. NAI Lorebook Import
5. Blueprint / Quickplay Preview
```

## 第三批：角色、谜案、阵营深度

```text
1. Character Cognition Matrix
2. Evidence Chain
3. Hint Ladder
4. Suspect Knowledge Matrix
5. Organization / Faction Graph
```

## 第四批：一致性与调试

```text
1. Narrative Consistency Radar
2. World Rules Engine
3. Random Event Pool
4. Macro System
5. Scenario Test Pack
```

---

# 12. Agent 执行注意

任何 Agent 看到本文件后，必须遵守：

```text
1. 先判断目标机制是否已在本清单中。
2. 如果已存在，优先扩展，不要重复造平行系统。
3. 如果是 LEGACY-CANDIDATE，先做适配设计，不要照搬旧包。
4. 如果是 DEFERRED 或 DO-NOT-IMPLEMENT，不得实现，除非用户明确解除限制。
5. 如果新增机制，必须给它分配稳定 ID 并写入本文件。
6. 如果删除机制，必须写明 replacement / migration / tests。
7. 所有正式状态写入继续走 proposal / branch / tracking。
8. 所有 LLM 输出继续受 prompt contract / visibility / final guard 约束。
```
