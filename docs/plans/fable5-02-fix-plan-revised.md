# World Tree 修复更正计划书（修订版）

> 修订说明：本版继续采用 fable5 的 P0/P1/P2 路线，但收紧三处执行语义：① retry 必须 append-only，不允许物理替换 chat.jsonl 历史；② JSON 提取必须配套任务级 schema 校验；③ demo 内容仍按三包推进，但 v0.4.3 的最低真实 LLM 闸门先以 demo-world 跑通为硬门槛，避免内容赶工阻塞试飞。


适用版本：0.4.2-v2-engineering-foundation-truth.0
性质：本文只包含"修 bug / 补断裂"，不包含新能力建设（新能力见《03-优化升级计划书》）。
每个条目 = 问题 → 位置 → 修法 → 验收标准 → 估时。估时按"一名熟悉仓库的开发者 + AI agent 辅助"计。
执行原则：**每修完一批跑 `npm run preflight`，并为每个 P0 项新增至少一条回归测试**——这个仓库的测试纪律是资产，修复不能破坏它。

---

## 第一批 P0：让"第一局"能活下来（合计约 5-7 个工作日）

### FIX-01｜LLM 失败时：输入不丢 + 可重试

- **问题**：`/api/llm/chat` 内 `sendDualStageTurn` 抛错后直接返回 `{status:"error",errorMsg:"fetch failed"}`，服务端不落盘（实测 chat.jsonl 为空），前端无重试，输入仅存在于 localStorage。
- **位置**：server.js `handleLlmChat`（约 763-980 行）catch 路径；world-tree-console.js `sendChat`。
- **修法**：
  1. 服务端：catch 中调用一次持久化——复用 `persistTurn` 写入 user 消息 + 一条 `role:"error"` 的占位记录（带 `errorCode`、`attemptedAt`），不推进 turnCount 语义（新增 `turnStatus:"failed"` 字段）。
  2. 新增 `POST /api/llm/chat/retry`：body 只带 `moduleKey` + `failedTurnId`，服务端从落盘记录取回原输入重跑；**成功后不得物理替换 chat.jsonl 中的 error 占位**，而是追加正式 assistant 消息，并写入 `retryOf`、`supersedesErrorId`、`recoveredAt` 等 metadata，形成 append-only 的审计链。
  3. 前端：error 气泡内渲染 `[重试]` 与 `[打开设置]` 两个按钮；发送失败时把原文本回填输入框（当前是 `input.value=""` 先清空——改为成功后再清空，或失败时恢复）；重试成功后在原失败气泡旁显示"已通过重试恢复"状态，而不是删除失败证据。
- **验收**：关闭 LLM 服务 → 发送消息 → 重启 LLM → 点重试 → 得到正常叙事；`runtime/chat.jsonl` 中可看到 failed error 记录 + recovered assistant 记录，二者通过 `retryOf/supersedesErrorId` 关联，历史不被物理改写；刷新页面后失败消息与恢复后的正式回复都来自服务端，而非 localStorage。
- **估时**：1.5 天（含 2 条集成测试）。

### FIX-02｜错误信息人话化 + 分类

- **问题**：所有底层异常原样透传（"fetch failed"、超时英文串）。
- **位置**：新建 `src/server/llm-error-mapper.js`；在 handleLlmChat / testLlmConnection / 各 V2 service 的 LLM 调用出口统一走它。
- **修法**：建立错误映射表（这是全部主干场景，直接照抄即可）：

| 触发 | code | 用户文案 | 附带动作 |
|---|---|---|---|
| TypeError/ECONNREFUSED | LLM_UNREACHABLE | 无法连接到模型服务（{host}）。请确认服务已启动、地址无误。 | [打开设置][重试] |
| HTTP 401/403 | LLM_AUTH_FAILED | API Key 无效或无权限。 | [打开设置] |
| HTTP 429 | LLM_RATE_LIMITED | 模型服务限流，请稍候重试。 | [重试]（自动退避 5s） |
| HTTP 404/400 模型名 | LLM_MODEL_NOT_FOUND | 模型 "{model}" 在该服务上不存在。 | [打开设置] |
| Timeout | LLM_TIMEOUT | 模型响应超时（{n}s）。长文本或慢模型可在设置中调高超时。 | [重试] |
| 5xx | LLM_UPSTREAM_ERROR | 模型服务内部错误（{status}）。 | [重试] |

  响应结构统一为 `{status:"error", code, userMessage, detail, retryable:boolean}`；前端按 code 渲染动作按钮。
