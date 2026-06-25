# World Tree

> **当前版本：v0.4.1-v2-entry-closure.0 — Pre-V2 Closure Blocker Repair** — V2 Entry Closure (sealed)。
> 快速开始：[docs/USER_QUICKSTART.md](docs/USER_QUICKSTART.md) | 文档索引：[docs/INDEX.md](docs/INDEX.md)

World Tree 让用户进入角色、世界、案件、局势和故事现场，进行持续的互动、探索、推理、扮演和体验。它也提供创作能力，但创作不是终点：创作角色，是为了互动；创作世界书，是为了探索；创作案件，是为了推理；创作项目包，是为了让体验能保存、继续和扩展。

```text
创作是准备世界。
体验是进入世界。
World Tree 的重点，是让用户真的能进去玩。
```

---

## 你可以体验什么？

```text
World Tree
│
├─ 和角色对话、建立关系、体验人物性格
├─ 进入世界书，在大世界中探索事件和变化
├─ 进行单人桌面叙事，像跑团一样推进剧情
├─ 调查谜题，收集线索，形成假说
├─ 推演阵营和局势，看世界如何回应你的选择
├─ 玩单人剧本杀，审讯、推理、复盘真相
└─ 使用炼金台，把灵感变成可继续游玩的内容
```

---

## 快速体验

### 1. 准备环境

你需要先安装：

- Node.js
- npm
- Git，可选，用来拉取仓库

### 2. 获取项目

```bash
git clone https://github.com/HatayaMisuzu/world-tree.git
cd world-tree
```

如果你是下载 ZIP，也可以直接解压后进入项目目录。

### 3. 安装依赖

```bash
npm install
```

### 4. 启动

```bash
npm start
```

启动后，在浏览器打开：

```text
http://127.0.0.1:3000
```

如果终端显示了不同端口，请以终端输出为准。

---

## 第一次怎么玩？

推荐按这个顺序体验：

```text
1. 打开 World Tree
2. 选择一个入口
3. 新建或加载项目
4. 输入你的行动、问题或设定
5. 让 AI 推进体验
6. 保存项目，下次继续
```

如果你不知道从哪里开始，可以这样选：

| 你想做什么 | 推荐入口 |
| --- | --- |
| 想快速生成一个可玩的项目 | 快速设定 |
| 想和一个角色互动 | 人物卡 |
| 想进入一个世界探索 | 世界书大世界 |
| 想体验单人跑团 | 桌面叙事 |
| 想玩调查和解谜 | 解谜调查 |
| 想推演势力和局势 | 策略模拟 |
| 想玩单人剧本杀 | 单人剧本杀 |
| 想把灵感炼成项目素材 | 炼金台 |

---

## 功能入口

| 入口 | 你能体验到什么 |
| --- | --- |
| 快速设定 | 把一句灵感、一段设定或一个世界观快速变成可继续体验的项目 |
| 人物卡 | 创建并体验角色的性格、说话方式、关系变化和互动边界 |
| 世界书大世界 | 进入一个世界，探索地点、事件、人物关系和世界变化 |
| 桌面叙事 | 像单人跑团一样行动、判定、遭遇事件、推进剧情 |
| 解谜调查 | 调查场景、收集线索、提出假说、逐步接近真相 |
| 策略模拟 | 管理阵营、资源和局势，看选择如何影响世界 |
| 单人剧本杀 | 面对案件、嫌疑人和证词，推理真相并复盘 |
| 炼金台 | 把灵感生成角色、世界书、案件、模式项目或可复用资产 |

说明：

- `world-rpg` 是项目里的历史内部名字，现在代表"世界书大世界"，不是传统刷级 RPG。
- `creation-forge` 是"炼金台"，主要负责生产可体验内容，不是普通游玩入口。

---

## 项目特点

### 多种体验入口

World Tree 不是只有一种聊天玩法，而是把不同体验拆成不同入口：

```text
角色互动
世界探索
桌面叙事
解谜调查
策略推演
剧本杀推理
内容炼成
```

每个入口都有自己的用途，不会混成一团。

### 本地优先

项目默认在本机运行，适合个人创作、游玩和测试。你的项目文件保存在本地目录中，方便备份、迁移和继续开发。

### 可以继续的体验

World Tree 的目标不是一次性生成一段文本，而是让体验能继续：

```text
这次玩到哪里
发生了什么
哪些设定已经成立
哪些变化等待确认
下次从哪里继续
```

这些都会进入项目存档。

### 重要改动先审核

AI 不会随便把关键设定直接写死。重要变化会先进入"提案"，你确认后才会变成正式内容。

```text
AI 提议变化
   │
   ▼
待审核提案
   │
   ├─ 批准 → 写入正式设定
   └─ 拒绝 → 不影响正式设定
```

### 隐藏真相保护

解谜、剧本杀、策略模拟等模式需要隐藏信息。World Tree 会尽量把真相、答案、幕后计划等内容和玩家可见信息分开，减少剧透和串线。

### 创作服务于体验

World Tree 有创作能力，但它不是单纯的素材管理器。它更像一台体验生成器：

