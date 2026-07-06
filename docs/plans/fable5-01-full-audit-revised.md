# World Tree 全量审查报告（修订版）

> 修订说明：本版保留 fable5 的主判断与产品化路线，只修正后续复核中发现的过度断言与可能误导执行器的表述。核心结论不变：工程闭环真实，但当前仓库没有可复现的真实 LLM 产品闭环证据，第一局体验仍应视为 BLOCKED。


审查对象：world-tree v0.4.2-v2-engineering-foundation-truth.0（用户上传的完整工作区快照，2026-07-06）
审查方式：静态全量通读 + 动态实测。不是只看代码——本报告的每一条结论都标注了证据来源。

---

## 0. 审查方法与证据来源

本次审查实际执行了以下动作，所有结论均可复现：

1. **解压并测绘全仓**：src/ 438 个 JS 文件、总计约 4.9 万行；根目录双巨石 server.js（3288 行）与 world-tree-console.js（3472 行）；90+ 篇 docs；100+ 个测试文件。
2. **跑通全部测试**：`node --test tests/unit/*` → **1132 个单元测试全部通过**；`tests/integration/*` → **125 个集成测试全部通过**（58 秒）。工程侧声明属实。
3. **启动真实服务器并以"新用户"身份走产品闭环**：创建项目 → 加载 → 发送第一轮消息。**在第一轮就撞上了两处断裂**（详见第 5 节）。
4. **读取仓库内开发者自己留下的 Playwright UI 快照**（output/playwright/browser-home-loaded-snapshot.txt 等）作为真实 UI 证据——沙盒无浏览器，但这些快照是实机渲染结果。
5. **交叉核对文档声明与代码现实**：docs/CURRENT_PROJECT_STATE.md、productization-closure-report.md 等真相源文件与实测结果一致性很高（这是本项目罕见的优点）。

## 1. 总体评估

### 1.1 一句话结论

**这是一个工程底盘异常扎实、但产品闭环在第一轮对话处断裂的项目。** 它拥有 1257 个通过的测试、严格的文档真相源体系、清晰的模块契约——但一个真实用户按默认路径下载它之后，在 10 分钟内很难获得稳定的"可玩"体验：没有内置内容可以直接开始；在未正确配置可用 LLM provider 的情况下，第一条消息会得到类似 `fetch failed` 的裸错误；失败输入没有进入服务端持久化真源，只残留在前端本地缓存。项目自己的文档也诚实地承认了这一点（Real LLM Flow: BLOCKED；Bundled Story Examples: DEFERRED）。

### 1.2 评分卡

| 维度 | 评分 | 一句话依据 |
|---|---|---|
| 代码质量 | 7 / 10 | src/ 模块化程度高、零运行时依赖、命名清晰；但双巨石（server.js + console.js 合计 6760 行）与模块化 src/ 并存，重构做了一半 |
| 项目架构 | 5.5 / 10 | 引擎状态是进程级全局单例（跨世界污染风险）；V1 legacy 包装层与 V2 双轨并行；无流式架构 |
| 功能实现深度 | 6 / 10 | 8 个入口全部有服务层闭环 + 测试；但深度普遍是"薄切片"，世界书检索、防剧透等核心机制弱于自设对标物 SillyTavern |
| 产品可行性/闭环 | 2.5 / 10 | 当前仓库没有可复现的真实 LLM 端到端 PASS 记录；零内置可玩内容；默认新用户首轮体验断裂（实测复现） |
| UX / 前端 | 4 / 10 | 首屏是 8 个"粘贴文本"框；无流式假进度条；错误直接抛 `fetch failed`；LLM 输出不渲染 Markdown；全量 innerHTML 重绘 |
| 安全与隐私 | 7.5 / 10 | 本地回环绑定 + Origin/Host 校验 + 路径安全 + prompt 隐私擦洗，本地优先做得认真；小瑕疵见 §7 |
| 测试与 CI | 8.5 / 10（工程）/ 2 / 10（产品） | 测试量大且质量真实；但当前可复现测试主要是无 LLM 合同测试，真实 LLM 产品层覆盖没有入库证据 |
| 文档 | 8 / 10 | 数量、诚实度、结构都好；代价是 agent 官僚化——40+ 篇报告/闭环文档拖累新贡献者 |

