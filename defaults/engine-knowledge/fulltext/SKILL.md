---
name: world-tree
description: >-
  当用户需要创建/加载/管理叙事世界（世界树模组）、进行角色扮演、互动小说、文字冒险、
  跑团式叙事、或自定义世界观中的分支剧情时激活。触发于 /引擎、/世界书、/角色、/场景、
  /推进、/存档、/读档 等世界树指令。也触发于活跃世界树上下文中的续写请求（继续/推进/下一步）。
metadata:
  version: "12.19"
  compatible_with: erotic-writing（世界树不承载色色内容，色色全归 erotic-writing 独立处理）
  v12.19: M19角色卡驱动模式上线。控制台自适应识别世界书/角色卡标签。角色卡独立于M8角色。DM姿态双模。存档[W]/[C]隔离。角色卡格式吸收创生skill四层优化。
  v12.18: M-创作模块上线+艾尔德兰整合+向量化匹配。§9精简为模块入口。M2新增向量化匹配模式(§1.2E)。新增M-创作工具箱.md(v2.1) + 更新M-世界书创作方法论.md(v2.0)。创作七步法+十大原则+8张技术卡
  v12.17: 新增§9世界书创作方法论(创作工具·非引擎模块) + references/M-世界书创作方法论.md v1.0
  v12.16: 控制台单文件世界书加载 + profile分工(default制作/writer运行) + 世界书导出目标D:\模组\
  v12.15: M1跨模组隔离(DM手册§11 + config.yaml) + 守门人校验规则运行时覆盖
  v12.14: DM手册(dm-handbook) + config.yaml精炼人格 + 按需分章加载
  v12.13: M2批量生成世界书(四层递进+交互式确认+expand子树生长)
  v12.12: M2条目自动分类(8类推断+classify指令+stats按类型分布)
  v12.11: M2概念合理化生成(允许概念延伸+自动生成proposed条目) + 世界书自然生长
  v12.10: M2语义匹配(精确/语义/精确+语义) + 步骤编号cleanup
  v12.9: 可视化控制台(world-tree-console.html) + 作家档案(writer profile) + 对话面板集成
  v12.8: 注入context-guardian分级上下文管理 + GSSC模板 + 退化预警
  v12.7: 新增M18场景走向预测 + M15c叙事质量审查 + 场景摘要链（NovelGenerator模式移植）
---

# 世界树引擎 v12.19

## 0. 上下文隔离架构（始终生效）

所有世界树叙事必须用边界标记包裹：`[世界树:模组名]...[/世界树]`

### 上下文管理策略（v12.8）

本引擎遵循 **context-guardian** 的四档预算分级。启动时自动判断档位，每轮根据档位调整行为。

> 详细策略见 context-guardian Skill：`skill_view('context-guardian')`
> 世界树专用调整表见：`references/上下文分级策略.md`

| 档位 | 用量 | 世界树行为 |
|------|------|-----------|
| 宽裕 | 0-30% | 全功能：完整场景上下文、全部世界书条目、10条摘要链 |
| 正常 | 30-50% | 标准：匹配条目(relevance>0.5)、5条摘要链、子Agent仅回传摘要 |
| 收紧 | 50-70% | 节约：高优先条目(relevance>0.7)、3条摘要链、禁用子Agent、警告用户 |
| 紧急 | 70%+ | 紧急：仅当前场景、0-1条世界书、无摘要链、强制保存、提示新对话 |

### 四维隔离模型

| 维度 | 规则 |
|------|------|
| **上下文边界** | 世界树内容必须配对标记；日常对话不加标记；嵌套禁止 |
| **记忆隔离** | 标记内的虚构叙事 → 不摄入 memory-tree；世界书/角色卡创建指令 → 正常摄入 |
| **缓存隔离** | 切换出世界树模式时清空叙事上下文，仅保留「模组名+进度摘要」一行 |
| **存储隔离** | 所有世界树运行时数据存于 `D:/world-tree-data/`，不进入 Hermes 缓存/会话/memory-tree |

### 模式切换协议

仅以用户指令形式切换模式：
- `/引擎 new` 或 `/引擎 load` → 进入世界树模式，输出 `[世界树:模组名]`
- `退出` / `/引擎 exit` → 退出模式，输出 `[/世界树]`
- 世界树模式中穿插日常提问 → 不加标记，不写回 runtime，不触发子 agent

### 日常插话规则（世界树模式中）

不加 `[世界树:]` 标记；不写回 `runtime.json`；不触发子 agent；可正常进入 memory；回复后保持模组已加载。

---

## 1. 模块系统

### 类型→模块映射表

模块按世界类型自动激活。角色卡模式有独立模块集。M16、M17 在校园/都市类型中以轻量模式运行。