- **验收**：用 6 个 mock 场景（dead port / 401 / 429 / 404 / 慢响应 / 500）各得到对应中文文案与按钮；单测覆盖映射表全行。
- **估时**：1 天。

### FIX-03｜创建接口契约校验（终结"创意被静默吞掉"）

- **问题**：`POST /api/modules/create` 对 quick-setting 缺 `sourceText` 时静默创建空世界；未知字段（如 `idea`）无提示。
- **位置**：src/server/module-service.js `createModule`（约 140-260 行）。
- **修法**：
  1. quick-setting / character / 各叙事 mode：`sourceText`（或 mode 别名字段）为空 → 返回 400 `{code:"MISSING_SOURCE_TEXT", hint:"接受字段：sourceText | cardText | content"}`；确需空白项目走显式 `allowBlank:true`。
  2. 顶层未知字段收集进响应 `ignoredFields:[...]` 并 console.warn。
  3. 响应回显 `acceptedSourceChars`，前端创建成功 toast 显示"已接收设定 {n} 字"。
- **验收**：复现本审查的探针请求（`idea` 字段）→ 收到 400 + hint；正常前端流程不受影响（前端本来就发 sourceText）；新增 4 条单测。
- **估时**：0.5 天。

### FIX-04｜LLM JSON 提取器（救活 Director/分析器/炼金台）

- **问题**：4 处 `JSON.parse(rawResponse)` 裸解析，无围栏剥离，无 json mode。
- **位置**：新建 `src/core/llm/json-extract.js`；替换 llm.js:215/379/409/646 与 alchemy 各 service 的解析点。
- **修法**：
  1. 提取器算法（顺序尝试）：直接 parse → 剥 ```json/``` 围栏后 parse → 取首个 `{` 到配对 `}` 的子串 parse → 轻修复（去尾逗号、把全角引号换半角）后 parse → 全部失败返回 `{ok:false, raw}` 交由调用方走既有 JS 兜底。**注意：提取器只负责"得到 JSON 值"，不得把 parse 成功等同于任务成功。**
  2. 任务侧：为 Director / Guardian / 分析器 / 炼金台分别定义最小 schema 校验（可先用零依赖的手写 `validateDirectorJson`、`validateGuardianJson` 等函数，不引入 ajv）。只有 `extract.ok === true` 且 schema 校验通过时才采纳；否则记录 `jsonExtractFailureReason` 并走既有 JS 兜底。
  3. 请求侧：openai-compatible 的 director/guardian/分析器任务加 `response_format:{type:"json_object"}`；收到 400 且 message 含 response_format 时记住该端点不支持（进程内 Map），后续不再带。
  4. 测试夹具：至少 8 个真实畸形样本（围栏、前置"好的，以下是 JSON："、尾逗号、双 JSON、截断）+ 至少 3 个"可 parse 但 schema 不合格"样本。
- **验收**：畸形 JSON 与 schema 夹具单测全过；可 parse 但字段缺失/类型错误的样本必须 fallback；用一个真实便宜模型手动跑 10 轮混合模式，Director 采纳率（非回退且 schema 合格）≥ 8/10（当前接近 0）。
- **估时**：1 天。

### FIX-05｜Claude 预设修正

- **问题**：`claude-compatible` 预设指向 Anthropic 原生 API，但发包格式是 OpenAI /chat/completions → 必坏。
- **位置**：server.js connectionTemplates（约 1663-1671）；src/adapters/llm.js。
- **修法（二选一，推荐 A 先行）**：
  - A（30 分钟）：把预设改为 `label:"Claude（经 OpenRouter）", baseUrl:"https://openrouter.ai/api/v1", model:"anthropic/claude-sonnet-4.5"`，并在设置页注明"Anthropic 原生接口暂不支持，直连请等 v0.6 provider 适配层"。
  - B（归入 03 文件的多 provider 适配层）：实现 anthropic 原生 adapter（/v1/messages、x-api-key、system 单独字段、content blocks 解析）。