### 1.3 核心矛盾诊断

从提交语言、"closure/truth-source/PASS/BLOCKED"术语体系、AI-GUIDE.md 和 AGENT_STATUS_HANDOFF.md 判断，本项目主要由 AI coding agent 驱动开发。这带来了一个典型病灶：**整个项目为"让 agent 可验证地推进"而优化，而不是为"让玩家玩起来"而优化。** 表现为：

- 测试验证的是函数契约（"validate/seal/start/turn/save/load/export PASS"），不是玩家旅程（"新用户能否在 10 分钟内玩到第 3 轮"）。
- 产出物是审计报告与闭环矩阵，而不是可玩内容包与开场引导。
- "8 个入口"在 UI 上是 8 个几乎一模一样的粘贴框——因为对 agent 来说它们确实只是 8 个不同的 mode 参数。

这不是贬低——工程底盘是真实资产。但下一阶段的全部杠杆都在"翻转优化目标"上。

---

## 2. 代码层审查

### 2.1 规模与构成

| 项 | 数值 |
|---|---|
| 有效 JS 总行数（去 node_modules/legacy/audit） | ≈ 71,600 行 |
| src/ 模块 | 438 个文件，≈ 49,270 行 |
| server.js（根目录巨石） | 3,288 行，76 个 API 路由内联 if-dispatch（server.js:2773-3244） |
| world-tree-console.js（前端巨石） | 3,472 行，149 个函数，单文件 SPA |
| 运行时依赖 | **0**（纯 Node 18+，devDep 仅 playwright） |

零依赖是明确的设计选择且执行到位（`local-access.js` 头部注释明确"must stay dependency-free"）——对本地优先产品是加分项：无供应链风险、安装秒级。

### 2.2 具体代码问题（均已定位）

**C-1｜LLM JSON 解析裸奔。** `src/adapters/llm.js:215/379/409/646` 全部是直接 `JSON.parse(rawResponse)`。没有剥离 markdown 代码围栏（```json …```）、没有截取首尾大括号、没有请求 `response_format: {type:"json_object"}`。现实中多数模型在没有 json mode 时会带围栏输出 → Director/分析器 LLM 路径将高频静默失败（有回退到纯 JS 方向包的兜底，所以不崩溃，但"LLM 导演"这个卖点形同虚设）。

**C-2｜Claude 预设按构造即坏。** `server.js:1669` 的 connectionTemplates 提供 `claude-compatible → https://api.anthropic.com/v1`，但 `llm.js:endpoint()` 拼接的是 `{base}/chat/completions` 且用 `Authorization: Bearer` 头。Anthropic 原生 API 是 `/v1/messages` + `x-api-key` + 不同的 body 结构。任何用户选这个预设 = 必然失败。

**C-3｜创建接口静默吞字段。** 实测：`POST /api/modules/create` 传 `{"mode":"quick-setting","idea":"一个漂浮在云海上的蒸汽朋克城市"}` → 返回 `status: ok`，但落盘 `sourceTextChars: 0`，用户创意被无声丢弃（后端只认 `sourceText`，见 module-service.js:152，且不校验、不告警、不回显）。对 API 消费者这是数据丢失级契约缺陷。

**C-4｜双限额不一致。** 正式对话输入上限 20,000 字符（server.js handleLlmChat），本地 fallback 却只持久化 8,000 字符（handleLocalChatFallback，server.js:724）——同一个输入，走不同分支被截断成不同长度。

**C-5｜隐私擦洗只擦最后一条。** llm.js:172-174 只对当前 packet 做 `scrubPromptForPrivacy`，`historyMessages` 原样发出。历史消息一般是叙事文本风险较低，但既然做了这道防线就应对整个 messages 数组生效。

**C-6｜死配置残留。** `hermesBaseUrl: "http://127.0.0.1:8642"` 出现在默认配置（server.js:157）与诊断项（src/core/diagnostics.js:28-31），但全仓无任何调用方——一个已被移除的外部服务的尸体，还会让诊断页显示一个永远"未配置/失败"的项。