| 模块 | 内容 | 史诗/科幻 | 武侠 | 都市 | 校园 | 日常 | 角色卡 |
|------|------|:---:|:---:|:---:|:---:|:---:|:---:|
| M1 | 世界书隔离容器 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| M2 | 触发式条目系统 | ✓ | ✓ | ✓ | ✓ | - | - |
| M3 | 动态世界状态 | ✓ | - | - | - | - | 轻量 |
| M4-7 | 组织/层级/关系/关键人物 | ✓ | ✓(M7) | - | - | - | - |
| M8 | 角色预设系统 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓(增强) |
| M9 | 角色认知层 | ✓ | - | - | - | - | ✓(重构) |
| M10 | 种族维度 | ✓ | - | - | - | - | - |
| M11 | 场景会话管理 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| M12 | 故事模板（预设） | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| M13 | 叙事引擎五层 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓(精简) |
| M15 | 世界规则 | ✓ | ✓ | ✓ | ✓ | - | - |
| M15c | 叙事质量审查 (v12.7新增) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓(静默) |
| M16 | 时间模块 | ✓ | ✓ | ✓(轻量) | ✓(轻量) | - | ✓(轻量) |
| M17 | 随机性模块 | ✓ | ✓ | ✓(轻量) | ✓(轻量) | - | 框架 |
| M18 | 场景走向预测 | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| **M19** | **角色卡驱动模式 (v12.19新增)** | - | - | - | - | - | **✓** |
| **M-创作** | **世界书创作工具箱** | **创作时手动开** | **创作时手动开** | **创作时手动开** | **创作时手动开** | **创作时手动开** | **创作时手动开** |

**M19（角色卡驱动模式）：** 与M8角色预设完全独立的驱动模式。角色卡是独立输入类型，不绑定世界书。DM隐退，角色直接与user互动。详见 §10 和 `references/M19-角色卡驱动.md`。

**角色卡模式模块行为说明：**
- M1: 角色卡绑定到模组，硬隔离不变
- M3: 仅场景级状态变量，服务互动契机。无事件驱动/因果链
- M8(增强): 人格底盘+表达DNA+场景响应+知识边界（吸收创生skill四层优化）
- M9(重构): 聚焦"角色对user的认知""角色自身秘密"，非世界状态认知
- M13(精简): 仅四层——角色层+环境层+语气层+记忆层
- M15c(静默): 内部运行，不向user显示任何标记
- M16(轻量): 仅场景级时间推进
- M17(框架): 框架就位但暂不触发，以用户括号提示引导事件
- M18/M2/M12/M15: 角色卡模式下关闭。DM引导/审查/提案/预测全部移除

轻量模式定义：M16 只做场景级时间推进；M17 只出轻松/中等事件，不主动提议重大随机事件。M18 在所有类型中均以完整模式运行。

### 类型自动判断优先级

主人明确指定 > 触发信号自动检测 > 默认（日常对话）。

触发信号：帝国/战争/魔法/种族 → 史诗奇幻；太空/AI/义体 → 科幻；内力/门派/江湖 → 武侠；
公司/地铁/写字楼 → 都市；教室/上课/社团 → 校园。

### 模块管理指令

`/模块 list` `/模块 on|off ID` `/模块 preset 类型` `/模块 all` `/模块 minimal`

关闭模块的效果：相关指令不可用；规则不注入上下文；自动检查跳过；已有数据保留不删除。
模块依赖：M5→M4，M6→M4，M9→M3，M10→M4。关闭父模块自动关闭子模块，激活子模块自动激活父模块。

---

## 2. 数据目录

所有数据存于 `D:/world-tree-data/`（默认值，可由 `WT_DATA_ROOT` 环境变量覆盖）。