```text
生成角色 → 为了互动
生成世界 → 为了探索
生成案件 → 为了推理
生成阵营 → 为了推演
生成项目 → 为了继续游玩
```

---

## 项目会保存什么？

一个 World Tree 项目大致包含：

```text
project/
│
├─ world.json
│   └─ 项目基础信息
│
├─ shared/
│   └─ 正式内容：角色、世界书、场景、关系、时间线等
│
└─ runtime/
    ├─ chat.jsonl
    │   └─ 对话和游玩记录
    │
    ├─ cache/
    │   └─ 运行缓存
    │
    └─ *-proposals.jsonl
        └─ 等待审核的改动
```

简单理解：

```text
shared   = 正式设定
runtime  = 体验过程
cache    = 临时缓存
proposal = 等你批准的变化
```

---

## 项目结构

```text
world-tree/
│
├─ README.md
├─ README.en.md
├─ CHANGELOG.md
├─ AI-GUIDE.md
│
├─ world-tree-console.html
│   └─ 网页界面
├─ world-tree-console.css
│   └─ 样式
├─ world-tree-console.js
│   └─ 前端交互
│
├─ server.js
│   └─ 本地服务入口
│
├─ src/
│   ├─ server/
│   │   ├─ 项目读写
│   │   ├─ 文件安全
│   │   ├─ 项目导入导出
│   │   └─ 本地接口服务
│   │
│   └─ core/
│       ├─ system/
│       │   ├─ 模式入口
│       │   ├─ 运行调度
│       │   ├─ 存档写入
│       │   ├─ 提案审核
│       │   └─ 隐藏信息隔离
│       │
│       ├─ prompts/
│       │   └─ 各模式给 AI 的提示规则
│       │
│       ├─ modes/
│       │   └─ 模式登记、项目初始化、运行基础
│       │
│       ├─ character/
│       │   └─ 人物卡体验
│       │
│       ├─ worldbook/
│       │   └─ 世界书基础
│       │
│       ├─ grand-world/
│       │   └─ 世界书大世界
│       │
│       ├─ tabletop/
│       │   └─ 桌面叙事
│       │
│       ├─ mystery-puzzle/
│       │   └─ 解谜调查
│       │
│       ├─ strategy-sim/
│       │   └─ 策略模拟
│       │
│       ├─ murder-mystery/
│       │   └─ 单人剧本杀
│       │
│       ├─ creation-forge/
│       │   └─ 炼金台
│       │
│       ├─ engine/
│       │   └─ 旧兼容引擎，不建议随意删除
│       │
│       └─ data/
│           └─ 旧数据和兼容资产
│
├─ docs/
│   ├─ INDEX.md
│   ├─ PROJECT_OVERVIEW.md
│   ├─ FEATURES.md
│   ├─ ARCHITECTURE_V1.md
│   ├─ API_REFERENCE.md
│   ├─ SAVE_SYSTEM_AND_WORLD_PACK.md
│   ├─ DOCUMENTATION_STATUS.md
│   ├─ LEGACY_REDUNDANCY_AUDIT.md
│   └─ LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md
│
├─ scripts/
│   └─ 检查、测试和审计脚本
│
└─ tests/
    ├─ unit/
    └─ integration/
```

---

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` | 启动本地体验 |
| `npm run test:unit` | 运行单元测试 |
| `npm run test:integration` | 运行集成测试 |
| `npm run docs:check` | 检查文档状态 |
| `npm run legacy:check` | 检查旧文件分类说明 |
| `npm run preflight` | 提交前综合检查 |

普通用户只需要：

```bash
npm install
npm start
```

开发者提交前建议：

```bash
npm run preflight
npm run legacy:check
```

---

## 更多文档

| 文档 | 内容 |
| --- | --- |
| `docs/INDEX.md` | 文档总入口 |
| `docs/PROJECT_OVERVIEW.md` | 项目总览 |
| `docs/FEATURES.md` | 功能说明 |
| `docs/ARCHITECTURE_V1.md` | 当前结构 |
| `docs/API_REFERENCE.md` | 接口说明 |
| `docs/SAVE_SYSTEM_AND_WORLD_PACK.md` | 存档与导入导出 |
| `docs/DOCUMENTATION_STATUS.md` | 文档状态 |
| `AI-GUIDE.md` | 给 AI Agent 的操作说明 |

README 只介绍如何理解和开始体验项目。维护策略、兼容层、历史文档和测试细节请看 `docs/` 目录。

## 给维护者和 AI Agent

本项目有完整的架构、工作流、资产、测试和保护规则文档，位于 `docs/` 目录。维护和开发请从 `docs/INDEX.md` 开始，AI Agent 操作规则见 `docs/AI_AGENT_OPERATING_GUIDE.md`。

当前能力状态：P0-P2 Kernel、Prompt Orchestration、P3 机制扩展、资产成熟化、工作流接入层、Real Play Productization 0-3 薄切片均已完成。详见 `docs/CURRENT_PROJECT_STATE.md`。

---

## License

请以仓库中的 `LICENSE` 文件为准。若仓库尚未声明许可证，请在公开发布或分发前补充明确的许可证说明。

## V2 Entry Closure
Tabletop V2 | Detective V2 | Character V2 | 单人剧本杀 V2