**C-7｜版本字符串漂移。** start.bat 标题写死 "World Tree Desktop v2.3.1"（真实版本 0.4.2）；README 底部仍写"若仓库尚未声明许可证请补充"，而 LICENSE（MIT）明明存在。

**C-8｜行尾混杂。** world-tree-console.js 内 CRLF 与 LF 混用（可 grep 到 `\r` 分段出现）——通常是多个 agent/编辑器交替编辑的痕迹，会污染 diff。建议 .gitattributes 统一。

**C-9｜工作区脏物。** 上传包中含 userData/（含 secrets.json——所幸只有假测试凭据）、output/playwright/、.playwright-cli/、audit/ 共约 20MB 非源码内容。.gitignore 已覆盖它们，但打包/分发流程没有走 `npm pack` 白名单，导致本地脏状态随包扩散。

### 2.3 代码层亮点（应保留的资产）

- `src/server/local-access.js`、`path-security.js`、`http-request.js`：小而纯的安全基元，带清晰职责注释，质量高。
- `checkKeyHostnameReuse`（llm.js:52）：同一 API Key 跨 hostname 使用时告警——少见的贴心防钓鱼设计。
- 提案/审核系统（proposal-system.js + review 路由族）：AI 建议 → 待审 → 批准入 canon 的通路完整且有测试，这是产品的差异化核心。
- prompt-task-contracts 体系：每类 LLM 任务有温度/长度/角色契约并被测试锁定，是很好的提示词工程骨架。

---

## 3. 架构层审查

### 3.1 【最严重】引擎状态是进程级全局单例

`src/core/engine/memory-layers.js:18` 的 `MEMORY_LAYERS`（五层记忆）是模块级常量对象；director.js 的预测 store、overlay-store 的 pending、content-registry、global-memory、context-indexer 同属这个模式。切换世界时靠 `importEngineState(snapshot)`（state-persistence.js:45）把快照**灌进同一个全局体**。后果：

1. **一个进程同一时刻只能"正确地"服务一个世界。** 两个浏览器标签页打开两个世界并交替对话 → 记忆、情绪、预测互相覆写、跨世界污染（世界 A 的"已确认事实"会出现在世界 B 的上下文里）。
2. **快照恢复失败 = 静默继承上一个世界的记忆**（buildModuleModel 里 catch 后仅 console.warn，server.js:573 附近）。
3. **无并发保护**：同一世界两个并发回合请求会交错读写全局状态。

本地单人场景下它"通常能用"，这正是它一直没被发现的原因——但这是产品化道路上必须先拆的雷（多标签是普通用户行为，不是边缘情况）。

### 3.2 半途重构：双巨石与 src/ 并存

src/server/ 已经有 34 个 service/route 模块（tabletop-v2-routes.js、detective-v2-routes.js…），说明拆分意图明确且部分完成；但主干 76 条路由仍以 3288 行 if-链形式活在 server.js。前端同理：world-tree-client-core.js 已剥出 API/工具层，但 149 个函数的视图/状态/事件仍在单文件。**半拆状态比不拆更危险**——新功能会随机落进两侧任意一边，认知成本双倍。

### 3.3 V1/V2 双轨并行

每个新建世界的 world.json 里都会写入完整 moduleGraph/wrapperGraph（M1-M15 legacy 包装器的解析结果，实测新建世界的 world.json 超过 200 行，其中 90% 是这类实现细节）。问题：

- **存档格式被实现细节污染**：世界包应当是"内容 + 状态"，而不是引擎内部的模块解析快照。这会让存档跨版本兼容变成噩梦（引擎重构 = 旧档里的 graph 全部失效）。
- 22 个 `*.wrapper.js` 包装 legacy 引擎（src/core/engine/ 下 director/guardian/lifecycle 等 20+ 个 400-800 行的文件）——V2 各入口又各自实现了一套 runtime。同一概念（回合、状态帧、隐藏信息）在两轨中各有一份实现。

### 3.4 无流式架构