**世界书导出目录：** 生成好的世界书文件默认输出到 `D:\模组\`。运行时数据（runtime/canon/timeline）仍在 `D:/world-tree-data/`。两个目录分离：`D:\模组\` 存放可分发/发布的世界书成品，`D:/world-tree-data/` 存放引擎运行时态。

### 核心文件

| 文件/目录 | 用途 |
|----------|------|
| `模组名/module.json` | 模组元信息与已激活模块 + **模式标签（worldbook/character_card）** |
| `模组名/timeline-tree.json` | 时间树 + active_branch 索引 |
| `模组名/shared/` | 跨分支共享：世界书、角色基础、组织、预设 |
| `模组名/presets/` | 预设级数据（主角/驱动力/runtime/时间线） |
| `模组名/branches/<branch>/runtime.json` | 分支运行时状态（场景/角色/进度） |
| `模组名/branches/<branch>/canon_state.json` | 事实台账（confirmed/implied/proposed） |
| `模组名/branches/<branch>/` | 各模块状态文件 + archive/ + tracking/ |
| `模组名/context/` | 上下文快照 + 压缩历史归档 + 场景摘要链(v12.7) |
| `模组名/saves/` | 存档目录。`[W]`前缀=世界书存档，`[C]`前缀=角色卡存档(v12.19新增) |
| `_engine/` | 引擎配置（跨模组共享） |
| `_temp/` | 子 agent 临时文件（即用即删） |
| `_learned/` | 素材学习归档 |

> 完整目录结构和数据文件→模块映射表见 `references/` 中各模块文档。

### 与 Hermes 的硬隔离

- memory-tree ❌ 不摄入 world-tree-data
- 会话 DB ❌ 不索引世界树叙事正文
- Hermes Desktop ❌ 不索引 world-tree-data
- 子 agent session ❌ 不入 Hermes 会话 DB

> **外部引擎移植参考：** 将本引擎完整移植到独立桌面应用（无 Hermes Agent、直连 LLM）时，知识注入与数据写入架构见 `references/外部引擎移植架构.md`。

---

## 3. 引擎生命周期

### 3.1 启动（/引擎 new 或 /引擎 load）

**new**：确认模组名+类型 → 自动判断类型激活模块 → 创建数据目录 → 初始化 `module.json`、`timeline-tree.json`、`branches/main/canon_state.json`、`branches/main/runtime.json` → 创建初始角色+场景 → 使用默认预设（normal）。
创建世界书时智能补全：预设字段缺失→从世界书自动补→从其他内容推理补→向用户提问。

**load**：读取 `module.json` → 恢复模块配置 → 读取 `timeline-tree.json` 确定 active_branch → 加载 `branches/<branch>/` 下各数据文件 → 按模块列表选择性加载状态 → 加载活跃预设 → **注入场景摘要链（最近5条）** → 注入场景预测（如有） → 开始叙事。

**角色卡检测（v12.19新增）：** `/引擎 load` 加载文件时自动检测JSON结构：
- 含世界书特征（spec/entries/worldbook）→ 世界书模式
- 含角色卡特征（name+first_mes+personality 或 名称+性格+首次对话）→ 角色卡模式
- 检测结果展示标签并提示确认，确认后按对应模式激活模块集

**快速开始（无初始化指令）**：默认角色扮演+通用日常+毛球人设+空世界书+仅内存运行。无独立数据目录，不持久化。下次需恢复时先创建命名模组。

### 3.2 每轮运行时

1. **上下文档位检查（v12.8）**：评估用量→确定档位(宽裕/正常/收紧/紧急)→按档位调整读深度和写粒度
2. 隔离检查：确认模式 → 配对标记包裹
3. **续写安全确认**（仅短指令触发：继续/推进/下一步等）：
   - ① 提取 `[世界树:模组名]` → 无则检查 `runtime.json` 找活跃模组 → 提示确认
   - ② 分支一致性：上下文分支 vs active_branch → 不一致则阻断+报告
   - ③ 运行时状态核对：场景/角色/进度 vs 上下文 → 矛盾阻断
   - ④ 角色名归属校验（M1 守门人）：任一不通过则阻断
   - ⑤ 叙事质量标记提示（M15c）：如有未解决的标记 → 展示一行提示
4. 加载运行时状态：从数据目录读取 `runtime.json` + `canon_state.json` + 各模块数据 + 预设 + **场景摘要链**
5. 子 agent 调度（仅世界树模式；色色/日常/短指令跳过）：根据世界类型决定 agent 数量 → 写入 task.json → 并行 delegate_task → 读取结果 → 清理 _temp/
6. 规则审核（M15 激活时）：行为可行性 → 物理/魔法规则 → 时间一致性 → 代价清单
7. 叙事质量审查（M15c 激活时）：角色一致性 → 场景连续性 → 叙事节奏 → 风格一致性（非阻塞，标记+建议）
8. 扫描触发词 → 注入匹配条目（仅限当前世界书）
9. 状态注入：世界状态(M3) + 组织实体(M4-7) + 角色认知过滤(M9)
10. 叙事引擎五层(M13)：角色层→环境层→剧情层→语气层→记忆层
11. 随机事件检查（M17 激活时）：场景转换→小型事件概率判定；章节节点→大型事件概率判定；用★标记呈现提案
12. 退化预警检测（v12.8）：扫描三信号（沉默完成/措辞模糊/步骤跳过）→ 任一触发→展示警告+建议操作
13. 写回：标记本轮变化 confirmed/implied/proposed → 写入 `canon_state.json` → 更新 `runtime.json` → 更新预设 runtime → 清理 _temp/_

上下文压缩触发：轮次>30 或 snapshot>50KB → 自动压缩 → 写入 `context/history/session_N.json.gz`

### 3.3 退出

保存 `context/snapshot.json` → 更新所有脏数据 → 压缩上下文归档 → 清空内存→输出 `[/世界树]`

---

## 4. 场景转换自动行为

当「第二天/放学后/来到XX」等场景转换信号出现：
1. 保存当前场景快照
2. 新场景重新扫描触发词
3. 时间流逝联动世界状态变更（战争→战线推进 / 角色获得新信息）
4. 新地点检查组织势力范围 → 影响行动自由度
5. 追踪角色体力/情绪/道具到新场景
6. 环境重新描写
7. **生成场景摘要**（追加到 context/scene_chain.json）
8. **场景走向预测**（M18 激活时）：基于当前局势生成 2-3 个可能走向 → 注入上下文

---

## 5. 指令速查

### 模组与引擎
`/引擎 new [名]` `/引擎 load [名]` `/引擎 status` `/引擎 export-rpgmv` `/引擎 exit`

### 世界书（当前活跃世界书）
`/世界书 add [词]:[内容]` `/世界书 list|show|edit|remove|export|load` `/世界书 generate 描述` `/世界书 expand 条目名 --depth N` `/世界书 regenerate 条目名 描述` `/世界书 suggest` `/世界书 match-mode 条目名 精确|语义|两者|向量化` `/世界书 extend 条目名 on|off` `/世界书 classify 条目名 [类型]` `/世界书 classify-all [--force]` `/世界书 mode 条目名 模式` `/世界书 layer 条目名 层级` `/世界书 depth 条目名 深度` `/世界书 match 条目名 任一|全部` `/世界书 probability 条目名 [概率]` `/世界书 persistent 条目名 永久|会话|单场景` `/世界书 vector-topn|vector-threshold|vector-rebuild|vector-stats` `/世界书 stats`

### 世界书集（全局）
`/世界书集 list|create|switch|now|delete|rename`

### 模块
`/模块 list|on|off|preset|all|minimal`

### 角色
`/角色 create|list|show|use|edit|link|delete|load`

### 场景
`/场景 new|now|move|time|join|leave`

### 预设
`/预设 list|use|create|show|edit|delete|switch|status`

### 组织（M4 激活后可用）
`/组织 create|show|list|edit|link|state|join|leave|delete|tree|net|path|keyfig|race|ripple`

### 世界状态（M3 激活后可用）
`/世界状态 list|show|set|log|affect|add`

### 认知（M9 激活后可用）
`/认知 show|update|gap|broadcast|群组`

### 随机事件（M17 激活后可用）
`/随机 prob|cooldown|trigger|trace|list|dismiss|history|weights`

### 场景预测（M18 激活后可用）
`/预测` `/预测 on|off` `/预测 style 详细|简略`

### 规则（M15 激活后可用）
`/规则 strictness|check|why|status` `/物理 check` `/社会 check` `/魔法 rule|check|cost`

### 叙事审查（M15c 激活后可用）
`/审查 check|status|dismiss|strictness`

### 场景摘要
`/摘要链 show [N]` `/摘要链 length [N]` `/摘要链 clear|archive`

### 存档与分支
`/存档 [名]` `/读档 [名]` `/存档列表|delete` `/分支 list|switch|create|info|compare|delete|rename`

### 上下文管理
`/压缩 [--间隔 N] [--模式 类型]` `/上下文 show|depth|on/off`

### 推进与输出
`/推进` `/推进 停止`

### 追踪
`/追踪 status|changelog|伏笔|冲突|快照|检查点`

### 素材
`/素材 提取|状态|检索|应用` `/素材仓 接收|分析|检测|搜集|筛选|整理|打包|交付`

### 插件
`/插件 list|load|unload|show|status`

### 隔离
`/隔离 status|进入|退出|摘要`

---

## 6. 与 erotic-writing 的隔离规则

1. 世界树不承载、不输出、不存储色色内容。
2. 色色指令出现 → 世界树暂停，保存运行时状态 → erotic-writing 独立处理 → 结束后恢复世界树。
3. 色色内容不写入 `D:/world-tree-data/`。
4. 世界树不主动向 erotic-writing 传递角色/场景数据；如需，由用户显式提供。

---

## 7. 快速开始示例

```
# 新建模组
> /引擎 new 奇幻大陆
→ 毛球判断类型并激活模块，提示确认

