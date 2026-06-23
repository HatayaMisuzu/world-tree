# World Tree

本地优先的 AI 多模式叙事与创作工作台。

World Tree 不是一个单纯的聊天页面，而是一套面向创作项目的本地工作台。你可以用它创建角色、整理世界书、进行大世界探索、跑单人桌面叙事、做解谜调查、模拟策略局势、设计单人剧本杀，也可以用"炼金台"把一段灵感转换成可继续运行的项目资产。

> **Package version**: v0.3.0  
> **Functional milestone**: V1 full-closure / Release Candidate  
> **运行方式**: 本地优先，默认仅监听 `127.0.0.1`

---

## 它能做什么？

```text
灵感 / 设定 / 角色 / 世界观
        │
        ▼
 World Tree 本地工作台
        │
        ├─ 快速设定
        ├─ 人物卡
        ├─ 世界书大世界
        ├─ 桌面叙事
        ├─ 解谜调查
        ├─ 策略模拟
        ├─ 单人剧本杀
        └─ 炼金台
        │
        ▼
 项目存档 / 审核提案 / 导入导出 / 测试检查
```

World Tree 的目标是让 AI 创作不只停留在一次对话里，而是能形成一个可以保存、继续、审核和扩展的本地项目。

---

## 功能入口

| 入口 | 内部 ID | 作用 | 状态 |
| --- | --- | --- | --- |
| 快速设定 | `quick-setting` | 粘贴一段设定，快速生成项目草稿 | Active |
| 人物卡 | `character` | 创建角色资料、性格、说话风格和互动边界 | Active |
| 世界书大世界 | `world-rpg` | 基于世界书进行持续探索、事件变化和关系推进 | Active |
| 桌面叙事 | `tabletop` | 单人跑团感叙事，AI 负责主持、判定和推进 | Active |
| 解谜调查 | `mystery-puzzle` | 场景调查、线索收集、假说、提示和答案锁 | Active |
| 策略模拟 | `strategy-sim` | 阵营、资源、局势、回合和世界反馈 | Active |
| 单人剧本杀 | `murder-mystery` | 案件、嫌疑人、证词、真相锁和推理复盘 | Active |
| 炼金台 | `creation-forge` | 把灵感炼成角色、世界书、剧本或项目包 | Active / Producer |

说明：

- `world-rpg` 是历史内部 ID。它现在的产品含义是"世界书大世界"，不是传统 RPG。
- `creation-forge` 是"炼金台"，负责生产和转换资产，不是普通玩法模式。
- 旧 engine 和旧 API 仍保留为兼容层，不建议随意删除。

---

## 当前项目状态

| 项目状态 | 说明 |
| --- | --- |
| 功能里程碑 | V1 full-closure / Release Candidate |
| 文档体系 | 已重写并接入检查 |
| 单元测试 | 已清理旧债务，当前报告为全绿 |
| 集成测试 | 已清理旧债务，当前报告为全绿 |
| Legacy 文件 | 已盘点并分类，不删除，作为兼容资产或历史记录 |
| 导入导出 | 当前为 snapshot / legacy bridge 形态，完整说明见文档 |
| 云端 CI | 当前未见 GitHub Actions 运行记录；本地 preflight 是主要验证来源 |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动本地服务

```bash
npm start
```

默认访问：

```text
http://127.0.0.1:3000
```

默认服务只绑定本机地址，适合本地个人创作使用。

---

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` | 启动本地服务 |
| `npm run docs:check` | 检查文档是否和当前项目状态一致 |
| `npm run legacy:check` | 检查旧文件分类和兼容说明 |
| `npm run test:unit` | 运行单元测试 |
| `npm run test:integration` | 运行集成测试 |
| `npm run audit` | 项目结构审计 |
| `npm run interface-audit` | 接口和文件读写检查 |
| `npm run preflight` | 提交前总检查 |

推荐提交前运行：

```bash
npm run preflight
npm run legacy:check
```

---

## 项目如何存档？

一个 World Tree 项目大致是这样的：

```text
project/
│
├─ world.json
│   └─ 项目基础信息
│
├─ shared/
│   └─ 正式设定：角色、世界书、场景、关系、时间线等
│
└─ runtime/
    ├─ chat.jsonl
    │   └─ 对话记录
    │
    ├─ cache/
    │   └─ 各模式缓存
    │
    └─ *-proposals.jsonl
        └─ 等待审核的 AI 改动
```

简单理解：

```text
shared   = 正式档案
runtime  = 运行过程
cache    = 可重建缓存
proposal = 等你批准的改动
```

重要设定不会让 AI 直接乱写进正式文件。AI 生成的关键变化会先进入提案，用户批准后才写入正式内容。

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
├─ public/
│   └─ 前端页面
│
├─ server.js
│   └─ 本地服务入口
│
├─ src/
│   ├─ server/
│   │   ├─ 文件读写
│   │   ├─ 项目创建
│   │   ├─ 安全路径
│   │   └─ 导入导出
│   │
│   └─ core/
│       ├─ system/
│       │   └─ 路由、运行、存档、提案
│       │
│       ├─ prompts/
│       │   └─ 各模式给 AI 的提示词规则
│       │
│       ├─ modes/
│       │   └─ 模式登记、项目初始化和运行基础
│       │
│       ├─ character/
│       ├─ worldbook/
│       ├─ grand-world/
│       ├─ tabletop/
│       ├─ mystery-puzzle/
│       ├─ strategy-sim/
│       ├─ murder-mystery/
│       └─ creation-forge/
│
├─ docs/
│   └─ 项目文档、接口文档、架构说明、历史文件状态
│
├─ scripts/
│   └─ 检查脚本和审计脚本
│
└─ tests/
    └─ 单元测试和集成测试
```