- **验收**：设置页选 Claude 预设 + 有效 OpenRouter key → `POST /api/llm/test` 通过 → 能完成一轮对话。
- **估时**：A 0.1 天。

### FIX-06｜首发内容包 ×3 + 首跑引导（打破冷启动）

- **问题**：defaults/examples 全部为 blank 模板；新用户无任何可玩物；`firstRun:true` 配置位存在但无对应引导流程。
- **位置**：defaults/examples/ 新增 3 个目录；沿用现成的 `/api/examples` + `/api/examples/install` 路由（server.js:2853-2862，管道已存在只缺内容）；前端 workbench 视图。
- **修法**：
  1. 内容包（用炼金台/AI 辅助生产，人工终审，每个控制在 30 分钟可玩量）。仍按三包推进，但执行优先级为：`demo-world-云上蒸汽城` 必须先达到 smoke:first-play 可用；人物卡与剧本杀包同步推进，但不得为了赶进度牺牲首个可试玩世界的质量：
     - `demo-scriptkill-雾巷回声`：单人剧本杀。1 个案件胶囊、3 名可讯问 NPC、12 条世界书、1 条 hiddenTruth、6 条线索——专门用来展示"隐藏边界 + /clue + 提案审核"三张差异化牌。
     - `demo-character-守夜人艾琳`：完整人物卡（性格/口癖/背景/开场白），展示人物卡入口最短路径。
     - `demo-world-云上蒸汽城`：快速设定示例（≈1500 字设定 + 8 条世界书 + 建议开场行动 3 条）。
  2. 首跑流程：`firstRun:true` 时工作台顶部渲染引导条——"第一次来？一键安装示例世界并开始 →"；点击 = install + load + 输入框预填开场行动，用户只需按回车。完成或跳过后置 `firstRun:false`。
  3. 每张入口卡片补一行"没有素材？[用示例试试]"链接到对应 demo。
- **验收**：删除 data/ 与 userData/ 全新启动 → 不粘贴任何文字，3 次点击内发出第一条消息（配好 key 的前提下）；`demo-world-云上蒸汽城` 必须通过一次真实 LLM 三轮 smoke；三个包在 v0.4.3 发布前各通过一次真人 15 分钟试玩记录（见 FIX-08），若内容质量未达标，不允许用低质包凑数。
- **估时**：2-3 天（内容 1.5-2.5 + 接线 0.5）。

### FIX-07｜发布卫生 + 死物清理

- **问题**：工作区脏物随包分发（userData/output/audit/.playwright-cli 约 20MB）；hermesBaseUrl 死配置；start.bat 版本写死 v2.3.1；README 许可证段落过期；chat 输入 20000 与 fallback 8000 截断不一致。
- **修法**：
  1. 发布只走 `npm pack`（package.json files 白名单已正确），补 `npm run release:verify`：解包 tgz 断言不含 userData/audit/output，断言体积 < 2MB。
  2. 删除 hermesBaseUrl 默认值与 diagnostics 里的 hermes-config 项（全仓无调用方，删除安全）。
  3. start.bat 改为 `for /f` 读 package.json version（或干脆不显版本）；README 许可证段落改为"MIT，见 LICENSE"。
  4. fallback 截断统一为 20000（与 CHAT_INPUT_MAX_CHARS 同源常量，提到 src/server/limits.js）。
  5. 加 `.gitattributes`：`*.js text eol=lf`，一次性 renormalize 终结 CRLF 混杂。
- **验收**：`npm pack` 产物解包审查通过；诊断页不再出现 hermes 项；preflight 全绿。
- **估时**：0.5 天。

### FIX-08｜建立"真实 LLM 冒烟"最低闸门（P0 中最重要的一条流程修复）