# 创建角色
> /角色 create 艾琳
> /角色 create 团长

# 加世界书条目
> /世界书 add 魔法: 魔法分三系——

# 开始互动
> 艾琳推开酒馆的门…

# 保存
> /存档 第一章
```

## 9. 世界书创作工具箱（M-创作模块 · 创作工具 · 非引擎模块）

> **定位：** 世界树引擎的创作阶段工具模块。属于模块系统（M-创作），不参与运行时叙事。
> **状态：** 游戏运行时默认**关闭**。创作世界书时手动激活：`/模块 on M-创作`
> **内容：** 创作七步法 + 十大创作原则 + **8张技术卡片**（人物锚点/结局架构/叙事密度/留白指南/小物件/开局设计/信息分层/触发与位置策略）
> **与 M1-M18 的关系：** M1-M18 负责运行时，M-创作负责创作时。两者互不干扰。

| 文件 | 内容 |
|------|------|
| `references/M-世界书创作方法论.md` | 七步法完整流程（v2.0） |
| `references/M-创作工具箱.md` | 十大原则+技术卡片合集（v2.1） |

**快速流程：** 读素材→提问→锚点设计→选原则→出初稿→审查→修改

---

## 10. 角色卡驱动模式（M19 · v12.19新增）

> **定位：** 与世界书模式并列的独立驱动模式。角色卡是独立输入类型，与M8角色预设完全不同。
> **核心理念：** DM完全隐退，角色直接以第一人称"我"对user说话。纯沉浸式互动，无任何元层标记。
> **完整规范：** `references/M19-角色卡驱动.md`

### 10.1 两种模式的区别

| | 世界书模式 | 角色卡模式 |
|------|:---:|:---:|
| 驱动核心 | 世界书（M2触发式条目） | **角色卡本身**（常驻上下文） |
| 角色身份 | M8角色预设，绑定于世界书 | **独立角色卡**，不绑定世界书 |
| DM角色 | 在场引导/审查/提案 | **完全隐退** |
| 输出格式 | [旁白]/[系统]/★提案 | **纯叙事**，无元层标记 |
| 事件引导 | DM提案/随机事件 | **用户括号提示为主** |
| 关系追踪 | 无 | **隐形叙事化**（无数值面板） |

### 10.2 控制台自动识别

加载文件时按JSON结构自动打标签：

```
检测逻辑：
  含 spec/entries/worldbook → 标签【世界书】
  含 name+first_mes+personality（ST格式）或 名称+性格+首次对话（原生）→ 标签【角色卡】
  两者都检出 → 分别标注，提示选择加载类型
  两者都未检出 → 提示"无法识别格式"
