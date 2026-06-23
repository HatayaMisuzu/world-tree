# World Tree — AI 开发指南

> 本文档供 AI agent / LLM 阅读，快速理解项目架构、文件路径和修改规则。
> 最后更新: v0.3.0 (2026-06-23) — 本地优先工作台基线：Mode Runtime Core + Module Runtime Orchestrator + Mode State Schema P1。

## 项目定位

纯 Web 服务器 + 单页 HTML 控制台。直连任意 OpenAI-compatible LLM 运行叙事/角色扮演。无 Electron、无外部依赖（仅 Node.js）。

## 产品用户边界

v0.3.0 不只服务重度创作者，也必须服务轻度玩家、AI 设定爱好者和文字冒险用户。任何新功能都要检查：

1. 轻度用户是否能不用理解内部术语就开始；
2. AI 设定爱好者是否能整理设定；
3. 文字冒险玩家是否能快速进入行动输入；
4. 重度创作者是否能继续使用世界书、审核、状态追踪；
5. 技术黑盒是否默认折叠，不压倒普通玩家体验。

**工作目录**: 项目根目录（克隆到任意位置，以下记作 `<ROOT>`）

## 运行

```bash
cd <ROOT>
npm install        # 首次
node server.js     # 启动 → http://localhost:3000
npm run preflight  # 全检: 审计 + 测试 + 接口联动审计
```

---

## 核心架构：请求→引擎→持久化

```
浏览器 fetch()
  ↓ POST /api/llm/chat
server.js → handleLlmChat()
  ↓ 构建 model(读 shared/) + engineState(读 runtime/state.json)
src/adapters/llm.js → sendDualStageTurn()
  ↓ Director(hybrid: 轻量LLM分析→JS方向包) → Writer(LLM) → Guardian(JS校验+自动修正)
completeTurn() → writeSet + overlayPatch + memorySnapshot
  ↓ persistTurn()
runtime/chat.jsonl (追加) + runtime/memory.jsonl (追加)
runtime/state.json (覆盖) + runtime/overlay/ (增量)
  ↓
返回 {narrative, engineState} → 浏览器
```

---

## 文件地图

```
world-tree-console.html    ← Web UI 结构入口（引用 CSS/JS）
world-tree-console.css     ← Web UI 样式
world-tree-console.js      ← Web UI 交互逻辑（13 标签页）
server.js                  ← HTTP 服务器（所有 REST API）
src/
├── adapters/
│   └── llm.js              ← 三角色LLM调用 + sendDualStageTurn
├── core/
│   ├── world-engine.js     ← 引擎入口 + 三角色Packet Builder + buildEnginePacket
│   ├── engine/             ← 引擎核心
│   │   ├── director.js     ← 导演层（情绪/事件评分/缓存/方向包）
│   │   ├── guardian.js     ← M1守门人 + JS校验 + v2扩展
│   │   ├── lifecycle.js    ← prepareTurn / completeTurn
│   │   ├── commands.js     ← 23组斜杠命令路由
│   │   ├── output-parser.js ← LLM标记段解析器
│   │   ├── modules.js      ← M1-M19模块注册表
│   │   ├── direction-packet.js ← 方向包数据结构
│   │   ├── constants.js    ← 引擎常量集中管理（情绪/节奏/预测/词库）
│   │   ├── state-persistence.js ← 进程内引擎状态导出/导入
│   │   ├── emotion-state.js ← 四维情绪状态机
│   │   ├── context-engine.js ← 统一上下文组装入口（world-engine 当前调用）
│   │   ├── context-router.js / context-indexer.js / context-assembler.js ← 路由/索引/组装子模块
│   │   ├── world-telemetry.js ← 15维叙事KPI
│   │   ├── overlay-store.js ← overlay写入路径+三级权限
│   │   ├── global-memory.js ← 全局记忆快照
│   │   ├── branch-system.js ← 四态分支管理
│   │   ├── world-manager.js ← 世界文件夹管理
│   │   └── storytellers.js/tabletop.js/rpg.js/sim.js/murder-mystery.js
│   ├── data/
│   │   ├── worldbook.js     ← M2 7步匹配引擎
│   │   ├── character-card.js ← M19 角色卡驱动+情绪梯度
│   │   ├── proximity-scope.js ← 邻近环系统（核心/邻近/远端/沉睡）
│   │   ├── alchemy/         ← 内容炼金台（5阶段管线: 解析→分块→分类→提取→去重）
│   │   │   ├── alchemy-engine.js  ← 主入口 importFile()
│   │   │   ├── digester.js        ← 消化器（digest/quickplay 双模式）
│   │   │   ├── classifier.js      ← LLM+JS 混合分类
│   │   │   ├── extractor.js       ← LLM Schema提取
│   │   │   ├── deduplicator.js    ← 去重+冲突检测
│   │   │   ├── types.js           ← 内容类型定义+Schema
│   │   │   └── parsers/           ← Markdown/SillyTavern/NAI解析器
│   │   ├── rules.js/prediction.js/random-events.js/scenes.js/...
│   └── schemas/             ← 9个JSON Schema (src/core/schemas/)
scripts/
├── test.mjs                ← 84 项集成/语法测试
├── check.mjs               ← 关键文件存在性 + 无副作用核心模块导入检查
├── audit.mjs               ← 项目审计（版本/路径/目录）
└── interface-audit.mjs     ← 接口联动审计（IO校准/API契约/engineState链路）
tests/
└── unit/                    ← 51 项单元测试（emotion/direction/output/guardian）
defaults/
├── engine-profile/          ← Layer 2 知识卡（M1-M19 JSON）
├── world-profiles/          ← 世界子类型配置（classic/murder-mystery）
└── examples/manifest.json   ← 素材示例清单入口（当前为空，待维护者提供素材）
legacy/
└── adapters/hermes.js       ← 旧 Hermes 适配器（保留但不在主路径启用）
docs/                        ← 设计文档（6篇）
design/                      ← 视觉设计资源
data/
├── engine/worlds/{name}/    ← 用户创建的世界
│   ├── world.json / shared/ / runtime/
└── engine/global-memory/    ← 全局记忆快照
```