全链路（llm.js fetch → server 阻塞响应 → 前端 await）没有任何 SSE/流式设计。当前一轮 = 最多 3 次串行 LLM 调用（Director→Writer→Guardian，默认 skipDirector/skipGuardian=true 时为 1 次），单次超时上限 60s。**文字游戏的核心体验就是"看着故事流出来"，这是架构级缺失而非功能级缺失**（前端用 1.4 秒轮换的假进度文案"导演正在分析你的行动……"来掩盖，world-tree-console.js sendChat 内 setInterval 1400ms）。

### 3.5 上下文预算按字符不按 token

context-budget.js：tiny/balanced/rich/emergency = 6000/12000/20000/3000 **字符**。中文 1 字符 ≈ 0.6-1 token、英文 1 token ≈ 4 字符，混排场景误差可达 3 倍——要么浪费上下文窗口，要么超限被截断。且历史轮数（historyTurns 8/20/36/4）与客户端自己另发的 `messages.slice(-40)`（console.js:2497）是两套并行、可能打架的历史管理。

### 3.6 客户端/服务端双份聊天记录

服务端：runtime/chat.jsonl（含备份轮换）。客户端：localStorage `wt-chat-{id}` 截 200 条（console.js:678-690）。LLM 失败时消息只进 localStorage 不进服务端 → 换浏览器/清缓存后两边历史不一致，没有任何对账机制。

---

## 4. 功能 / 机制 / 模块逐项评估

### 4.1 八个入口现状（文档声明 vs 实测）

| 入口 | 服务层 | UI 层 | 实测/证据 | 判定 |
|---|---|---|---|---|
| 快速设定 | ✅ 薄闭环 | 粘贴框 + 创建按钮 | 创建成功，但"创建即终点"：无引导语、无首轮建议、创意字段可被静默丢弃（C-3） | 可用但断头 |
| 人物卡 | ✅ Character V2 长期链路有测试 | 粘贴人物卡文本 | 有 capsule/candidate/export 全套服务；无任何示例卡 | 最接近可用 |
| 世界书大世界 | ✅ Worldbook V2 API PASS | 粘贴设定 | 检索机制远弱于对标（§4.3）；编辑器 UX 自认未完成 | 半成品 |
| 桌面叙事 | ✅ Tabletop V2 全家桶测试 | 需要粘贴 JSON 结构导入 | UI 上的 V2 导入是一个让用户手写 JSON 的 textarea（playwright 快照 ref e82 区域） | 工程强/产品无 |
| 解谜调查 | ✅ Detective V2 | 线索卡薄切片（/clue 命令） | 有 truth-ledger/notebook/deduction 服务与防泄漏测试 | 工程强/产品薄 |
| 策略模拟 | ✅ Strategy Sim V2 spec 全链 | 4 资源条 + 4 个斜杠命令 | validate/seal/start/turn 服务真实存在 | 最薄 |
| 单人剧本杀 | ✅ ScriptKill V2 | 需要用户自备内容包 | 知识边界/防剧透测试完整 | 工程强/无内容 |
| 炼金台 | ✅ G1 plan→generate→localize→deliver | 独立工作台 UI | 提示词质量好（provenance 标记 user_specified/llm_suggested 是亮点）；但从未接真 LLM 验证过 | 潜力最大/未点火 |

共性结论：**工程入口存在，产品入口未完成**——服务层与测试是真实的；但用户视角里，8 个入口目前更像 8 个要求你自带全部内容的空白粘贴框。

### 4.2 三角色叙事管线（Director → Writer → Guardian）

设计（llm.js:74-124 三段 system prompt + buildDirectorPacket/buildWriterPacket）在理念上是对的：把"节奏决策"与"写作"分离，Guardian 校验 mustInclude/mustNotInclude。但现实配置下：

- **默认全关**：sendDualStageTurn 默认 `skipDirector: true, skipGuardian: true`（llm.js:330-331）→ 实际跑的是"JS 规则方向包 + 单次 Writer"。三角色是纸面能力。
- 若全开：3 次串行调用 × 60s 超时上限，无流式 → 最坏 3 分钟一轮，成本 ×3。没有任何成本/延迟仪表让用户理解这个开关的代价。
- Director JSON 解析脆弱（C-1）→ 即使打开也会高频回退。