- **问题**：`Real LLM Flow: BLOCKED`——当前仓库没有可复现、可审计的真模型端到端 PASS 记录。这不是普通代码 bug，而是验收定义 bug。
- **位置**：scripts/smoke-user-content-real-llm.mjs 已存在但从未被喂过凭据；新增 scripts/smoke-first-play.mjs。
- **修法**：
  1. 定义 Tier-1 冒烟脚本 `smoke:first-play`：读环境变量 `WT_SMOKE_BASE_URL/MODEL/KEY`（推荐 deepseek-chat 或任一便宜模型，单次成本 < ¥0.1），自动执行：安装 `demo-world-云上蒸汽城` → load → 连发 3 轮固定行动 → 断言（a）3 轮均 status:ok（b）每轮 narrative ≥ 80 字（c）无 hiddenTruth 原文泄漏（d）chat.jsonl 6 条记录（e）第 3 轮上下文包含第 1 轮引入的专有名词（记忆最低线）。
  2. 本地手动跑 + CI 里做成 `workflow_dispatch` 手动触发 job（凭据走 GitHub Secrets），**不阻塞常规 CI**。
  3. 仓库规则写入 docs/PROJECT_TRUTH_SOURCE.md：**任何"产品闭环 PASS"的声明必须附带一次 smoke:first-play 通过记录 + 一次真人试玩记录**，否则只能标"工程闭环"。
- **验收**：本地跑通一次并把输出存入 docs/reports/first-play-smoke-{date}.md；此后 README 的 Real LLM 状态从 BLOCKED 改为 PASS(date)。
- **估时**：1 天 + 每次运行几分钱。

---

## 第二批 P1：让"第一局"值得玩（合计约 9-12 个工作日）

### FIX-09｜SSE 流式输出（体验杠杆最大的单项）

- **问题**：全链路阻塞式等待，最坏 60s×N；前端用假进度文案掩盖。
- **位置**：src/adapters/llm.js 新增 `callLLMByRoleStream`；server.js 新增 `POST /api/llm/chat/stream`；前端 sendChat 改造。
- **修法**：
  1. 适配层：请求体加 `stream:true`，逐行解析 `data: {...}` 增量（兼容 OpenAI 格式 delta.content），产出 async iterator；保留现有非流式函数不动（Director/Guardian 这类 JSON 任务继续走非流式）。
  2. 服务端：`text/event-stream` 响应；事件协议三种：`event:delta`（文本增量）、`event:stage`（真实阶段：directing/writing/auditing/persisting——顺手废掉假进度文案）、`event:done`（携带 persistedIds/engineState/parsedSections 完整收尾包）、`event:error`（走 FIX-02 的结构）。落盘仍在 done 前完成，保证崩溃一致性。
  3. Guardian 与流式的共存策略："先流后审"：正文流给用户 → 完成后若开启 Guardian 且校验失败，则以 `event:revision` 替换消息内容并加"已修订"角标。默认 Guardian 关闭时无感。
  4. 前端：fetch + ReadableStream reader，只对当前气泡做 `textContent +=`（配合 FIX-11 的增量渲染）；新增停止按钮（AbortController，中止时已流出内容照常落盘、标记 `truncatedByUser`）。
  5. 降级：端点不支持 stream（400/连接立即断）→ 自动回落非流式路径，UI 无感。
- **验收**：deepseek 实测首 token < 2.5s；中途点停止不丢已生成文本；断网瞬间收到 event:error 且输入可重试；非流式端点（如某些本地代理）自动降级成功。
- **估时**：3 天。

### FIX-10｜引擎状态按世界作用域化（拆全局单例雷）

- **问题**：MEMORY_LAYERS、director 预测 store、overlay pending、global-memory、content-registry、context-indexer 均为进程级单例，跨世界污染 + 无并发保护。
- **位置**：新建 `src/core/engine/world-session.js`；改造上述 6 个模块。
- **修法（渐进，不推倒重写）**：
  1. `WorldSession` 类：字段即上述六件套的实例化版本；`SessionRegistry = Map<moduleKey, WorldSession>`，LRU 上限 8、闲置 30 分钟落快照后逐出。
  2. 迁移方式：六个模块保留现有函数签名，首参增加 `session`（或经 AsyncLocalStorage 注入当前 session——推荐后者，改动面小：在路由入口 `als.run(session, handler)` 一次包裹）。原全局对象保留为 default session 以兼容测试，标记 @deprecated。
  3. 每 session 一个回合互斥队列（promise chain）：同世界并发回合请求串行执行；不同世界天然并行。
  4. `importEngineState` 改为写入目标 session 而非全局；快照恢复失败 → **该 session 置 fresh 状态**而非继承他人记忆，并在响应里带 `sessionWarning`。