---

## 核心设计

World Tree 的核心思路是：

```text
一个共享底座
+
多个独立创作入口
+
统一存档
+
提案审核
```

每个入口都有自己的运行空间：

```text
人物卡       → 角色资料和表达风格
大世界       → 世界变化和探索记录
桌面叙事     → 判定、事件和主持反馈
解谜调查     → 线索、提示和答案锁
策略模拟     → 阵营、资源和局势
剧本杀       → 案件、嫌疑人和真相锁
炼金台       → 把灵感生产成资产
```

这样做的好处是：

- 不同功能不会互相污染。
- 隐藏真相不会直接暴露给玩家。
- AI 的重要改动要先经过审核。
- 旧文件可以保留为兼容层，不影响新结构继续演进。

---

## 接口概览

常用接口包括：

| 接口 | 作用 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `GET /api/routes` | 查看可用模式入口 |
| `GET /api/projects/:projectId/summary` | 获取项目摘要 |
| `POST /api/projects/:projectId/turn` | 运行一次模式回合 |
| `GET /api/projects/:projectId/proposals` | 查看待审核提案 |
| `POST /api/projects/:projectId/proposals/:proposalId/approve` | 批准提案 |
| `POST /api/projects/:projectId/proposals/:proposalId/reject` | 拒绝提案 |
| `POST /api/world-pack/export` | 导出项目包 / 快照桥接 |
| `POST /api/world-pack/import` | 导入项目包 / 快照桥接 |

完整接口请看：

```text
docs/API_REFERENCE.md
```

---

## 文档入口

| 文档 | 作用 |
| --- | --- |
| `docs/INDEX.md` | 文档总目录 |
| `docs/PROJECT_OVERVIEW.md` | 项目总览 |
| `docs/FEATURES.md` | 功能清单 |
| `docs/ARCHITECTURE_V1.md` | V1 结构说明 |
| `docs/API_REFERENCE.md` | 接口说明 |
| `docs/SAVE_SYSTEM_AND_WORLD_PACK.md` | 存档和导入导出说明 |
| `docs/PROPOSAL_AND_REVIEW_SYSTEM.md` | 提案审核说明 |
| `docs/SCRIPTS_AND_CHECKS.md` | 检查脚本说明 |
| `docs/DOCUMENTATION_STATUS.md` | 文档状态表 |
| `docs/LEGACY_REDUNDANCY_AUDIT.md` | 旧文件审计 |
| `docs/LEGACY_COMPATIBILITY_AND_UPGRADE_PLAN.md` | 旧兼容层升级计划 |

---

## 给 AI Agent 的规则

如果你是 Hermes、Codex 或其他 AI agent，请先读：

```text
AI-GUIDE.md
docs/AI_AGENT_OPERATING_GUIDE.md
docs/DOCUMENTATION_STATUS.md
```

最重要的规则：

```text
1. 不要删除 legacy 文件。
2. 不要把历史设计文档当当前真相源。
3. 不要让 AI 直接改 shared 正式文件。
4. 重要改动必须走 proposal。
5. 不要把 world-rpg 当传统 RPG。
6. 不要把 creation-forge 当普通玩法入口。
7. 修改后必须跑测试和 preflight。
```

---

## Legacy 文件策略

World Tree 里保留了一些历史文件和旧兼容层。它们不是垃圾文件。

当前策略是：

```text
不删除
先分类
再标注
能复用的作为兼容层
不能代表当前状态的作为历史记录
```

常见状态：

| 状态 | 含义 |
| --- | --- |
| `current-source` | 当前真相源 |
| `active-compatibility` | 仍在使用的兼容层 |
| `legacy-bridge` | 旧 API 或旧路径桥接 |
| `archived-design` | 历史设计记录 |
| `superseded-reference` | 已被新文档替代，但仍有参考价值 |
| `test-fixture` | 测试夹具 |
| `orphan-candidate` | 疑似孤立，先标注，不删除 |

---

## 当前边界

World Tree V1 不是：

```text
多人在线平台
完整游戏引擎
插件市场
视觉编辑器
商用发布系统
完整云端服务
```

它现在更准确的定位是：

```text
本地个人 AI 创作工作台。
```

---

## 更新检查

提交前建议运行：

```bash
npm run docs:check
npm run legacy:check
npm run test:unit
npm run test:integration
npm run preflight
```

如果这些检查都通过，说明当前项目的文档、功能入口、测试和兼容说明大体一致。

---

## License

请以仓库中的 `LICENSE` 文件为准。若仓库尚未声明许可证，请在公开发布或分发前补充明确的许可证说明。