### 4.3 世界书检索：低于自设对标线

worldbook-context-activator.js 全部逻辑：把**当前这一条输入** lowercase 后做 `query.includes(key)` 子串匹配，按命中数+priority 排序取前 8 条。对比项目自己写的 ST-COMPARISON.md 所对标的 SillyTavern：

| 能力 | SillyTavern | World Tree 现状 |
|---|---|---|
| 扫描窗口 | 最近 N 条消息（可配） | 仅当前输入一条 |
| 递归激活（条目触发条目） | ✅ | ❌ |
| 正则 key / 大小写 / 全词 | ✅ | ❌（纯子串） |
| 插入位置/深度控制 | ✅ | ❌ |
| Token 预算感知 | ✅ | 字符数粗配额 |

实际后果：玩家上一轮提到"银月教团"，这一轮只说"我继续跟着他们走"→ 教团条目不会激活，AI 当场失忆。**这是"世界书大世界"这个招牌入口的核心机制短板。**

### 4.4 隐藏真相防泄漏：只防复读机

`scanForHiddenLeaks`（tabletop-v2-gm-loop.js）用 hiddenTruth 原文做子串匹配。测试用例（tabletop-v2-hidden-leak.test.js）也全是原文复现场景。LLM 把"村长其实是一只龙"改写成"村长瞳孔在火光下裂成竖线"即可穿透。作为第一道防线可以，但文档与 UI 把"隐藏真相保护"当卖点宣传（README 项目特点一节），宣传强度超过了实现强度。

### 4.5 五层记忆体系

分层设计（L1 短期/L2 会话/L3 角色认知边界/L4 世界事实/L5 玩家偏好，memory-layers.js 头注释）是这个项目最好的设计文档之一，L3"角色知道什么"对剧本杀/推理是关键基建。但实现上：全局单例（§3.1）+ 只在引擎快照里整体序列化 + L2 升级规则是写死的启发式（emotion.intensity==="高" 或 keywords≥3，memory-layers.js:68）——没有 LLM 参与的摘要/升格，长局后 L2 会变成流水账。

### 4.6 提案审核（Proposal → Review → Canon）

这是全项目最完整、最有差异化价值的机制：pending.jsonl → /api/review/adopt|edit-and-adopt|reject → 写入 shared/。加上炼金台的 provenance 标记，构成"AI 不直接改设定"的可信创作闭环。**建议将其提升为产品的第一卖点**（详见 03 文件）。

---

## 5. 可行性与产品闭环审查

### 5.1 新用户首次体验实测（完整死亡路径）

以下是我作为"下载后第一次运行"的用户在本机的真实经过：

1. `npm start` → 首页加载正常，侧栏 6 项导航，主区是 8 张粘贴卡片。**我没有任何东西可以粘贴** → 页面上没有"试试示例"（defaults/examples 里 8 个模板全部是 blank-*，零内容）。
2. 硬着头皮创建"审查测试世界"（quick-setting）→ 成功，但我的世界观描述被静默丢弃（C-3）。
3. 发送第一条行动："我推开城市边缘的锈蚀铁门，向云海望去。"→ 因 LLM 端点不可达，收到 `{"status":"error","errorMsg":"fetch failed"}`。**没有解释、没有重试按钮、服务端 chat.jsonl 为空（输入丢失）**，前端消息只存在于 localStorage。
4. 全程没有任何指引把我带到设置页配好模型再回来。

文档自己的结论与此完全一致：`Real LLM Flow: BLOCKED`、`Tutorial/onboarding: DEFERRED`、`Browser UI flow: NOT PROVEN`（docs/CURRENT_PROJECT_STATE.md 状态表）。**换句话说：当前仓库没有可复现、可审计的真实 AI 试玩闭环记录；因此不得宣称产品闭环 PASS。**这是全项目最大的单一风险，没有之一。

### 5.2 冷启动死亡螺旋