- **验收**：新增集成测试——创建世界 A/B，交替各发 2 轮（mock LLM），断言 A 的 L4 世界事实绝不出现在 B 的 writer packet 中（可用 turn/debug 端点取包体断言）；两标签页同世界并发发送 → 两轮按序完成、turnCount 正确 +2。
- **估时**：3 天（含测试）。风险最高的一项，安排在流式之后、有整块时间时做。

### FIX-11｜前端渲染：消息区增量化 + Markdown

- **问题**：render() 全量 innerHTML；LLM 输出不渲染 Markdown；滚动/焦点丢失。
- **位置**：world-tree-console.js render/chatMsg；新增 `src/…/md-lite.js`（打进 client-core 或独立静态文件）。
- **修法**：
  1. 拆渲染域：chat 视图内 `#chatMessages` 改为受控增量——新消息 `appendChild`、流式增量只改当前节点、其余面板（kernel/status）各自独立刷新函数。**不引框架**，维持零依赖路线，仅把"全量画"改成"分区画"。
  2. md-lite：自研 60 行白名单渲染器（段落/**粗**/*斜*/`code`/引用/无序列表/水平线），先 `U.esc` 全文再做标记替换，杜绝 XSS 面；LLM 叙事与状态建议均走它。
  3. 滚动策略：用户停留底部时自动跟随，向上翻阅时新消息只出现"↓ 新消息"浮标。
  4. 替换 alert/confirm：命令面板改为输入框输入 "/" 时弹出的内联命令菜单（顺带解决命令可发现性）；确认类操作用现有 toast/panel 组件做双击确认。
- **验收**：200 条消息的会话中发送新消息，输入焦点与滚动位置不丢；含 Markdown 的叙事正确渲染且注入 `<img onerror>` 类 payload 被转义（补 XSS 单测 5 条）；命令菜单可键盘上下选择。
- **估时**：2.5 天。

### FIX-12｜世界书检索升级到"可用线"

- **问题**：仅当前输入子串匹配，无历史窗、无递归、无正则（详见审查报告 §4.3）。
- **位置**：src/core/worldbook/worldbook-context-activator.js（全部逻辑都在此文件，改造面集中）。
- **修法**：
  1. 扫描语料 = 当前输入 + 最近 4 轮 user/assistant 文本（轮数进 context-budget 配置）。
  2. 递归激活：已激活条目的 content 再扫一遍（深度 1、总条数不超 budget.worldbookEntries、去重）。
  3. key 语法扩展：普通子串（默认）、`re:/…/i` 正则、`w:词` 全词匹配；normalizer 兼容旧数据。
  4. 排序保持 命中数 → priority；预算裁剪从"条数"升级为"条数 + 字符预算双约束"（沿用 budget.worldbookChars）。
- **验收**：夹具测试——条目 A 的 key 只出现在上一轮 assistant 叙事中，本轮泛指代词输入仍激活 A；递归：输入命中"银月教团"→ 教团条目 content 提到"圣女伊蕾娜"→ 伊蕾娜条目被带入；旧世界书 JSON 无迁移直接可用。
- **估时**：1.5 天。

### FIX-13｜API 命名陷阱与契约补全

- **问题**：`/api/chat/message` 实际是消息编辑接口；本审查实测时也被其误导（发送首条消息得到"没有找到这条已持久化的消息"）。
- **修法**：新增 `/api/chat/message-op` 为正名路由；旧路径保留 302 语义的兼容转发 + 响应头 `Deprecation: true`，v0.6 移除；world-tree-client-core.js 的 `chatMessage` 改名 `chatEdit`；docs/API_REFERENCE.md 同步，并在其中给出"发送对话请用 /api/llm/chat(/stream)"的醒目提示。
- **验收**：旧路径调用打印弃用告警仍可用；docs:check 通过。
- **估时**：0.5 天。

### FIX-14｜客户端/服务端聊天历史对账

- **问题**：localStorage 与 chat.jsonl 双源无对账。
- **修法**：加载世界时以服务端为唯一真源全量拉取（现有 modules/load 已回传 chat 历史，前端却优先 localStorage——对调优先级）；localStorage 降级为"离线草稿缓冲"，只保存未成功送达的输入，送达即清。
- **验收**：浏览器 A 对话 5 轮 → 浏览器 B 打开同世界看到完整 5 轮；清空 localStorage 刷新无任何丢失。
- **估时**：0.5 天。

