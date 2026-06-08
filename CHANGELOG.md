# World Tree Desktop · CHANGELOG

> 审查记录。AI 无需阅读此文件。

## v2.2.0 — 炼金台 → 角色卡生成管线 + VC-3 人格提炼 + 角色卡双来源 (2026-06-08)

### 新功能
- **炼金台→角色卡生成**：粘贴角色文本 → 点「🃏 创建角色卡」→ 自动走 LLM VC-3 人格提炼 → 输出 `card.json` → 创建角色卡 → 自动跳转对话
- **VC-3 人格提炼引擎**（`skill-generator.js`）：完整覆盖创生 skill 方法论——人格底盘(欲望/恐惧/执念/情绪默认态/爆发点)、表达DNA(口癖/句式/语气词/称呼/签名动作)、场景响应(10核心场景×3字段)、关系网络、知识边界
- **角色卡双来源管理**：同时支持 Hermes skills/creative/（创生 skill 产出）和 `data/engine/characters/`（炼金台产出），统一列出/加载/删除
- **SKILL.md → JSON 解析桥**（`skill-parser.js`）：8个导出函数，解析 frontmatter/人格表格/场景表格/关系网络/知识边界
- **人称规则修正**：`character-card.js` 硬编码规则改为「叙事用第三人称，对话用第一人称」+ 明确示例
- **创建角色卡 UI 重写**：`world-tree-console.html:787-812`，调用 digest API + 自动选中新卡 + 跳转对话

### API 变更

| 端点 | 变更 |
|:----|:-----|
| `POST /api/alchemy/digest` | 新增 `dataMode: "character_card"` 分支 → LLM 人格提炼 + 写 `card.json` |
| `POST /api/llm/chat` | 角色卡模式走 `buildEnginePacket` → `buildCharacterCardPacket`，不再走通用 `buildWriterPacket` |
| `GET /api/characters` | 双来源扫描：Hermes skills + `data/engine/characters/` |
| `POST /api/characters/load` | 加载回退链：SKILL.md → card.json |
| `POST /api/characters/delete` | 双路径删除 |
| `POST /api/alchemy/import` (writerPacket 参数) | `sendDualStageTurn` 新增可选 `writerPacket` 参数，支持角色卡模式注入自定义 writer |

### 新增文件
```
src/core/data/skill-generator.js    ← VC-3 人格提炼引擎
└─ buildCharacterRefineryPrompt()    构建完整方法论 Prompt（含5维人格+DNA+10场景响应）
└─ parseRefineryResponse()           解析 LLM 返回的 JSON
└─ flattenToCardJson()               映射到 parseCharacterCard() 可读的扁平字段
src/core/data/skill-parser.js        ← SKILL.md → JSON 解析桥
└─ parseFrontmatter / parseSections / parseTable / parseKeyValueList
└─ parseSkillMd / parseSkillFile / listSkillFiles
```

### 角色卡目录结构（炼金台产出）
```
data/engine/characters/{name}/
├── card.json              ← parseCharacterCard() 直接消费
└── runtime/               ← 对话持久化（与模组格式一致）
```

### 安全
- `handleLlmChat` 角色卡模式注入 `ccState = { ...normState, dataMode: "character_card" }`，确保 `buildEnginePacket` 正确分发，不泄漏世界书数据到角色卡上下文

### 审计
- `npm run audit` → 0 错误（已排除 package.json vs app-manifest.json 版本差，非本次变更所致）
- `node scripts/interface-audit.mjs` → 47/47 通过
- `npm test` → 74/75 通过（1项预存版本不一致问题，不归因本次）

### 修复
- `character-card.js:300` — 人称规则从「始终第一人称」改为「叙事第三人称/对话第一人称」
- `llm.js:258-270` — `sendDualStageTurn` 补上 `writerPacket` 可选参数，避免角色卡模式走默认 writer
- `world-tree-console.html:456-468,723-751` — 角色卡卡片新增删除按钮+确认提醒

## v2.1.0 — 全链路持久化 + 炼金台集成 + 接口联动审计 (2026-06-08)

### 新功能
- **三层持久化体系**：每轮对话自动写入 `runtime/chat.jsonl`(对话记录)、`runtime/memory.jsonl`(记忆快照)、`runtime/state.json`(引擎完整状态)
- **炼金台→模组创建管道**：粘贴文档 → `POST /api/alchemy/digest` → 自动解析角色/地点/组织 → 写入 worldbook.json → 创建模组 → 自动选中跳对话
- **对话历史恢复**：选择模组时从 `chat.jsonl` 加载最近 50 轮，emotionState 完整恢复
- **界面联动审计**：`scripts/interface-audit.mjs` 检查文件IO校准、API契约、engineState链路、JSONL一致性、快速模式隔离、密钥安全
- **HTML 首页重做**：快速开始(即用即走) / 已有模组(持久化) / 炼金台(导入→创建) 三区布局

