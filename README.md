# World Tree Desktop

本地优先的 AI 叙事引擎 **Web 控制台**。纯浏览器访问，无需 Electron。

**Current version: v2.2.1** 🎉

---

## 快速开始

```bash
npm install        # 仅首次
node server.js     # 启动 Web 服务器
# → http://localhost:3000
```

**默认模型**: DeepSeek (`deepseek-v4-flash`) · 默认地址: `https://api.deepseek.com/v1`

---

## 架构

```
| 浏览器 (world-tree-console.html)
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
  ├─ /api/alchemy/digest      🆕 炼金台→模组/角色卡创建
  ├─ /api/alchemy/import      🆕 炼金台分析
  ├─ /api/characters          🆕 角色卡双来源（Hermes skills + 炼金台产出）
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
| 上下文引擎 | 统一全文检索+定向查表+合并排序 | ✅ |
| 枝干系统 | 四态管理+嫁接合并 | ✅ |
| 世界脉象 | 15维度叙事KPI+趋势追踪 | ✅ |
| 角色卡引擎 | VC-3人格提炼+双来源管理+人称规则修正 | ✅ |

---

## 质量保障

```bash
npm test              # 75 项集成测试
npm run audit         # 版本一致性 / 危险路径 / 目录结构
npm run interface-audit # 🆕 接口联动审计（IO校准/API契约/engineState链路）
npm run preflight     # audit + test + interface-audit 一键跑通
```

---

## 源码结构

```
world-tree-console.html   唯一 Web UI
server.js                 HTTP 服务器（REST API）
src/
  adapters/llm.js         三角色LLM + 双段式管线
  core/
    world-engine.js       引擎入口 + Prompt构建
    engine/               引擎核心（director/guardian/lifecycle…）
    data/                 数据模块（worldbook/character-card/alchemy…）
      skill-generator.js  🆕 VC-3 人格提炼引擎
      skill-parser.js     🆕 SKILL.md → JSON 解析桥
scripts/
  test.mjs                75 项集成测试
  audit.mjs               项目审计
  interface-audit.mjs     🆕 接口联动审计
data/
  engine/characters/       🆕 炼金台产出角色卡（card.json + runtime/）
defaults/                 知识库 / 配置 / 剧本杀案例
```
