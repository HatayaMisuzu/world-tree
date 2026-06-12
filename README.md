# World Tree

本地优先的 AI 叙事引擎 **Web 控制台**。纯浏览器访问，无需 Electron。

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Version](https://img.shields.io/badge/version-v2.3.1-blue.svg)

**当前版本: v2.3.1** 🎉

更多安全边界见 [SECURITY.md](SECURITY.md)，贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

English documentation: [README.en.md](README.en.md)

---

## 快速开始

```bash
cd <ROOT>
npm install        # 仅首次
node server.js     # 启动 Web 服务器
# → http://localhost:3000
```

也可以在发布到 npm 后使用：

```bash
npx world-tree
```

**默认模型**: DeepSeek (`deepseek-v4-flash`) · 默认地址: `https://api.deepseek.com/v1`

---

## 架构

```
浏览器 (world-tree-console.html)
  │  fetch() REST API
  ▼
server.js (Node.js HTTP 服务器)
  │
  ├─ /api/config              配置读写
  ├─ /api/secrets             密钥管理
  ├─ /api/llm/test            LLM 连接测试
  ├─ /api/llm/chat            🆕 直连 LLM 叙事对话（含角色卡模式）
  ├─ /api/modules             🆕 模组列表/创建/删除
  ├─ /api/modules/{id}/history 🆕 对话历史加载
  ├─ /api/examples            素材示例清单（当前为空，等待维护者提供）
  ├─ /api/examples/install    按 manifest 将素材复制到本地数据目录
  ├─ /api/alchemy/digest      🆕 炼金台→模组/角色卡创建
  ├─ /api/alchemy/import      🆕 炼金台分析
  ├─ /api/characters          🆕 角色卡管理（data/engine/characters）
  ├─ /api/engine/manifest     引擎版本+模块清单
  └─ → 直调 DeepSeek / OpenAI 兼容 API
```

---

## 三模式（数据层）

| 模式 | DM 角色 | 适用场景 |
|------|---------|----------|
| **世界书** | 完整 DM | 长篇叙事、世界设定驱动 |
| **角色卡** | 隐退（纯 RP） | 一对一角色扮演 |
| **预设** | 轻量 | 快速原型、少量设定 |

---

## 双段式叙事管线

```
用户输入
  → Director DM（JS/LLM 混合）→ Direction Packet
  → Story Writer（LLM）→ 【叙事】+【状态建议】+【情绪反馈】
  → Guardian（JS 优先，<50 分自动 LLM 修正）→ completeTurn → 自动存档
```

---

## 内容炼金台

粘贴文档（小说/设定/角色卡）→ 自动解析角色/地点/组织 → 创建模组 → 直接对话。

当前开源包不内置故事、案例或角色卡素材。`defaults/examples/manifest.json` 只保留空清单，后续由维护者提供并在 [docs/content-provenance.md](docs/content-provenance.md) 登记来源后再加入。

```
POST /api/alchemy/digest
  1. 引擎解析 → items[]
  2. items → worldbook entries + characters + locations + orgs
  3. 写入 shared/worldbook.json + shared/characters.json + ...
  4. 返回模组信息 → 出现在模组列表
```

---

## 全链路持久化

每轮对话自动写入：

| 文件 | 内容 | 写入方式 |
|:----|:-----|:----|
| `runtime/chat.jsonl` | 对话记录（用户+助手） | 追加 |
| `runtime/memory.jsonl` | 叙事记忆快照 | 追加 |
| `runtime/state.json` | 完整引擎状态+情绪 | 覆盖 |
| `runtime/overlay/` | 引擎增量数据 | 合并/追加 |
| `world.json` | 轮次计数+时间戳 | 覆盖 |

选择模组时自动加载最近 50 轮历史 + 恢复引擎状态。

---

## 模组文件格式

```
{name}/
├── world.json                    ← 元数据
├── shared/                       ← 静态数据
│   ├── worldbook.json            ← 世界观条目
│   ├── characters.json           ← 角色
│   ├── scenes.json / locations.json
│   ├── organizations.json / relations.json
│   ├── timeline.json / world_state.json
│   ├── races.json / rules.json
├── runtime/                      ← 持久化
│   ├── state.json                ← 引擎状态
│   ├── chat.jsonl                ← 对话
│   ├── memory.jsonl              ← 记忆
│   └── overlay/                  ← 引擎增量
```

一个世界 = 一个文件夹 = 可复制、可备份、可分享。

---

## 核心模块

| 模块 | 内容 | 状态 |
|------|------|:----:|
| M1 | 世界书隔离容器 | ✅ |
| M2 | 触发式条目（精确/语义/向量匹配） | ✅ |
| M3-M10 | 世界状态、组织、角色、认知、种族 | ✅ |
| M11 | 场景会话管理 | ✅ |
| M12 | 故事模板 | ✅ |
| M13 | 五层叙事引擎 | ✅ |
| M15 | 世界规则 + 叙事质量审查 | ✅ |
| M16-M18 | 时间、随机事件、场景预测 | ✅ |
| M19 | 角色卡驱动模式 | ✅ |
| M-创作 | 六阶段创作向导 | ✅ |
| 内容炼金台 | 外部文档自动拆解导入 + 角色卡VC-3人格提炼 | ✅ |
| 上下文引擎 | 统一全文检索+定向查表+合并排序（world-engine 当前调用） | ✅ |
| 枝干系统 | 四态管理+嫁接合并 | ✅ |
| 世界脉象 | 15维度叙事KPI+趋势追踪 | ✅ |
| 角色卡引擎 | VC-3人格提炼+本地角色卡管理+人称规则修正 | ✅ |

---

## 质量保障

```bash
npm test              # 84 项集成/语法测试
npm run check         # 关键文件存在性 + 无副作用核心模块导入检查
npm run test:unit     # 51 项单元测试（Node 18+ 原生 test runner）
npm run audit         # 版本一致性 / 危险路径 / 目录结构
npm run interface-audit # 接口联动审计（IO校准/API契约/engineState链路）
npm run preflight     # audit + check + test + interface-audit 一键跑通
```

## 安全与诊断

- 服务仅面向本机使用，安全边界见 [SECURITY.md](SECURITY.md)。
- `/api/health` 会返回版本、LLM 配置状态、API Key 是否存在、数据目录可写性和本地数据概览。
- 错误响应包含 `userMsg`（给用户看的说明）和 `detail`（技术排障信息，前端写入 console）。

---

## 源码结构

```
world-tree-console.html   Web UI 结构入口（~1.5KB）
world-tree-console.css    独立样式表（~14KB）
world-tree-console.js     独立脚本（~59KB）
server.js                 HTTP 服务器（REST API）
src/
  adapters/llm.js         三角色LLM + 双段式管线
  core/
    world-engine.js       引擎入口 + Prompt构建
    engine/               引擎核心（25+ 文件）
      constants.js        集中可调参数（~200行）
      state-persistence.js 引擎状态统一导出/导入层
      director.js         叙事导演层 + 事件评分 + 节奏控制
      guardian.js         JS守门人校验 + LLM自动修正
      lifecycle.js        回合生命周期（prepareTurn/completeTurn）
      ...
    data/                 数据模块（17 文件）
      skill-generator.js  VC-3 人格提炼引擎
      skill-parser.js     SKILL.md → JSON 解析桥
tests/
  unit/                   单元测试（4 文件，51 条）
    emotion-state.test.js   情绪状态机
    direction-packet.test.js 方向包
    output-parser.test.js   输出解析器
    guardian.test.js        守门人校验
scripts/
  test.mjs                84 项集成/语法测试
  check.mjs               关键文件和核心模块导入检查
  audit.mjs               项目审计
  interface-audit.mjs     接口联动审计
data/
  engine/characters/      炼金台产出角色卡（card.json + runtime/）
defaults/
  engine-profile/         引擎运行配置
  world-profiles/         内置模式配置
  examples/manifest.json  素材清单入口（当前为空）
```