```

控制台展示：
- 🏷【世界书】蓝色标识，显示条目数+类型
- 🏷【角色卡】粉色标识，显示角色名+来源格式

### 10.3 角色卡增强格式

吸收 `creation-skill` 四层优化后的角色卡格式：

```yaml
角色卡（增强版）:
  基本信息: 名称/别名/年龄/性别/种族 + 外貌
  
  人格底盘:              # 新增·创作skill维度
    欲望/恐惧/执念/情绪默认态/情绪爆发点
  
  表达DNA:               # 增强
    口癖/语气词密度/句式偏好/称呼习惯/禁用语感/签名动作
  
  性格: 核心特质/隐藏面/矛盾反差/底线禁忌
  
  背景: 出身/当前身份/核心经历/当前目标
  
  场景响应模式:           # 新增·5个核心场景
    初次见面/被夸奖/被冒犯/亲密试探/孤独低落时
    每个场景：[典型反应+动作神态+台词风格]
  
  知识边界:               # 新增
    可以知道/不应该知道/模糊处理
  
  成长阶段:               # 新增（可选）
    当前阶段/可能的成长方向
  
  首次对话 + 对话示例
```

### 10.4 叙事规则（角色卡模式专属）

源自创生skill的对话输出机制，直接转化为角色卡模式规则：

1. 角色始终第一人称"我"说话
2. 对话自然附标志性动作/神态（不强制）
3. 绝不跳出角色身份做meta分析
4. 不主动提及关系网中其他人（除非user先提）
5. 默认关系起点：「熟悉但不亲密的暧昧」
6. 隐藏面/秘密在合适时机自然揭露
7. 对user的称呼随关系自然演变
8. 日常本土化知识可以知道，技术原理/meta不应该知道

### 10.5 关系追踪（隐形·叙事化）

```
❌ 不做：好感度65/100、关系阶段面板、数值展示
✅ 只做：叙事中自然体现

初识时：艾琳看了你一眼，很快移开视线。"...随便坐。"
熟悉后：她听到你的脚步声就抬头了，嘴角有个压不下去的弧度。
升温时：她没说话，只是把茶杯往你那边推了推——是你上次说好喝的那种。
```

内部维护模糊标记用于指导叙事语气，外部绝不展示。

### 10.6 角色卡专属认知层（M9重构）

聚焦"角色对user的认知"+"角色自身秘密"：

```yaml
角色: 艾琳
对user的认知:
  已知: user的名字、user喜欢喝什么、user说过的一个秘密
  猜测: "他好像不太会拒绝人..."
  未知: user的过去、user为什么总是来这家店
  误解: 以为user喜欢热闹（其实user只是不好意思一个人待着）

角色自身的秘密:
  - 她其实不是普通咖啡店店员
  - 每周四晚上她会消失几个小时
  - 她会偷偷记下user说过的话
```

认知在叙事中自然更新——user告诉了新信息→未知→已知；角色观察到行为→生成猜测；秘密被揭露→戏剧张力。

### 10.7 轻量世界状态 + 随机事件框架

**M3（轻量）：** 仅场景级状态变量，服务互动契机。
```
校园场景：学期阶段/近期活动(文化祭/游学/运动会)
```

**M17（框架）：** 框架就位但暂不触发。当前以用户括号提示引导：
```
用户：（学校组织旅行）
→ 叙事中自然出现旅行通知，角色反应
```

### 10.8 存档类型隔离

```
存档命名：[W]前缀=世界书模式，[C]前缀=角色卡模式