---

## 第三批 P2：清债（穿插进行，合计约 6-8 个工作日）

| 编号 | 项 | 修法要点 | 验收 | 估时 |
|---|---|---|---|---|
| FIX-15 | token 计数替代字符计数 | 自研估算器：CJK 字符×1.0 + ASCII 词×1.3 的分段估算（±15% 足够预算用），context-budget.js 单位切换，设置页显示每轮估算 tokens | 同一上下文中英混排预算误差 < 20%（对拍 3 个真实分词器样本） | 1 天 |
| FIX-16 | server.js 路由巨石拆分 | 建 `src/server/routes/registry.js`（method+path→handler 表）；按域迁移 6 批：config/secrets → modules → chat/llm → alchemy → review/overlay → misc；每批迁完跑 preflight | server.js < 400 行只剩启动/静态/挂载；路由清单测试（v2-product-route-registry 模式）扩到全量 | 3 天 |
| FIX-17 | console.js 拆分 | 按视图拆 views/{workbench,chat,library,worlds,observe,settings}.js + state.js + events.js，构建期简单 concat（保持无打包器）或原生 ESM `<script type=module>` | 单文件 < 800 行；行为回归靠现有 console-boundary 测试 + 手动清单 | 2 天 |
| FIX-18 | world.json 存档格式净化 | moduleGraph/wrapperGraph 移到 runtime/engine-graph.json（可再生缓存）；world.json 只留身份/模式/计数/时间；读侧兼容旧档一版 | 新建世界 world.json < 40 行；旧档加载正常（迁移测试） | 1 天 |
| FIX-19 | 防剧透第二道防线 | scanForHiddenLeaks 之上加可选"语义审计"：hiddenTruth 拆关键实体词做共现检测（村长+龙 同段即告警送 Guardian 复核）；默认关，剧本杀模式默认开 | 夹具：改写型泄漏（"瞳孔裂成竖线"）被共现规则捕获率 ≥ 70% | 1 天 |
| FIX-20 | secrets 权限与文档 | 写 secrets.json 时 fs 权限 0o600（win 跳过）；SECURITY.md 增"密钥以明文存于本机 userData，请勿同步该目录"说明 | 手动验证权限位；SECURITY.md 更新 | 0.2 天 |
| FIX-21 | UI 术语对外翻译层 | 建 `ui-labels.js` 映射：Experimental→抢先体验、薄切片→基础版、版本号仅显 0.4.2（完整串移到设置-关于）| 首页无英文开发术语；观测/调试页保留原始术语 | 0.3 天 |

---

## 执行顺序与依赖

```text
周 1：FIX-03 → FIX-04 → FIX-02 → FIX-01 → FIX-05 → FIX-07   （契约与错误层先行，互不依赖可并行）
周 2：FIX-06（内容，可与代码并行；先保 demo-world 质量，再补齐三包）→ FIX-08（真 LLM 冒烟，依赖 06 的 demo-world）
      ★ 里程碑 A：全新安装 → 3 击开玩 → 3 轮真实对话 → 失败可重试。达成即可发 v0.4.3。
周 3：FIX-09（流式）→ FIX-11（渲染，依赖 09 的增量通道）
周 4：FIX-10（状态作用域，独立大项）→ FIX-12 → FIX-13 → FIX-14
      ★ 里程碑 B：双世界双标签互不污染 + 流式 + 记忆检索可用。达成即 v0.5.0-rc。
P2 各项穿插在等待/评审间隙，FIX-16/17 建议放在 v0.5.0 发布后立即做（趁热重构，避免新功能继续堆进巨石）。
```

## 全局验收（v0.5.0 出厂标准）

1. `smoke:first-play` 用两家不同 provider（deepseek + ollama 本地）各通过一次，记录入 docs/reports/。
2. 真人试玩：3 位非开发者按 USER_QUICKSTART 从零安装，全部在 10 分钟内完成 3 轮对话，过程录屏归档。
3. `npm run preflight` 全绿且新增测试 ≥ 40 条（本计划各 FIX 的验收测试合计）。
4. `npm pack` 产物 < 2MB 且不含任何 userData/审计产物。
