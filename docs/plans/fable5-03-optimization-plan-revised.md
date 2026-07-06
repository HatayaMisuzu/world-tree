# World Tree 优化升级计划书（修订版）

> 修订说明：本版保留 fable5 的建设路线，但增加执行边界：本文件不用于抢跑 P0；A-1 多 Provider、C-1 大厅、D-1 ST 导入等均需在《02》里程碑 A/B 后进入对应版本。对外增长判断避免绝对化表述，所有产品级 PASS 必须回到 E-3 三证。


性质：本文是"从能用到好用、从好用到有护城河"的建设方案，前置条件是《02》里程碑 A/B 完成。每节均给出可直接开工的设计规格，而非方向性口号。总体量约 8-10 周（与 04 文件的 v0.6/v0.7 版本对应）。

---

## A. AI 交互层 2.0

### A-1 多 Provider 适配层（替代"一刀切 OpenAI 格式"）

现状：唯一路径 `{base}/chat/completions` + Bearer，导致 Anthropic 原生 Claude 预设必坏、Gemini 原生接口不可接、各家 json/stream 能力差异无处安放。P0 阶段只修 Claude 经 OpenRouter 的预设；本节是 v0.6 的正式 provider 层，不得提前侵入 FIX-01~08。

设计：`src/adapters/providers/` 下 provider 接口五方法：`chat(messages, opts)`、`chatStream(...)`、`supports()`（json_mode/stream/system_role 能力表）、`normalizeError(e)`、`countHint(text)`。首批四个实现：

1. `openai-compatible.js`（现逻辑收编，覆盖 DeepSeek/OpenRouter/Ollama/vLLM/LM Studio）
2. `anthropic.js`：POST /v1/messages、`x-api-key` + `anthropic-version` 头、system 独立字段、`content[].text` 拼接、SSE 事件 `content_block_delta` 解析
3. `google.js`：generateContent / streamGenerateContent、`contents[].parts`、systemInstruction 字段
4. `mock.js`：录制回放（见 E-2）

connections.json 已有 `provider` 字段（现状只是标签）——升级为真正的路由键，零数据迁移。验收：三家真实凭据各过一轮 smoke:first-play；能力表单测锁定。估时 4 天。

### A-2 提示词分层排序（为 Provider 端 Prompt Caching 省钱）

现状 buildWriterPacket 把方向包、世界书命中、上下文混排——每轮前缀都变，任何提供商的前缀缓存都命中不了。

重排原则（稳定 → 易变）：`[1 系统身份+写作规则（整局不变）] → [2 世界正典摘要：canon 角色/规则（低频变）] → [3 世界书命中（中频）] → [4 近期历史（每轮变）] → [5 方向包+本轮输入（每轮变）]`。段间加稳定分隔符。配合 DeepSeek/Anthropic/OpenAI 等 provider 的前缀缓存能力，长会话输入侧成本有机会显著下降；具体降幅受 provider、模型、上下文稳定度影响，需用 A-3 usage 记录实测，不在文档中承诺固定比例。改造点集中在 world-engine.js 三个 packet builder，估时 1.5 天，是全计划性价比最高的一项。

### A-3 成本与用量仪表

适配层统一捕获响应 usage（prompt/completion tokens），逐轮写入 runtime/usage.jsonl；前端对话页角标显示"本轮 ~{n} tokens / 本局累计"；设置页可填单价（元/百万 token）换算金额。目的：用户自带 key 的产品，成本透明 = 信任 = 敢开 Director/Guardian 双阶段。估时 1 天。

### A-4 上下文压缩：让 L2 会话记忆真正工作

现状 L2 靠写死的启发式升格（intensity==="高"），长局后既漏也胀。设计：新增 prompt-task-contract `session-recap`（temperature 0.2, maxTokens 400）——每 10 轮或场景切换时，把滚出 L1 窗口的轮次交给 LLM 产出结构化纪要 `{keyEvents[], decisions[], newFacts[], openThreads[]}`，`newFacts` 走既有提案审核队列（不直写 canon，复用差异化机制！），其余入 L2。packet 组装时历史 = 纪要链 + 最近 N 轮原文。验收：40 轮长局中，第 5 轮确立的事实在第 38 轮 packet 内仍可见且总上下文不超预算。估时 2 天。

### A-5 每模式管线配置化

现状 skipDirector/skipGuardian 散落在调用点。收敛为 `defaults/pipeline-profiles.json`：

```json
{ "character":      { "director": "js",     "guardian": "off" },
  "world-rpg":      { "director": "hybrid", "guardian": "off" },
  "murder-mystery": { "director": "hybrid", "guardian": "on-hidden-leak" },
  "tabletop":       { "director": "js",     "guardian": "off" } }
```

设置页出"叙事质量/速度/成本"三档滑杆映射到 profile 覆盖。让三角色架构从纸面能力变成用户可感知的可调质量。估时 1 天。

---

## B. 架构演进

### B-1 WorldSession 升格为一等公民