零内置内容 → 新用户 10 分钟内无体验 → 不会配 API key → 更不会创作内容 → 开源社区没有可讨论的"玩过的东西"→ 无反馈 → 开发继续在工程层空转。打破点只有一个：**先运出内容，再运出功能**（具体包见 02/03 文件）。

### 5.3 定位空隙分析（可行性的正面）

赛道现状：SillyTavern 是"角色陪聊全能前端"（重角色卡、重社区、机制复杂）；AI Dungeon/FableAI 是云订阅服务（数据不在本地）；AI 修仙模拟器等证明了"本地 API key + 结构化玩法"有真实付费/关注意愿。World Tree 手里独有的三张牌：

1. **提案审核 + canon 分离**（AI 不许直接篡改世界设定）——这是当前对位分析里最清晰的差异化之一；对外传播时避免写成"同类都没有"这类绝对句；
2. **隐藏信息边界**（剧本杀/推理的 GM 私有状态隔离）——ST 完全没有；
3. **结构化玩法切片**（骰子/线索板/资源/回合帧）——比"纯聊天"多半步游戏性。

结论：**产品方向可行，且差异化真实存在；不可行的是当前"重工程轻内容"的推进方式。**

---

## 6. 用户体验与前端设计审查

### 6.1 信息架构

- 侧栏 6 项（工作台/对话/资料库/世界管理/观测/设置）与产品叙事的"8 入口"互不对应——8 入口是工作台里滚动排列的卡片，新用户建立不了心智地图。
- 首屏把"创建"当作唯一动词。对回访用户，"继续上次的世界"才是高频动作，现在藏在次要位置。

### 6.2 对话体验（核心界面）逐项

| 问题 | 证据 | 影响 |
|---|---|---|
| 无流式 + 假进度文案 | sendChat 的 1.4s setInterval 轮换文案 | 30-60 秒白屏等待感；进度文案与真实阶段无关，属于"善意欺骗" |
| LLM 输出按纯文本转义显示 | C.chatMsg → `U.esc(m.content)`（console.js:292），无 Markdown 渲染 | 模型输出的 **加粗**、分段、列表全部变成裸字符，长叙事可读性差 |
| 错误 = 原始异常串 | 实测 `fetch failed`；无错误分类、无重试按钮（全仓 grep 不到对话级 retry） | 新用户直接流失点 |
| 全量重绘 | render() 每次 `#main.innerHTML = ...` + 重绑事件（console.js:1384-1400） | 长对话卡顿、滚动位置丢失、输入焦点闪烁 |
| 原生 alert/confirm | openCommandPanel 用 alert 列命令；清空对话用 confirm | 与整体视觉割裂，移动端体验差 |
| 命令可发现性 | 斜杠命令（/roll、/clue、/hypothesis…）只在 alert 里列出 | 结构化玩法（差异化卖点）被埋没 |

### 6.3 文案与信任

- 面向用户的界面直接暴露开发术语："Experimental"徽章、"薄切片"、"不是完整 4X"、"真相锁继续生效"、版本号 `v0.4.2-v2-engineering-foundation-truth.0` 印在侧栏。诚实值得保留，但需要一层"对外翻译"（内测中/抢先体验），当前观感是"施工现场直播"。
- 中英混排无规则（"Usable thin loop" 混在中文表格里）。

### 6.4 视觉

米白 + 森绿的浅色主题（--bg:#f7f5f0, --primary:#2f6b52）干净、有辨识度、对"叙事/纸张"隐喻贴切——**这是可以保留并强化的视觉资产**。问题在层级而非配色：工作台一屏 8 张等权重大卡，无视觉主次；ST-COMPARISON 里自我批评的"仅暗色"已过时（现在是仅浅色），主题切换 config 里有 `theme:"dark"` 字段但无实现。移动端：mobile-nav 存在，responsive 有基础。

---

## 7. 安全与隐私审查

做得好的（应当写进 README 当卖点）：

