# 内容炼金台 · 架构设计 v1

> 定位：将外部文档（角色卡/设定文档/小说章节/维基文本）自动拆解为 World Tree 结构化内容的导入引擎。

## 1. 外部参考调研

| 项目 | 借鉴点 | 适用于 |
|------|--------|--------|
| **SillyTavern 角色卡 v2/v3** | PNG 嵌入 JSON 二进制格式、`spec` 字段版本标识、`character_book` 嵌入式世界书 | 单角色导入 |
| **NovelAI Lorebook** | 条目式 JSON（keys/content/insertion_order）、触发词匹配模式 | 世界书条目导入 |
| **NovelCrafter Codex** | AI 扫描写作内容自动建议条目、提示用户审核 | 混合文档导入 |
| **World Anvil** | 按实体类型分模板（Character/Location/Item/Organization）、字段完整性检查 | 结构化导入 |
| **Obsidian + 社区插件** | Markdown 双链 `[[wikilink]]` 解析、frontmatter 元数据 | 维基文本导入 |
| **D&D Beyond / 5e Tools** | 按类型自动分类（Monster/Spell/Item/Class）、JSON Schema 模板化 | 游戏数据导入 |

### 1.1 SillyTavern 角色卡格式（v2/v3）

```
┌─ PNG 文件 ──────────────────┐
│  PNG 图像数据                │
│  ┌─ tEXt 块 ──────────────┐ │
│  │ 关键词: "chara"         │ │
│  │ 值: base64(JSON)        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘

JSON 结构 (v2):
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "角色名",
    "description": "外表描述",
    "personality": "性格描述",
    "scenario": "背景场景",
    "first_mes": "首次对话",
    "mes_example": "对话示例",
    "creator_notes": "创作者备注",
    "system_prompt": "系统提示",
    "post_history_instructions": "后置指令",
    "alternate_greetings": ["备选开场白"],
    "character_book": { ... },  // 嵌入式世界书
    "tags": ["标签"],
    "creator": "创作者",
    "character_version": "1.0",
    "extensions": { ... }
  }
}
```

### 1.2 NovelAI Lorebook 格式

```json
{
  "entries": [
    {
      "keys": ["关键词1", "关键词2"],
      "content": "条目内容",
      "extensions": {},
      "enabled": true,
      "insertion_order": 100,
      "case_sensitive": false,
      "use_regex": false,
      "constant": false,
      "selective": false,
      "secondary_keys": []
    }
  ]
}
```

### 1.3 关键设计启示

1. **分版本 spec 字段**（ST 的做法）：炼金台的每种输入格式也需要 `format` 标识，方便后续扩展新格式
2. **嵌入式子结构**（ST character_book）：角色卡可以内嵌世界书，炼金台需要递归解析
3. **AI 建议 + 人工审核**（NovelCrafter 模式）：不自动写入，而是生成可独立确认的提案列表
4. **按类型分模板**（World Anvil 模式）：不同实体类型有不同必填字段和验证规则
5. **双链解析**（Obsidian 模式）：`[[角色名]]` 格式的文本引用自动转为实体关系

---

## 2. 输入格式

### 2.1 输入矩阵

| 格式 | 检测方式 | 内容密度 | 支持的子格式 |
|------|---------|---------|-------------|
| **JSON 角色卡** (ST v2/v3) | `spec` 字段 = `chara_card_v2`/`v3` | 单角色 | PNG 内嵌 JSON / 独立 JSON |
| **JSON 世界书** (NovelAI) | `entries` 数组含 `keys` 字段 | 多条知识 | NovelAI Lorebook / WT worldbook |
| **Markdown 设定文档** | `.md` 扩展名 + heading 结构 | 混合 | 含 `[[wikilink]]` / frontmatter |
| **纯文本设定/小说** | `.txt` 或无结构文本 | 低密度 | 需 LLM 全文扫描 |
| **JSON 数据集** (5e Tools) | 含 `monster`/`spell`/`item` 等类型字段 | 高密度 | 按模板映射 |
| **RPG Maker 数据** | ` Actors.json` / `Map*.json` 格式 | 混合 | 已有 RPGMV 导出桥接 |

### 2.2 格式自动检测

```
输入端: 文件 → 读取前 1KB → 判断路径
  ├─ .png → 扫描 tEXt 块找 "chara" → ST 角色卡
  ├─ .json → 读取顶层结构
  │   ├─ spec === "chara_card_v2" → ST v2 角色卡
  │   ├─ spec === "chara_card_v3" → ST v3 角色卡
  │   ├─ entries[] 有 keys → NovelAI 世界书
  │   ├─ entries[] 有 title+content → WT 世界书
  │   ├─ 含 name+first_mes → 原生角色卡
  │   └─ 含 monster/spell/item → 游戏数据集
  ├─ .md → Markdown 设定文档
  └─ .txt / 其他 → 纯文本（LLM 全扫描）
```