在 FIX-10 基础上再进一步：Session 持有 `{memory, worldbookIndex, pipelineProfile, usageMeter, turnQueue}`，所有 /api/llm/* 与 V2 runtime 路由必须经 SessionRegistry 取会话。收益：观测页可以列出活跃会话、内存占用、逐会话调试——把现在散落的 turn/debug、dashboard/* 端点统一到会话视角。估时 2 天（FIX-10 完成后）。

### B-2 V1/V2 收敛路线（终结双轨）

判断：22 个 legacy wrapper（M1-M15）+ engine/ 下 20 个大文件是最大存量债，但**不应现在偿还**——它支撑着 quick-setting/character/world-rpg 三个最可用入口。收敛策略分三步走，每步独立可停：

1. **冻结**（立即）：docs 声明 legacy 引擎 feature-freeze，新机制只进 V2 侧；CI 加"legacy 目录行数不增"守卫（audit-architecture-debt.mjs 已有雏形，加阈值断言即可）。
2. **抽共核**（v0.6）：把两轨重复实现的三个概念——回合状态帧（turn-state-frame-service 已是 V2 版）、隐藏信息过滤、提案写入——统一为 `src/core/kernel/` 单实现，两轨各自薄适配。
3. **迁移**（v0.7+）：world-rpg 作为最后一个 legacy 消费者迁到 V2 runtime；届时 wrapper 目录整体移入 legacy/ 待删。

### B-3 存档与世界包格式 v1（.wtpack）

现状 world-pack export/import 已有路由但无版本化规范。定稿规格：

```text
mypack.wtpack = zip{
  manifest.json   { specVersion:1, kind:"world|character|case|scriptkill",
                    id, title, author, license, minEngine:"0.5.0",
                    contentRating, checksums:{...sha256} }
  shared/…        正典内容（现有结构）
  runtime/seed…   可选：开场存档
  README.md       给人看的介绍
}
```

规则：import 时校验 specVersion 与 checksum、拒绝 zip-slip（复用 path-security）、`kind` 决定落入哪个入口；export 时剥离一切 hidden/private 字段之外还要剥 usage/日志。这是 v0.7 社区内容分享的地基，规范先行成本较低，但不得在 v0.4.3 止血期抢跑实现。估时 1.5 天（规范 + 校验器 + 测试）。

---

## C. 用户体验重设计

### C-1 信息架构：从"控制台"到"游戏大厅"

三屏模型替代现在的 6 导航 + 8 卡瀑布。注意：这是 v0.6 级 UX 建设，不应与 FIX-09/11 的流式和增量渲染混在同一批执行：

1. **大厅（默认首屏）**：顶部"继续冒险"——最近 3 个世界大卡（封面色块 + 最后一轮叙事摘录两行 + [继续] 按钮）；其下"开始新的"——8 入口收敛为 8 个小磁贴，各带一句人话定位与 [示例][新建] 双按钮。回访用户 1 击回到上次现场（modules/load 已回传历史，纯前端工作）。
2. **入口详情页**：点磁贴进入，包含：这是什么（3 行）、一个 60 秒示例回放（预录的对话截录，静态数据即可）、[用示例开始] [导入我的素材] [从空白开始] 三条路径。终结"8 个一样的粘贴框"。
3. **游玩屏**：见 C-2。

侧栏保留但重组：大厅 / 我的世界 / 资料库 / 观测 / 设置（"对话"并入世界，点世界即进游玩屏）。

### C-2 游玩屏对标清单（逐项可验收）

| 项 | 规格 | 依赖 |
|---|---|---|
| 流式气泡 | 增量渲染 + 光标闪烁 + 停止按钮 | FIX-09/11 |
| Markdown 叙事 | md-lite 白名单渲染 | FIX-11 |
| 消息操作悬浮条 | 重新生成（已有 candidates 数据结构，补 UI）/ 编辑 / 收藏 / 从此分支 | 后端全部现成 |
| 分支树可视化 | branch-system.js 已有完整分支后端——右侧抽屉画简单树（缩进列表即可，不必图形库），节点点击 = 切换分支 | 纯前端 |
| 状态侧栏 | 现有 stat_bar/inventory_grid/status_list 渲染器保留，移入可折叠右栏，随 event:done 增量刷新 | 现成 |
| 命令菜单 | 输入 "/" 内联浮层，按当前模式过滤命令并附一行说明 | FIX-11 |
| 提案红点 | 待审核提案 > 0 时游玩屏顶部出横幅"AI 提议了 2 项设定变更 [审阅]"，点开右侧抽屉逐条 批准/编辑/拒绝 | review 路由现成 |
| 开场引导 | 空世界首屏给 3 条建议行动 chips（demo 包内置，用户世界由 quick-setting 时的 LLM 任务生成一次） | FIX-06 / A-5 |

提案红点是重点：**把项目最独特的机制从"资料库深处的列表"提到游玩主流程里**，让用户每局都感知到"AI 不会乱改我的世界"。

### C-3 设置页信息架构

现状设置混杂连接/模型/角色模型/超时。重组为三卡：连接（provider 预设 + key + [测试连接] 即时反馈）、叙事（质量/速度/成本三档滑杆 → A-5 profile；上下文规模 tiny/balanced/rich 人话化为"短局省钱/均衡/长局沉浸"）、高级（按角色模型、超时、调试）。加"从 SillyTavern 迁移？[导入角色卡]"入口（D-1）。

### C-4 视觉语言

保留米白+森绿纸感主题并系统化：定义 spacing/字号/圆角 token 表补进 CSS 变量；补暗色主题（config 里 theme:"dark" 字段早已存在，实现 `[data-theme=dark]` 变量覆盖即可）；8 入口各配一个主色相与简笔 icon（现在是抽象几何符号 □◇▦，认知度为零）。估时 2 天。

---

## D. 内容与兼容生态（获客的真正杠杆）

### D-1 SillyTavern 角色卡导入（最高优先级的单个增长功能）

理由：SillyTavern 生态里有大量现成角色卡（PNG 内嵌 JSON），支持导入 = 存量用户低成本迁移试用。该判断用于内部增长优先级；公开文案不要写成"抢 ST 用户"，而应写成"把你的角色卡带进规则约束世界"。规格：

1. 解析 PNG tEXt/iTEXt chunk 中 key 为 `chara`（base64 JSON，chara_card_v2/v3 规范）；纯 JSON 文件同样接受。
2. 字段映射：`name/description/personality/scenario/first_mes/mes_example → WT 人物卡对应域`；`character_book.entries → 世界书条目（keys/secondary_keys/content/insertion_order→priority）`；`alternate_greetings → candidates`。
3. 落点：/api/characters/import 扩展 `format:"st-png"`；前端人物卡入口加拖放 PNG 支持（现有拖放区只收 md/txt/json，扩类型即可）。
4. 不支持字段（extensions 内的脚本类）明确列出并提示忽略，不静默吞（吸取 C-3 教训）。

验收：从公开卡站取 10 张流行卡导入，8+ 张开箱即可对话且开场白正确。估时 2.5 天（PNG chunk 解析纯 JS 约 80 行，无依赖可守住零依赖线）。

### D-2 ST 世界书（lorebook JSON）独立导入

映射表：`entries[].key→keys、keysecondary→secondaryKeys、content→content、order→priority、constant→常驻(绕过匹配)、disable→enabled 取反`；`selective/logic` 降级为注释保留。配合 FIX-12 的检索升级，WT 才有资格接住这些数据。估时 1 天。

### D-3 官方内容管线

把 FIX-06 的 3 个 demo 扩展为常设生产线：炼金台生成 → 人工终审 → .wtpack 发布到仓库 `content/` 目录 + GitHub Release 附件。目标节奏：每个月 1 个精品包（与版本发布错开两周，让"有新东西玩"的节拍独立于"有新功能"）。每包发布标准：真人完整试玩 ≥ 30 分钟、hiddenTruth 泄漏冒烟通过、README 含 3 张实况截图。

---

## E. 质量基建（防止退回"没有可复现试飞证据"状态）

### E-1 LLM 冒烟三层制

| 层 | 内容 | 触发 | 成本 |
|---|---|---|---|
| Tier-0 | 现有 1257 条合同测试 + prompt 契约审计 | 每次 push（现状保持） | 0 |
| Tier-1 | smoke:first-play（FIX-08）× 每 provider | 每夜定时 + 发版前必跑 | < ¥1/次 |
| Tier-2 | 叙事质量评测（E-2） | 每版本手动 | ¥5-20/次 |

### E-2 叙事质量评测集 + 录制回放

1. 评测集：20 个固定场景 prompt（覆盖 8 模式，含 5 个"陷阱"：诱导泄漏 hiddenTruth、诱导 OOC、诱导改写 canon、超长输入、空世界书）；每个配 3-5 条机器可判 rubric（含关键词/不含关键词/长度域/JSON 可解析）+ 1 条人工 1-5 分。结果写 docs/reports/narrative-eval-{version}.md，版本间可对比。
2. 录制回放（mock provider 的数据源）：Tier-1 跑真模型时把请求/响应对录进 tests/fixtures/llm-recordings/；Tier-0 的集成测试可选用录像回放，让"接近真实的 LLM 行为"进入免费测试层；录像不得包含真实 API Key、隐私路径或用户私密内容。

### E-3 把"产品验收"写进真相源

在 docs/STATUS_TERMINOLOGY.md 增补一档：**PLAYABLE = Tier-1 通过 + 1 次真人试玩记录 + 1 段 ≥60s 录屏**。今后任何入口状态要标 PLAYABLE 必须挂三证。agent 可以自证工程闭环，但不能单独签发 PLAYABLE；PLAYABLE 必须由维护者在真实试玩证据基础上确认。

---

## 优先级总览（若资源只够做一半）

必做前五（仅在《02》里程碑 A/B 完成后启动）：A-2 提示词分层（1.5 天，优先实测成本收益）→ D-1 ST 角色卡导入（2.5 天，重要增长杠杆）→ C-1 大厅改版（3 天）→ A-4 会话纪要（2 天，长局质量）→ C-2 提案红点（1 天，把差异化亮出来）。其余按 04 文件的版本节奏铺开。