---

## 模组持久化格式

```
data/engine/worlds/{name}/
├── world.json              ← {name, displayName, dataMode, subType, turnCount, ...}
├── shared/                 ← 静态数据(创作时写入,运行时只读)
│   ├── worldbook.json      ← {entries: [{keys, content, type}]}
│   ├── characters.json     ← [{id, name, role, traits, ...}]
│   ├── locations.json / organizations.json
│   ├── relations.json / timeline.json / world_state.json
│   ├── races.json / rules.json / scenes.json
├── runtime/                ← 运行时持久化
│   ├── state.json          ← {turnCount, engineState, lastScene}
│   ├── chat.jsonl          ← 每轮追加一行{role, content, round, ts}
│   ├── memory.jsonl        ← 每轮追加一行{scene, summary, emotion, ...}
│   ├── source.txt          ← 快速项目草稿的原始粘贴素材（可选）
│   ├── pending.jsonl       ← 待用户采纳的审核事实源
│   ├── manual.jsonl        ← 必须手动确认的审核事实源
│   ├── review-log.jsonl    ← 采纳/拒绝/编辑后采纳日志
│   ├── snapshots/          ← 审核采纳前快照
│   └── overlay/            ← 引擎writeSet执行目标
│       ├── runtime-overlay.json / canon-overlay.json
│       ├── characters-overlay.json / worldbook-overlay.json
│       └── scene-chain.json / memory-store.json
```

---

## 关键 API

| 端点 | 方法 | 说明 | 调用的引擎模块 |
|:----|:----:|:-----|:--------------|
| `/api/llm/chat` | POST | 双段式叙事对话 | `llm.js sendDualStageTurn()` |
| `/api/llm/test` | POST | 当前模型连接诊断：Base URL / Key / model / `/models` / `chat/completions` | `server.js` |
| `/api/alchemy/digest` | POST | 解析文本→创建模组/角色卡 | `alchemy importFile()` / `skill-generator.js` |
| `/api/alchemy/import` | POST | 解析文本→返回 items，并加入审核队列 | `alchemy importFile()` |
| `/api/alchemy/review` | GET/POST | 审核队列读写，确认后写入正式世界数据 | `server.js` |
| `/api/review/pending` | GET/POST | 读取世界 runtime 审核事实源，或兼容 list 操作 | `runtime/pending.jsonl` + `manual.jsonl` |
| `/api/review/adopt` / `/api/review/edit-and-adopt` / `/api/review/reject` | POST | 采纳、编辑后采纳或拒绝审核项，采纳前写快照 | `runtime/review-log.jsonl` |
| `/api/review/log` | GET | 读取审核日志 | `runtime/review-log.jsonl` |
| `/api/modules` | GET | 列出所有模组 | 扫描 `data/engine/worlds/` |
| `/api/modules/create` | POST | 创建新模组；`quickProject:true` 时创建草稿世界并保存 `runtime/source.txt` | 写 `world.json` + `shared/` + `runtime/` |
| `/api/modules/finalize-draft` | POST | 将草稿世界转为正式世界 | `world.json` + `runtime/state.json` |
| `/api/modules/{id}/history` | GET | 加载对话历史 | 读 `runtime/chat.jsonl` |
| `/api/characters` | GET | 列出角色卡 | 扫描 `data/engine/characters/` |
| `/api/characters/import` | POST | 导入 ST v2/v3 JSON 或 PNG metadata 角色卡 | `st-card.js` |
| `/api/characters/load` | POST | 加载角色卡（card.json） | `character-card.js` |
| `/api/characters/delete` | POST | 删除角色卡 | — |
| `/api/worldbook` | GET/POST | 当前世界书读取与保存 | `shared/worldbook.json` |
| `/api/worldbook/test` | POST | 测试世界书触发和排序原因 | `worldbook.js matchEntries()` |
| `/api/connections` | GET/POST | 连接档案 CRUD、测试、设为默认 | `userData/connections.json` + `secrets.json` |
| `/api/chat/message` | POST | 消息编辑、删除、收藏、候选回复管理 | `runtime/chat.jsonl` |
| `/api/turn/debug` | GET | 读取本轮叙事黑盒 | `userData/turn-debug/` |
| `/api/world-pack/export` | GET/POST | 导出 `.worldtree` 世界包 | `world.json` + `shared/` |
| `/api/world-pack/import` | POST | 预览/确认导入 `.worldtree` 世界包 | `data/engine/worlds/` |
| `/api/plugins` | GET/POST | Deferred/internal：插件系统不属于 v0.3.0 公开产品主线，默认 UI 不暴露，仅保留内部预留能力 | `userData/plugins/` |
| `/api/secrets/llm-value` | GET | 获取密钥（脱敏，仅返回掩码） | 读 `secrets.json`（不返回明文） |