---

## 3. 处理管线

### 3.1 五阶段管线

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ ① 解析   │ → │ ② 分块   │ → │ ③ 分类   │ → │ ④ 提取   │ → │ ⑤ 提案   │
│ 格式识别 │    │ 语义分段 │    │ 类型匹配 │    │ Schema填 │    │ 用户审核 │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
  纯 JS          纯 JS           LLM+JS          LLM+JS          JS+UI
  0 token        0 token        中等token       高token         0 token
```

### 3.2 各阶段详解

#### ① 解析（纯 JS，0 token）

职责：格式识别 + 结构化数据提取

```
ST PNG角色卡:
  读取 tEXt 块 → base64解码 → JSON.parse → 返回 { format: "st_v2", data: {...} }

NovelAI世界书:
  JSON.parse → 校验 entries 数组 → 返回 { format: "nai_lorebook", entries: [...] }

Markdown:
  按 ## 标题分块 → 解析 frontmatter(YAML) → 解析 [[wikilink]] → 返回段落数组

纯文本:
  按空行/章节标记分块 → 返回段落数组
```

#### ② 分块（纯 JS，0 token）

职责：将大文档切成语义完整的段落

策略：
- Markdown：按 `##` 标题自然分块，每块保留标题上下文
- 纯文本：按连续空行分块（≥2 空行 = 段边界），每块 ≤ 2000 字符
- JSON 数据集：每个数组元素已是一个独立块

输出：`[{ index, text, context(前一个标题), length }]`

#### ③ 分类（LLM + JS，中等 token）

职责：判断每个块属于哪种内容类型

```
输入: 文本块 + 上下文标题
  ↓
LLM 一次调用（所有块合并，用分隔符标记）:
  对每个块输出: { blockIndex, typeIds: ["character","location"], confidence: 0.8, reason }
  ↓
JS 校验:
  - 类型必须是 content-registry 中已注册的
  - confidence < 0.5 → 标记为 "unknown"（用户手动分类）
  - 一个块可以匹配多个类型（如一段话同时描述角色和地点）
```

LLM Prompt 设计：
```
你是一个世界设定分析器。分析以下文档段落，判断每段包含什么类型的内容。

可用类型：角色(character) / 组织(organization) / 地点(location) / 
事件(timeline) / 规则(rule) / 物品(item) / 势力(faction) / 世界知识(worldbook-entry) / 场景(scene)

对每个段落输出 JSON：
{"blockIndex": 0, "typeIds": ["character"], "confidence": 0.9, 
 "reason": "描述了名为'艾琳'的角色外观和性格", "entities": ["艾琳"]}
```

#### ④ 提取（LLM + JS，高 token）

职责：将分类后的块填入对应 Schema

```
对每一类分组后的文本块:
  ↓
LLM 按 Schema 模板提取:
  角色块 → character.schema.json 字段
  地点块 → location.schema.json 字段
  规则块 → rule.schema.json 字段
  ...
  ↓
JS 校验:
  - required 字段是否填充
  - 字段类型是否正确
  - 与已有 canon 冲突检测
  - 缺失字段 → 标记 "incomplete"
  - 冲突字段 → 标记 "conflict"，附已有值
```

关键设计：LLM 只输出 **提取到的字段值**，不编造 Schema 中没有的字段。缺失字段标记为 null 供用户手动填写。

#### ⑤ 提案（JS + UI）

职责：将所有提取结果打包为 proposal 列表

```
每组提取结果:
  ↓
创建 proposal（复用 proposal-system.js）:
  - 完整数据 → typeId + change.newValue + confidence
  - 不完整数据 → 标记 missingFields: ["age", "background"]
  - 冲突数据 → 标记 conflicts: [{ field, existingValue, extractedValue }]
  ↓
用户界面:
  - 每个 proposal 一行，展示类型图标 + 实体名 + 置信度 + 状态
  - 可展开查看完整数据 + 缺失字段 + 冲突
  - 逐项 [确认] [修改] [跳过]
  - 底部 [全部确认] [全部跳过]
  ↓
确认后写入:
  - proposal-system 的 adopt → commit 流程
  - critical 级变更仍需二次确认
```

---

## 4. 类型匹配规则

### 4.1 实体名去重

