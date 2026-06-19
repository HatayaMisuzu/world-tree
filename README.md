# World Tree

本地优先的 AI 叙事引擎与 Web 控制台。

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Version](https://img.shields.io/badge/version-v0.3.0-blue.svg)

**当前版本: v0.3.0**

`v0.3.0` 聚焦本地优先的 AI 文字交互工作台底座：首次启动、模型连接诊断、创建或导入项目、第一轮可保存对话、审核变更和 `.worldtree` 导入导出。插件生态、社区市场和完整示例世界内容暂缓为独立后续工程。

World Tree 用一个普通的 Node.js 本地服务，把世界书、角色卡、叙事状态、对话历史和 LLM 调用组织在一起。它面向长篇互动叙事、角色扮演、世界设定管理和创作实验；默认只在本机运行，不依赖 Electron，也不绑定任何特定云服务。

English documentation: [README.en.md](README.en.md)

## 适合谁

- AI 设定爱好者：整理角色、世界观、组织、地点、规则、关系链与剧情素材。
- 文字冒险游戏爱好者：像玩文字冒险 / 互动小说一样输入行动，让 AI 推进世界。
- 轻度用户：不想研究复杂引擎，只想粘贴设定、配置模型、开始游玩。
- 互动小说 / RP / 跑团创作者：维护长期剧情、角色状态、世界书与分支。
- 本地 AI 用户：希望世界、角色、对话、审核记录都保存在本机。
- 未来 AI 文字交互游戏玩家与制作者：面向 AI 文字 RPG、推理、恋爱模拟、世界探索、跑团等玩法原型。
- 开发者与研究者：研究世界书、状态机、LLM 叙事管线和本地叙事引擎。

## 当前版本重点

`0.3.0` 是本地优先工作台基线版：模型连接测试会返回逐项诊断和建议；快速开始会创建可保存的草稿世界；炼金台与 overlay 提议会进入世界自己的 `runtime/pending.jsonl` / `manual.jsonl` 审核事实源；采纳前会生成快照；`.worldtree` 导入导出、安全路径校验、Dashboard telemetry、Guardian 和 overlay pending 都纳入测试门禁。

- 角色库：批量导入 SillyTavern v2/v3 JSON，并尝试解析带 `chara` 元数据的 PNG 角色卡；支持标签和说明编辑。
- 世界书编辑器：新增、编辑、停用、删除、分组、批量导入导出条目，并测试触发命中和排序原因。
- 连接档案：管理 DeepSeek、OpenAI-compatible、OpenRouter、Ollama、Claude-compatible 等连接模板，并提供 Base URL、API Key、模型和 chat/completions 的诊断结果。
- 聊天基础操作：复制、编辑、删除、收藏，以及助手候选回复 swipe 持久化和轻量分支索引。
- 叙事黑盒：查看世界书命中、角色状态、记忆快照、Direction Packet、Guardian 结果和可读时间线。
- 炼金台审核队列：提取结果先进入审核事实源，支持采纳、拒绝和编辑后采纳，确认后才写入正式世界数据。
- `.worldtree` 世界包：导出/导入世界设定、角色、世界书和来源说明，默认排除 secrets 与私密 runtime，并支持导出范围选择。

## 当前边界

项目仍处在早期整理阶段：

- 不内置故事、案例、角色卡等原创素材；`defaults/examples/manifest.json` 当前为空。
- 当前版本不内置完整示例世界。示例世界将作为独立后续工程，在世界书和内容授权确认后再加入。
- 默认面向本机使用，安全边界请先阅读 [SECURITY.md](SECURITY.md)。
- LLM 需要用户自行配置 API Key；支持 OpenAI 兼容接口。
- 数据格式会继续演进，重要项目请自行备份。

你不需要一开始就准备完整世界书。v0.3.0 支持先用粘贴素材创建草稿世界，之后再逐步整理角色、世界书、审核记录和导出包。

## 快速开始

需要 Node.js 18 或更高版本。

```bash
git clone https://github.com/HatayaMisuzu/world-tree.git
cd world-tree
npm install
npm start
```

启动后打开：

```text
http://localhost:3000
```

也可以直接运行：

```bash
node server.js
```

发布到 npm 后，预期可用：

```bash
npx world-tree
```

## 配置 LLM

首次启动后，在 Web 控制台中填写 LLM 配置。默认配置面向 DeepSeek，也可以换成任意 OpenAI 兼容服务。

| 配置项 | 默认值 |
| --- | --- |
| Base URL | `https://api.deepseek.com/v1` |
| Model | `deepseek-v4-flash` |
| API Key | 本机保存，不进入仓库 |

本地模型服务也可以使用 OpenAI 兼容地址，例如：

```text
http://localhost:11434/v1
```

可以参考 [config.example.json](config.example.json) 创建自己的本地配置。不要提交真实 API Key。

## 核心能力

- **世界书模式**：以世界设定、规则、角色、组织、时间线和状态为核心运行长篇叙事。
- **角色卡模式**：以角色人格、说话风格和互动边界为核心进行 RP。
- **预设模式**：用轻量配置快速测试叙事风格和玩法原型。
- **内容炼金台**：把粘贴的设定、小说片段、角色资料或世界书材料解析成结构化数据。
- **审核队列**：炼金台提取结果默认先入队，用户采纳后才写入正式世界。
- **连接档案**：在本机管理多个模型服务配置，密钥独立保存在 secrets，并提供逐项连接诊断。
- **世界包**：用 `.worldtree` 交换世界设定和 shared 数据，默认不包含私密运行记录。
- **双段式叙事管线**：先生成方向包，再由 LLM 写作，并通过守门人检查输出。
- **本地持久化**：对话、记忆、世界状态和引擎增量写入本地 JSON/JSONL 文件。
- **健康诊断**：`/api/health` 返回版本、LLM 配置、密钥状态、数据目录和本地数据概览。

> 插件系统当前暂缓，不属于 v0.3.0 主线。仓库中可能保留部分内部预留代码，但默认 UI 不开放插件入口，也不建议用户在当前版本依赖插件能力。

## 数据如何保存

World Tree 的核心原则是“一个世界就是一个文件夹”。世界数据默认保存在本地数据目录中，每个模组独立存放：

```text
{world}/
├── world.json
├── shared/
│   ├── worldbook.json
│   ├── characters.json
│   ├── scenes.json
│   ├── organizations.json
│   ├── relations.json
│   ├── timeline.json
│   └── world_state.json
└── runtime/
    ├── chat.jsonl
    ├── memory.jsonl
    ├── state.json
    ├── source.txt
    ├── pending.jsonl
    ├── manual.jsonl
    ├── review-log.jsonl
    ├── snapshots/
    └── overlay/
```

这些运行数据属于用户内容，默认不会进入 npm 包或 Git 仓库。

## 主要 API

| 端点 | 说明 |
| --- | --- |
| `/api/characters/import` / `/api/characters/update` | 导入 ST v2/v3 JSON 或 PNG metadata 角色卡，更新角色标签和说明 |
| `/api/worldbook` | 读取和保存当前世界书 |
| `/api/worldbook/test` | 测试世界书触发 |
| `/api/connections` | 管理连接档案 |
| `/api/llm/test` | 测试当前模型连接并返回逐项诊断 |
| `/api/chat/message` | 编辑、删除、收藏和候选回复管理 |
| `/api/turn/debug` | 读取本轮叙事黑盒 |
| `/api/alchemy/review` | 审核队列读写 |
| `/api/review/pending` / `/api/review/adopt` / `/api/review/reject` | 读取、采纳或拒绝世界 runtime 审核事实源 |
| `/api/world-pack/export` / `/api/world-pack/import` | `.worldtree` 世界包导入导出 |

## 项目结构

```text
server.js                  本地 HTTP 服务与 REST API
world-tree-console.html    Web 控制台结构
world-tree-console.css     Web 控制台样式
world-tree-console.js      Web 控制台逻辑
bin/world-tree.js          命令行启动入口
src/adapters/llm.js        OpenAI 兼容 LLM 适配器
src/core/world-engine.js   叙事上下文与 prompt 构建入口
src/core/engine/           叙事引擎、守门人、状态、记忆和模式模块
src/core/data/             内容导入、角色卡、世界书和结构化数据工具
defaults/engine-profile/   引擎运行配置
defaults/world-profiles/   内置模式配置
defaults/examples/         示例素材清单入口（当前为空）
tests/unit/                单元测试
scripts/                   审计、接口联动和发布前检查脚本
```

## 常用命令

```bash
npm start               # 启动本地 Web 控制台
npm test                # 集成/语法测试
npm run test:unit       # 单元测试
npm run audit           # 版本、目录、安全和开源卫生审计
npm run interface-audit # API 与文件 IO 联动检查
npm run preflight       # 发布前总检查
```

建议每次提交前运行：

```bash
npm run preflight
```

## 内容与素材政策

开源包不附带来源未确认的故事、案例、角色卡或知识库材料。后续如果加入示例素材，需要同时满足：

- 素材来源明确，可公开分发。
- 在 [docs/content-provenance.md](docs/content-provenance.md) 登记来源与许可。
- 在 `defaults/examples/manifest.json` 中登记安装入口。

你自己的世界、角色卡和运行记录应保存在本地数据目录，不应直接提交到公开仓库。

## 安全说明

- 本项目默认用于本机 `localhost`。
- API Key 保存在本机用户数据目录，不应提交到 Git。
- `.gitignore` 已忽略常见密钥、配置和运行数据路径。
- 详细边界见 [SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎通过 Issue 和 Pull Request 参与。提交前请先跑通：

```bash
npm run preflight
```

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT License. 详见 [LICENSE](LICENSE)。