- 仅绑定 127.0.0.1 + 三重校验（remoteAddress 回环、Host 头、Origin/Referer 白名单，local-access.js）→ 有效防御 DNS rebinding 和恶意网页跨站打本地端口；非法 Origin 返回 403 且不反射 CORS 头（server.js:2733-2752）。
- 速率限制（静态 300/min、API 120/min）+ 定期清理防内存泄漏。
- path-security.js 的 pathWithinRoot/resolveInsideRoot 在所有文件写入点被使用（抽查 persistTurn、enqueueReviewItems 均有校验）。
- prompt 出网前擦洗本机绝对路径（scrubPromptForPrivacy）。
- API key 以 secretId 间接引用，不进 config.json；跨 hostname 重用告警。

需要修/需要说明的：

- **S-1** secrets.json 明文落盘。本地优先场景可接受，但 SECURITY.md 应明确告知 + 文件权限收紧（写入时 chmod 600，现在没有）。
- **S-2** 请求体上限 20MB（MAX_BODY_BYTES）对一个 JSON API 过大，配合 world-pack 导入路径应单独设限并流式落盘。
- **S-3** 历史消息不做隐私擦洗（C-5）。
- **S-4** 发布/打包卫生（C-9）：本次上传包里就带着 userData 与审计产物，万一哪天 secrets 是真的，就是事故。

---

## 8. 测试、CI 与文档

- 测试真实且有牙齿：抽样 tabletop-v2-hidden-leak.test.js、single-player-scriptkill 边界测试，断言具体行为而非空转。CI 矩阵 Node 18/20/22，preflight 串 30+ 个 gate。
- **结构性空洞**：所有测试都在"无 LLM"世界里。没有任何一条已入库、可复现的流水线（哪怕手动触发的）用真实模型跑一轮对话并对输出做最低断言。等于给飞机做了 1257 项地面检测，但缺少可复现的试飞记录。
- 文档：真相源纪律（PROJECT_TRUTH_SOURCE > CURRENT_PROJECT_STATE > …优先级链）是同类项目里罕见的自律，交接价值极高。代价：docs/ 90+ 文件中约一半是一次性闭环报告/审计记录，会吓退人类贡献者——需要"归档瘦身"（见 04 文件治理节）。

---

## 9. 问题总清单（按严重度）

**P0（阻断产品成立）**
1. 真实 LLM 全链路缺少可复现验证记录（§5.1）
2. 首轮失败输入丢失 + 裸错误文案（§5.1 / §6.2）
3. 零内置可玩内容（§5.2）
4. LLM JSON 解析裸奔导致 Director 名存实亡（C-1）
5. 创建接口静默丢弃用户内容（C-3）
6. Claude 预设按构造即坏（C-2）

**P1（阻断产品变好）**
7. 全局单例引擎状态 / 跨世界污染（§3.1）
8. 无流式输出（§3.4）
9. 世界书检索仅当前输入子串匹配（§4.3）
10. 全量 innerHTML 重绘 + 无 Markdown 渲染（§6.2）
11. `/api/chat/message` 实为编辑接口的命名陷阱（server.js:1930；本审查亦被其误导一次）
12. 客户端/服务端双份历史无对账（§3.6）

**P2（债务与打磨）**
13. 双巨石拆分未完成（§3.2）
14. world.json 被 moduleGraph 实现细节污染（§3.3）
15. 字符预算非 token 预算（§3.5）
16. 防剧透仅原文匹配（§4.4）
17. hermes 死配置、版本漂移、README 许可证段落过期、CRLF 混杂、fallback 8000/20000 不一致、alert/confirm、术语泄漏、secrets 权限（C-4~C-9, S-1~S-3）

以上每一条在《02-修复更正计划书》中都有对应的修复方案、验收标准与工作量估计。

---

## 10. 结语

World Tree 的处境可以概括为：**一座打了 1257 根桩、通过全部结构验收、但还没铺一条能走人的路的地基。** 好消息是三点：地基是真的（测试通过、安全边界认真、文档可交接）；差异化是真的（提案审核 + 隐藏边界 + 结构化玩法，同类没有）；缺口是集中的（几乎全部拥堵在"最后一公里"——内容、首轮、流式、错误恢复）。这意味着接下来 4-6 周的正确投入，产出会远高于过去同等投入——因为杠杆点从"广度"换成了"深度×体验"。