```
提取到 "艾琳" 角色:
  → 查询 relations 中是否存在同名角色
  → 查询 characters 中是否存在
  → 查询 canon 中是否提及
  
  ├─ 完全不存在 → 新建，confidence 高
  ├─ 名字相同但内容不同 → 标记 "name_collision"，提示用户选择
  └─ 名字相同且内容高度一致 → 标记 "likely_same"，合并或更新
```

### 4.2 隐式关系提取

```
文本: "艾琳是团长手下的副官，两人曾在北境并肩作战"

提取:
  → character: 艾琳（副官）
  → character: 团长
  → relation: 艾琳 → 团长 (type: "master_servant", origin: "北境并肩作战")
  → timeline: 北境战役 (past, 涉及 艾琳+团长)
  → location: 北境
```

---

## 5. 用户交互设计

### 5.1 导入面板

```
┌─ 内容炼金台 ──────────────────────────────┐
│                                              │
│  📥 拖拽文件到此处 或 [选择文件]              │
│  支持: PNG角色卡 / JSON世界书 / MD设定文档    │
│        / TXT纯文本 / JSON数据集               │
│                                              │
│  已选择: 枫海大陆设定集.md (23KB)             │
│  识别格式: Markdown 设定文档                  │
│                                              │
│  [🔬 预览]  [⚗️ 开始炼金]                    │
│                                              │
│  ⚙️ 选项:                                     │
│  ☑ 自动创建角色关系    ☑ 提取时序事件         │
│  ☑ 提取世界规则        ☐ 覆盖已有数据         │
│  ☐ 仅提取不写入                                │
└──────────────────────────────────────────────┘
```

### 5.2 炼金结果面板

```
┌─ 炼金结果 · 枫海大陆设定集 ──────────────────┐
│  共识别 23 项 · 12 高置信 · 8 中 · 3 低      │
│  [全部确认] [全部跳过] [按类型筛选 ▾]          │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ 👤 艾琳 · 角色 · 置信度 92% · 完整  [✓]  │ │
│  │ 👤 团长 · 角色 · 置信度 78% · 缺3字段 [→] │ │
│  │ 🏛️ 冒险者公会 · 组织 · 置信度 85%  [✓]   │ │
│  │ 📍 北境 · 地点 · 置信度 90% · 完整  [✓]  │ │
│  │ ⚔️ 艾琳→团长 · 关系 · 置信度 72%   [✓]   │ │
│  │ 📜 北境战役 · 事件 · 置信度 65%  [→]      │ │
│  │ 📖 魔法体系 · 规则 · 置信度 88%  [✓]      │ │
│  │ ❓ 枫海传说 · 未知类型 · 置信度 40% [✗]   │ │
│  │ ...                                       │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  已确认: 5 项  [⚗️ 写入模组]                   │
└────────────────────────────────────────────────┘
```

### 5.3 单项详情面板

```
┌─ 👤 艾琳 · 角色 ───────────────────────┐
│                                          │
│  来源段落: "艾琳是冒险者公会的..."       │
│  置信度: 92%                             │
│                                          │
│  ┌─ 基本信息 ──────────────────────────┐│
│  │ 名称: 艾琳                          ││
│  │ 角色: 副官                          ││
│  │ 年龄: -- (未提取到)                 ││
│  │ 性别: 女                            ││
│  └─────────────────────────────────────┘│
│  ┌─ 人格 ─────────────────────────────┐│
│  │ 表层: 冷静、干练                    ││
│  │ 里层: -- (未提取到)                 ││
│  └─────────────────────────────────────┘│
│  ┌─ 关系(已提取) ─────────────────────┐│
│  │ 艾琳 → 团长: 主从 (北境并肩作战)    ││
│  └─────────────────────────────────────┘│
│                                          │
│  ⚠️ 缺失字段: age, background.origin    │
│                                          │
│  [确认写入] [编辑后写入] [跳过]          │
└──────────────────────────────────────────┘
```

---

## 6. 与现有模块集成

### 6.1 集成映射

```
content-registry.js  → 类型白名单 + 分类规则
schemas/*.json       → 字段模板 + 校验规则
proposal-system.js   → 写入管道（分级确认）
relations.js         → 关系提取目标
timeline-causality.js → 事件提取目标
world-state.js       → 地点/场景提取目标
guardian.js          → 冲突检测（导入数据 vs 已有 canon）
memory-layers.js     → 记录炼金过程到世界记忆
```

### 6.2 数据写入路径

```
炼金台提案(temporary) → proposal-system(pending)
  → 用户确认(adopt) → overlay-store(overlay)
  → 二次确认(commit) → 正式模块文件
    ├─ 角色 → shared/characters.json
    ├─ 组织 → shared/organizations.json
    ├─ 地点 → shared/locations.json
    ├─ 关系 → shared/relations.json
    ├─ 事件 → shared/timeline.json
    ├─ 规则 → shared/rules.json
    └─ 世界条目 → shared/worldbook.json
```