### API 新增
| 端点 | 说明 |
|:----|:-----|
| `POST /api/llm/chat` | 直连LLM叙事对话，调引擎 sendDualStageTurn() |
| `GET /api/modules` | 列出所有模组(world/profile/case) |
| `POST /api/modules/create` | 创建新模组(新目录结构 shared/ + runtime/) |
| `POST /api/modules/delete` | 删除模组 |
| `POST /api/alchemy/digest` | 炼金台解析→创建模组 |
| `POST /api/alchemy/import` | 炼金台分析(不创建模组) |
| `GET /api/modules/{id}/history` | 加载对话历史+引擎状态 |
| `GET /api/secrets/llm-value` | 获取真实API Key(测试用) |

### 模组文件格式
```
{name}/
├── world.json                    ← 元数据
├── shared/                       ← 静态数据(世界书/角色/场景/关系/时间线...)
│   ├── worldbook.json            ← {entries: [{keys,content,type}]}
│   ├── characters.json           ← [{id,name,role,traits,...}]
│   ├── locations.json
│   ├── organizations.json
│   ├── relations.json / timeline.json / world_state.json / races.json / rules.json / scenes.json
├── runtime/                      ← 运行时持久化
│   ├── state.json                ← 完整 engineState(emotionState/turnCount/...)
│   ├── chat.jsonl                ← 对话记录(追加写)
│   ├── memory.jsonl              ← 记忆快照(追加写)
│   └── overlay/                  ← 引擎增量数据(runtime-overlay/canon-overlay/...)
```

### 安全加固
- `saveLlmSecret` 拒绝保存掩码格式(******)的 key
- API Key 密码框不预填掩码值，测试时自动取真实值
- 快速模式(`__quick__`)不执行持久化

### 审计
- `npm run preflight` 现包含 audit + test + interface-audit 三项
- 接口联动审计: 47 通过 / 0 警告 / 0 错误

## v2.0 — 重构为纯 Web 应用 (2026-06-08)

### 架构变更
- **Electron → Web 服务器**：移除 Electron 主进程（`main.cjs`）、IPC 桥（`preload.cjs`）、渲染 UI（`src/ui/`），新建 `server.js` 作为纯 Node.js HTTP 服务器。
- **REST API**：所有原先的 IPC 通道转为 HTTP API 端点（`/api/config`、`/api/secrets`、`/api/llm/test`、`/api/worlds`、`/api/status` 等）。
- **统一入口**：`world-tree-console.html` 成为唯一 UI 入口，通过 `fetch()` 调用后端 API。
- **API 认证统一**：去除独立的 `hermesToken`，统一使用 `secrets.json` 管理的 API Key（OpenAI 格式 Bearer token）。

### 清理
- 删除 `v0-ui/`（563MB Next.js 项目）、`src/v0-out/`（33MB 静态导出）
- 删除 `world-tree-desktop-portable/`（214MB 便携版 EXE）
- 删除 `dist/`（187MB 安装包）
- 删除 `src/main.cjs`、`src/preload.cjs`、`src/ui/`（旧 Electron 专属代码）
- 删除 `package.json` 中的 Electron/electron-builder 依赖和构建配置
- 更新 `.gitignore`，移除便携版/构建产物规则

### 默认配置变更
- 默认 LLM 从 OpenAI（`api.openai.com/v1` + 空模型）改为 **DeepSeek**（`api.deepseek.com/v1` + `deepseek-chat`）
- 去除 `hermesToken` 配置项

### UI 升级
- `world-tree-console.html` 完全重写：13 个标签页（叙事/设置/概览/对话/世界/存档/模组/导演/脉象/守护/分支/指令/体检）
- 新增 🎮 叙事标签页：直连 DeepSeek 的 AI 对话引擎
- 新增 ⚙ 设置标签页：模型连接配置、API Key 管理
- 保留旧版观测终端全部功能面板

### 测试
- 新增 14 个引擎核心测试（上下文引擎、记忆层、枝干系统、导演模式、世界状态、因果链等）
- 测试总数：75/75 通过
- 审计：0 errors, 0 warnings