---

## Quick-setting vertical slice

Quick-setting vertical slice uses Mode/Module call layer as metadata and diagnostics only. It does not replace `DATA_MODES` and does not activate hidden modes.

- `mode: "quick-setting"` 仍映射到 `dataMode: "preset"`、`worldSubType: "classic"`、`preset: "preset"`。
- `src/core/modes/quick-setting.js` 调用 `loadModulesForMode("quick-setting")` 并生成 JSON-safe graph 摘要。
- `world.json` 是 mode/module metadata 的稳定真相源；`runtime/state.json` 保存运行副本且跨回合保留。
- 现有 `/api/modules/create` 是唯一创建 API；不要新增平行 quick-setting API 或八模式 router。

详细边界见 `docs/WORLD_TREE_QUICK_SETTING_SLICE.md`。

---

## Legacy module wrappers P1

P1 为 M1、M2、M3、M8、M9、M11、M15c、M19、M-创作提供旁路 wrapper。入口可通过 `loadWrappersForMode(modeId)` 取得真实 wrapper，并显式调用 `buildContext`、`buildPromptBlock` 或 `getDebugInfo`。

- graph 的 `callable=true` 现在要求真实 wrapper 存在；manifest 声明本身不等于可调用。
- wrapper 只读已加载上下文，不做文件写入、不调用外部 LLM、不自动进入 lifecycle。
- declared-only、prototype-hidden 和 P2/P3 缺 wrapper 模块只产生诊断 gap，不阻断 mode graph。
- 主 prompt、server chat、DATA_MODES、旧 M 编号 activeModules 与 hidden profiles 均保持原逻辑。

详见 `docs/WORLD_TREE_LEGACY_MODULE_STANDARDIZATION_P1.md`。

---

## 修改规则

1. **语法检查**: `node --check <file>` 通过后再提交
2. **接口联动审计**: 改动 server.js / HTML / 引擎后必须运行 `node scripts/interface-audit.mjs`
3. **preflight 全检**: `npm run preflight` = audit + check + test + interface-audit，四项通过才能交付
4. **文件 IO 校准**: `createModule` 创建的 shared/ 文件必须被 `buildModuleModel` 读取
5. **API 契约**: 每个 API 返回字段必须被 HTML 使用
6. **engineState 链路**: 存储(state.json) → 加载(history API) → 发送(chat API) 完整闭环
7. **JSONL 一致性**: 写入的字段与读取时使用的字段对齐
8. **快速项目草稿**: 快速开始必须创建真实世界目录，`world.json.draft=true`，原始素材写入 `runtime/source.txt`
9. **密钥安全**: `saveLlmSecret` 拒绝掩码格式 key（≥4个连续`*`号），HTML 不预填密码框；`/api/secrets/llm-value` 仅返回脱敏值
10. **本地访问**: `isLocalRequest()` 检查 Origin，非 localhost 请求返回 403
11. **速率限制**: 静态文件 300/min + API 120/min，超限返回 429
12. **版本号**: 改动后更新 `CHANGELOG.md` + `package.json` + `README.md` + `AI-GUIDE.md`
13. **世界隔离**: 切换世界时调用 `resetPredictionCache(worldName)` + `resetEventCache()` + `resetEmotionState()`

---

## 接口审计检查项

`node scripts/interface-audit.mjs` 检查 7 类、56 项：

| 类别 | 检查内容 |
|:----|:-----|
| 文件 IO 校准 | createModule 写入 = buildModuleModel 读取 |
| overlay 读写 | persistTurn 执行 writeSet ↔ readOverlayData 回读 |
| API 契约 | 每个返回字段被 HTML 使用 |
| JSONL 一致性 | chat/memory.jsonl 字段在读写端对齐 |
| engineState 链路 | 存储→加载→发送 完整闭环 |
| 快速项目草稿 | `quickProject:true` 创建真实草稿世界并可 finalize |
| 密钥安全 | 掩码拒绝、不预填 |

---

## 三种数据模式

| 模式 | dataMode | DM角色 | 输出格式 |
|:----|:---------|:-------|:--------|
| 世界书 | `worldbook` | 完整DM | 六标记段协议 |
| 角色卡 | `character_card` | DM隐退 | 纯叙事第一人称 |
| 预设 | `preset` | 轻量DM | 简洁标记段 |