### 6.3 冲突处理策略

```
提取值 vs 已有 canon:
  ├─ 值相同 → 跳过（无变更）
  ├─ 值不同 + 已有值更完整 → 跳过 + 标记 "已有更完整数据"
  ├─ 值不同 + 提取值更完整 → 提案更新
  ├─ 值不同 + 矛盾 → 标记冲突，用户选择保留哪个
  └─ 已有值不存在 → 新建提案
```

---

## 7. 文件结构

```
src/core/data/alchemy/
├── alchemy-engine.js       # 主入口: importFile() → 五阶段管线调度
├── parsers/
│   ├── st-character-card.js  # ST v2/v3 角色卡解析
│   ├── nai-lorebook.js       # NovelAI 世界书解析
│   ├── markdown-doc.js       # Markdown 设定文档分块
│   ├── plain-text.js         # 纯文本分块
│   └── dataset-json.js       # JSON 数据集映射
├── classifier.js           # LLM 分类器: 文本块 → 内容类型
├── extractor.js            # LLM 提取器: 类型分组 → Schema 填充
├── deduplicator.js         # 实体去重 + 名称冲突处理
└── alchemy-validator.js    # Schema 校验 + 冲突检测
```

---

## 8. 实现路线

### 8.1 阶段一：单角色导入（先做，最容易验证）

- 输入：ST PNG/JSON 角色卡
- 解析器：`st-character-card.js`
- 输出：1 个角色 proposal
- 管线：解析 → 提取 → 提案

### 8.2 阶段二：世界书批量导入

- 输入：NovelAI Lorebook JSON / WT worldbook JSON
- 解析器：`nai-lorebook.js`
- 输出：N 个世界书条目 proposal
- 管线：解析 → 去重 → 提案

### 8.3 阶段三：Markdown 设定文档

- 输入：.md 文件（含标题结构）
- 管线：解析+分块 → 分类(LLM) → 提取(LLM) → 去重 → 提案
- 这是炼金台核心能力——从非结构化文档中提取多种内容类型

### 8.4 阶段四：纯文本 + 隐式关系

- 在阶段三基础上增加：
  - LLM 隐式关系提取（从同一段落中提取 relation/timeline/location）
  - 跨段落实体链接（"如前所述的艾琳..."）

---

## 9. 边界条件与质量门

### 9.1 安全边界

- **LLM 只读不写**：LLM 负责解析和提取，不直接操作文件
- **proposal 管道统一写入**：所有提取结果通过 proposal-system 走三级确认
- **canon 保护**：已有 confirmed 数据不能被导入自动覆盖（除非用户明确勾选"覆盖已有数据"）
- **guardian 后置检查**：写入前跑 guardian.runFullGuardian 检测人设/世界观/时间线冲突

### 9.2 质量门

| 检查项 | 不通过行为 |
|--------|-----------|
| 格式无法识别 | 提示用户手动选择格式 |
| LLM 分类置信度 < 0.5 | 归入"未分类"，用户手动分配 |
| Schema required 字段缺失 | 标记 incomplete，仍可确认但提示 |
| 实体名与已有 canon 冲突 | 展示冲突详情，用户选择保留/合并/新建 |
| Guardian 检测到 critical 违规 | 阻断写入，展示违规详情 |

### 9.3 Token 预算

| 输入规模 | LLM 调用次数 | 预估 Token |
|---------|:----------:|-----------|
| 单张角色卡 (2KB) | 1 (提取) | ~500 |
| 小设定文档 (20KB) | 2 (分类+提取) | ~2000 |
| 中设定文档 (100KB) | 分 2-3 批 (每批分类+提取) | ~5000 |
| 大设定文档 (>200KB) | 分 5+ 批 | 提示用户"文档较大，建议分章节导入" |

### 9.4 分批策略

大文档自动分批：
- 按 `##` 标题分章
- 每批 ≤ 15 个文本块
- 每批独立跑分类 + 提取
- 跨批去重（按实体名）
- 所有批次完成后统一展示提案列表

---

## 10. 与其他创新功能的协同

炼金台建成后，自然驱动后续功能：

```
炼金台导入设定 → 角色/地点/规则/关系全部到位
  ↓
枝干系统加载已被炼金台填充的世界 → 用户选择产生分支
  ↓
叙事导演模式基于炼金台提取的"风格标签"自动匹配叙事者
  ↓
命运回响基于已提取的伏笔事件自动激活
  ↓
世界健康度基于完整的世界数据做动态评分
```

**炼金台是整个创新功能栈的入口。**