存档内type字段：
  "type": "worldbook" | "character_card"  ← 强制字段

读档校验：
  type匹配当前模式？→ 正常加载
  type不匹配？→ 阻断+提示切换模式
```

### 10.9 保留指令

角色卡模式下仅保留基础指令：
`/存档 [名]` `/读档 [名]` `/存档列表` `/场景 now|move` `/角色 show [名]` `/分支 list|switch` `/引擎 status`

所有DM引导/审查/提案/预测类指令均不可用。

### 10.10 输出对比

**世界书模式：**
```
[旁白] 门被推开，冷风灌入。
[系统] canon_state: 场景→王都酒馆(confirmed)。
★随机事件提案：角落的神秘人似乎注意到了你们...
```

**角色卡模式：**
```
门被推开的时候，冷风裹着几片落叶卷进来。艾琳缩了缩肩膀，往你这边靠近了一点。

"好冷。"她小声说，白色的气息散在空气里。然后她抬头看了你一眼，很快又移开。
"...你今天来得比平时晚。"
```

### 10.11 与 M8 角色的明确区分

| | M8角色（世界书内） | 角色卡（M19驱动） |
|------|:---:|:---:|
| 归属 | 绑定于世界书 | 独立存在 |
| 创建方式 | `/角色 create 名 世界书名` | 加载JSON/PNG角色卡文件 |
| 关系 | 世界书=M8角色的容器 | 角色卡=容器的全部 |
| 世界背景 | 由世界书条目提供 | 由角色卡背景+scenario提供 |
| 混合 | 不可脱离世界书 | 不可混入世界书模式 |

---

## 8. 可视化控制台与作家工作台（v12.9）

世界树提供单文件零依赖的可视化控制台
以及专属的 Hermes 作家档案（writer profile），实现数据面板+对话引擎合一的工作台。

### 8.1 控制台（world-tree-console.html）

纯前端 HTML 文件，直接在浏览器打开。只读数据，不写回世界树文件。

**功能：**
- 14个Tab：对话、概览、世界书、存档、角色、场景、状态、伏笔、分支、组织、预设、指令、关系图
- 对话面板：内嵌 Hermes API Server 客户端，当前稳定版使用非流式 `/chat` 响应；SSE 流式为待恢复能力
- 多种数据导入方式：Chrome目录API / 拖拽 / 兼容导入 / 手动JSON
- **v12.16 新增：直接选择世界书文件（JSON）加载** — 选 `.json` 文件后概览即显示世界书条目摘要（条目数、类型分布、触发词预览），无需加载整个模组目录。适合快速浏览/审阅世界书成品
- Canvas可视化：场景摘要链图、角色关系图
- 会话管理器：按模组保存已知 Hermes session，可手动切换、复制 ID、忘记绑定
- 新会话启动包：首次向新 session 发送消息时自动附带当前模组/分支/场景/摘要链/待决问题
- 同步 / 体检页：显示当前控制台指纹、模组键、API 检查、目录记忆能力和镜像目标路径
- 存档/分支并排diff

**数据读取清单：** 世界书、角色(base+state)、组织、预设、场景、追踪(伏笔/冲突)、canon_state、场景摘要链、预测、叙事审查、随机事件、世界状态、认知层、规则、引擎配置

**指令面板：** 覆盖20+指令组70+子命令，支持从 `_engine/commands.json` 动态加载

### 8.2 作家档案（writer profile）

Hermes 独立 profile，专用于世界树叙事和小说创作。

**位置：** `C:\Users\Lenovo\AppData\Local\hermes\profiles\writer\`（Windows。其他系统为 `~/.hermes/profiles/writer/`）

**关键配置：**
- 人格：`writer`（定制作家/DM系统提示）
- 工具集：file / skills / web / search / memory / session_search / clarify / vision
- Skill：world-tree / world-tree-gm / novel-engine / erotic-writing / context-guardian / quality-toolkit 等12个核心skill
- API Server：`platforms.api_server.extra.port: 18742`（注意：端口配置在 `extra` 层级下，而非 `api_server` 顶层）

**持久化：** `hermes -p writer gateway install` 安装为 Windows 计划任务，开机自启。

### 8.3 对话面板接入

控制台「对话」Tab 通过 Hermes API Server 与作家档案通信：

```
控制台 HTML → fetch /chat → http://127.0.0.1:18742 → writer gateway → agent loop
```

- 端点：`/health`（健康检查）、`/api/sessions`（创建会话）、`/api/sessions/{id}/chat`（非流式对话）
- 对话历史按模组隔离存储在 localStorage；远端 Hermes session 也按模组通过 `sessionsByModule` 隔离
- 「开启新对话」会立即为当前模组创建新的 Hermes session，清空聊天上下文但不修改世界树进度文件
- 当前模组会话带有本地会话元数据（`sessionsMetaByModule`），支持手动切换会话、复制 session id、忘记绑定
- 新 session 首次发送消息时会自动附带启动包，减少“新对话空脑袋”问题
- 「体检」Tab 可检查当前控制台版本、HTML hash、API 健康、目录记忆权限和主/ writer 镜像目标路径
- 每次DM回复后自动刷新控制台数据
- 写作剪贴板：一键保存DM生成的精彩段落

### 8.4 工作流

1. 打开控制台 → 加载 `D:/world-tree-data` → 确认模组状态
2. 切到「对话」Tab → 配置 API 地址 + Token → 测试连接
3. 发送 `/引擎 load 模组名` → DM开始叙事
4. 边看数据面板边对话：切Tab查看角色位置、伏笔压力、场景链变化
5. 发现问题 → 回对话发送 `/追踪 伏笔` 或 `/存档`

**世界书快速浏览（v12.16）：** 可直接选 `D:\模组\模组名\shared\worldbook.json` 文件，概览 Tab 显示条目摘要和类型分布。无需加载完整模组目录。

### 8.5A 控制台会话隔离（v12.16+）

**历史问题：** 控制台「对话」Tab 若在同一 Hermes 会话中先后加载不同世界书，旧世界书的上下文会污染新世界书的加载。例如 43 条「共感娃娃」消息之后说「加载万界」，模型可能把共感娃娃内容带入万界输出。

**症状：** 加载世界书B时，第一句话出现世界书A的内容（如角色名、设定、指令）。

**根因：** Hermes 远端 session_id 没变时，同一个 `api_xxx` 会话里会先后出现两个不同世界书的加载指令。Writer agent 收到的上下文 = 旧世界书的全部对话历史 + 新加载指令。

**当前修复：**
- 控制台本地聊天记录按模组 key 隔离：`wt-chat-{moduleKey}`。
- 远端 Hermes session 通过 `sessionsByModule` 按模组保存，不再全局共用一个 session_id。
- 在对话框直接输入「加载万界」或 `/引擎 load 万界` 时，控制台会先切到目标模组并清掉该模组旧 session 绑定。
- 「开启新对话」会立即为当前模组创建全新的 Hermes session；它只清空聊天上下文，不清空 `runtime.json`、`canon_state.json`、`scene_chain.json`、存档或分支进度。
- 当前模组键不再只靠模组名，而是结合 `storagePath` / `storageKey` 做稳定指纹，避免同名世界书共用聊天桶。
- 会话管理器会记录当前模组最近使用过的 session，支持手动切回旧会话；若该 session 尚未接收启动包，首次发送时仍会补发启动包。

**排查方法：** 见 `references/控制台会话隔离排查.md`。

### 8.5 Profile 分工（v12.16）

| Profile | 职责 | 不负责 |
|---------|------|--------|
| **default（毛球）** | 世界书制作、世界树 skill 修改/优化、控制台维护 | 启动游戏、运行叙事 |
| **writer** | 游戏运行、DM主持、叙事推进、角色扮演 | 世界书制作、引擎代码修改 |

两个 profile 各司其职。default 产出世界书放到 `D:\模组\`，writer 从 `D:\模组\` 或 `D:/world-tree-data/` 加载后运行。

> 详细设置指南见 [references/控制台与作家档案.md](references/控制台与作家档案.md)

| 文件 | 内容 |
|------|------|
| [references/规范真相源-v12.5.yaml](references/规范真相源-v12.5.yaml) | 唯一真相源（文件名沿用，内容权威版本为 v12.19） |
| [scripts/world_tree_contract_check.py](scripts/world_tree_contract_check.py) | 合约漂移自检脚本：真相源/镜像副本/_engine/M19 样例索引 |
| [scripts/world_tree_release_audit.py](scripts/world_tree_release_audit.py) | 一键发版审计：合约自检 + 双 validator + JSON 模板解析 |
| [references/DM手册.md](references/DM手册.md) | DM行为规范(按需分章加载·10章) | 模组加载/叙事/停滞/冲突/色色边界场景加载 |
| [references/维护代码规范.md](references/维护代码规范.md) | 修改本 skill 前必读 |
| [references/快速上手.md](references/快速上手.md) | 用户快速入门 |
| [references/命令详解.md](references/命令详解.md) | 全部指令完整语法 |
| [references/知识库索引.md](references/知识库索引.md) | 关键词→知识库映射 |
| [references/文档导航.md](references/文档导航.md) | 文档阅读路径 |
| [references/M1-世界书隔离.md](references/M1-世界书隔离.md) | 多世界书容器/串台阻断 |
| [references/M2-触发式条目.md](references/M2-触发式条目.md) | 关键词触发/条目注入 |
| [references/M3-动态世界状态.md](references/M3-动态世界状态.md) | 状态变量/事件驱动 |
| [references/M4-组织实体.md](references/M4-组织实体.md) | M4/M5/M6/M7/M10 |
| [references/M8-角色预设.md](references/M8-角色预设.md) | 角色卡/M9 认知层 |
| [references/M11-场景会话.md](references/M11-场景会话.md) | 场景卡/切换/嵌套 |
| [references/M12-故事模板.md](references/M12-故事模板.md) | 预设系统/智能补全 |
| [references/M13-叙事引擎五层.md](references/M13-叙事引擎五层.md) | 角色/环境/剧情/语气/记忆层 |
| [references/M15-世界规则.md](references/M15-世界规则.md) | 行为审核/物理/魔法/M15c叙事审查 |
| [references/M16-时间模块.md](references/M16-时间模块.md) | 双层时间/世界轴 |
| [references/M17-随机性模块.md](references/M17-随机性模块.md) | 三级事件/权重自适应 |
| [references/M18-场景走向预测.md](references/M18-场景走向预测.md) | 场景级走向预测/叙事惯性 |
| [references/M19-角色卡驱动.md](references/M19-角色卡驱动.md) | 角色卡驱动模式完整规范(v12.19新增) |
| [references/M19-最小测试样例.md](references/M19-最小测试样例.md) | 角色卡/世界书/双重命中/未知格式测试样例 |
| [references/M-叙事一致性雷达.md](references/M-叙事一致性雷达.md) | 每轮输出后的事实/角色/时间/规则/节奏雷达 |
| [references/M19-情绪惯性系统.md](references/M19-情绪惯性系统.md) | 角色卡模式隐性关系与情绪轨道 |
| [references/世界书生长树.md](references/世界书生长树.md) | 剧情中新设定的候选枝芽与确认流程 |
| [references/分支差异叙事摘要.md](references/分支差异叙事摘要.md) | 把分支 diff 转成命运差异摘要 |
| [references/素材吸收评分器.md](references/素材吸收评分器.md) | 素材进入世界树前的污染风险评分 |
| [references/一键发版审计.md](references/一键发版审计.md) | 发版前一键审计流程 |
| [references/叙事质量审查.md](references/叙事质量审查.md) | M15c 故事质量审查/非阻塞 |
| [references/控制台与作家档案.md](references/控制台与作家档案.md) | 可视化控制台 + writer profile 设置指南(v12.9) |
| [references/场景摘要链.md](references/场景摘要链.md) | 分层上下文/场景摘要 |
| [references/上下文分级策略.md](references/上下文分级策略.md) | 四档预算分级/退化预警(v12.8) |
| [references/M-引擎隔离架构.md](references/M-引擎隔离架构.md) | 上下文边界/记忆/缓存/存储隔离 |
| [references/M-子agent协作.md](references/M-子agent协作.md) | 多agent并行/调度/隔离 |
| [references/存档分支与时间树系统.md](references/存档分支与时间树系统.md) | 时间树/存档/分支 |
| [references/Tracking追踪系统.md](references/Tracking追踪系统.md) | 变更日志/伏笔/冲突 |
| [references/素材学习系统.md](references/素材学习系统.md) | 素材提取/分类/归档 |
| [references/宏系统.md](references/宏系统.md) | 模板变量/宏清单 |
| [references/自动推进模式.md](references/自动推进模式.md) | 当前 /推进 模式详解 |
| [references/自主输出小说模式.md](references/自主输出小说模式.md) | 历史归档：已简化并移交，不作为当前运行入口 |
| [references/处理补全引擎.md](references/处理补全引擎.md) | 前置引擎/七步流水线 |
| [references/worldbook-json-schema.md](references/worldbook-json-schema.md) | worldbook.json JSON 条目格式参考（字段映射+示例） |
| [references/世界书制作检查清单.md](references/世界书制作检查清单.md) | 素材→世界书完整性检查 |
| [references/M-世界书创作方法论.md](references/M-世界书创作方法论.md) | 创作七步法完整流程 (v2.0) · 非引擎模块 |
| [references/M-创作工具箱.md](references/M-创作工具箱.md) | 十大原则+8张技术卡片合集 (v2.1) · 非引擎模块 |
| [references/插件开发指南.md](references/插件开发指南.md) | 插件系统规范 |
| [references/自动推进模式.md](references/自动推进模式.md) | /推进 模式详解 |
| [references/跨文件一致性审计方法.md](references/跨文件一致性审计方法.md) | 多文件版本一致性检查流程(v12.9) |
| [references/desktop-port-audit-checklist.md](references/desktop-port-audit-checklist.md) | Desktop 引擎移植审核清单（v12.19→独立引擎） |
| [processing-engine/](processing-engine/) | 前置处理补全引擎 |
