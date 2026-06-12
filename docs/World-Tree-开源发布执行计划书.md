# World Tree — 开源发布与产品化执行计划书

> 计划书版本: 1.0 · 代码基线: v2.3.1 · 生成日期: 2026-06-10
> 本文档面向 AI agent 执行,综合 README.md / AI-GUIDE.md / CHANGELOG.md / PRODUCT-PROPOSAL.md 四份文档的评估结论。
> PRODUCT-PROPOSAL.md 基于 v2.2.1 编写且目标为「普通用户产品化」;本计划书已将其与 v2.3.1 现状对齐,并按「开源发布」目标重排优先级。差异对照见附录 A。

---

## 0. 执行总则(agent 必读,优先级高于一切任务描述)

### 0.1 不可违反的规则

继承 AI-GUIDE.md「修改规则」全部 13 条,并补充以下 7 条:

1. **每完成一个任务**: 对全部改动的 js 文件执行 `node --check` → 运行 `npm run preflight` → 三项全绿才算完成。
2. **一个任务 = 一次提交**。提交信息格式: `[T<任务编号>] <动作摘要>`,例如 `[T0.2] 同步 AI-GUIDE 文件地图至前端拆分后结构`。
3. **版本号联动**: 涉及代码行为变更的批次遵守 AI-GUIDE 规则 12,同步更新 CHANGELOG.md + package.json + README.md + AI-GUIDE.md 四处版本号。纯文档修复批次不升版本号,但要在 CHANGELOG 记一条。
4. **遇到 ⚠️ 决策点**: 立即停止该任务,向用户列出选项、各选项的影响和你的建议,等待答复后再继续。决策点全集见附录 B。
5. **永不提交**: secrets.json、含真实 key 的 config.json、`data/engine/` 下的用户世界与对话数据。每次提交前 `git status` 自查。
6. **不删除任何 @deprecated 模块**,除非 T1.6 对应的决策点(D7)已获用户答复。
7. **改动任何文档前先全文读取该文档**,禁止基于本计划书的摘要直接改写原文——原文可能有计划书未覆盖的内容。

### 0.2 任务格式说明

每个任务包含: **背景**(为什么做)/ **操作**(怎么做)/ **涉及文件** / **验收标准**(必须逐条核对)。带 ⚠️ 的任务含决策点。

### 0.3 阶段依赖与执行顺序

```
Phase 0 (文档一致性) → Phase 1 (开源就绪) → 【可对外发布】
  → Phase 2 (首次体验) → Phase 3 (数据与分发) → Phase 4 (品质,持续迭代)
```

Phase 0 和 Phase 1 是开源发布的硬前提,完成后即可建公开仓库;Phase 2-4 可在公开后迭代。

---

## Phase 0 — 文档一致性与仓库卫生(开源前硬性修复,约 1-2 天)

### T0.1 修复 CHANGELOG 版本日期错乱 ⚠️

**背景**: CHANGELOG 中 v2.3.1 标注 `2025-07-10`,早于其前序版本 v2.3.0(`2026-06-17`)将近一年;而 v2.3.0 的日期又晚于 AI-GUIDE 声称的 v2.3.1 更新日(`2026-06-09`)。版本时间线自相矛盾,开源后会让贡献者怀疑项目维护质量。

**操作**:
1. ⚠️ 决策点 D1: 向用户确认 v2.3.0 与 v2.3.1 的真实发布日期(agent 无法从仓库推断,可辅助查 git log 的 commit 日期供用户参考)。
2. 按确认结果修正 CHANGELOG 两处日期,同步修正 AI-GUIDE 头部「最后更新」行。
3. 在 `scripts/audit.mjs` 新增检查项:「CHANGELOG 版本日期必须单调递增」,防止回归。

**涉及文件**: CHANGELOG.md, AI-GUIDE.md, scripts/audit.mjs
**验收标准**: ① CHANGELOG 所有版本日期严格递增;② `npm run audit` 0 错误且新检查项生效(人为造一个乱序日期验证它能报错,再改回)。

### T0.2 同步 AI-GUIDE 文件地图至 v2.3.1 实际结构

**背景**: v2.3.1 已将前端拆为 `world-tree-console.html`(结构)+ `.css`(样式)+ `.js`(逻辑)三文件(CHANGELOG 与 README 源码结构均已体现),但 AI-GUIDE 文件地图仍写「world-tree-console.html ← 唯一 Web UI(13 标签页)」,未列出 css/js。后续 agent 按此地图改前端会找错文件。同时地图未列出 v2.3.1 新增的 `constants.js`、`state-persistence.js`、`tests/unit/`。

**操作**:
1. 全文读取 AI-GUIDE.md,重写「文件地图」一节: 补全前端三文件及各自职责、`src/core/engine/constants.js`、`state-persistence.js`、`tests/unit/` 四个测试文件。
2. 写一个一次性脚本遍历地图中每个路径,与仓库实际文件系统比对,输出缺失/多余清单,逐项修正。

**涉及文件**: AI-GUIDE.md
**验收标准**: ① 文件地图所列路径 100% 在仓库中真实存在;② 前端三文件、constants.js、state-persistence.js、tests/unit/ 均在列。

### T0.3 消除「上下文引擎」状态矛盾 ⚠️

**背景**: README「核心模块」表将「上下文引擎(统一全文检索+定向查表+合并排序)」标为 ✅,而 AI-GUIDE 将 `context-engine.js` 及 context-router/indexer/assembler 标注 `@deprecated v2.3.0,当前走 world-engine 直连`。同一模块一处宣称可用、一处宣称废弃,贡献者无法判断该不该基于它开发。

**操作**: ⚠️ 决策点 D2,二选一:
- (A) 确认废弃: README 核心模块表删除该行,或改为「已并入 world-engine 直连(v2.3.0)」;
- (B) 仍在使用: 移除源码中的 @deprecated 注释,并在 AI-GUIDE 恢复其地位。

**涉及文件**: README.md 或 src/core/engine/context-engine.js 等
**验收标准**: 全仓库(README / AI-GUIDE / 源码注释)对该模块的状态描述唯一且一致;`grep -r "上下文引擎"` 与 `grep -r "deprecated.*context"` 的结果互不矛盾。

### T0.4 清除机器特定路径

**背景**: AI-GUIDE 含 `D:\工作台\world-tree-desktop` 工作目录,泄露个人环境信息且对其他贡献者无效。v2.3.1 已修复代码中的 `C:\Users\Lenovo` 硬编码,但需复核文档、注释、测试中的残留。

**操作**:
1. AI-GUIDE「工作目录」一行改为「项目根目录(克隆到任意位置,以下记作 `<ROOT>`)」,运行命令相应调整为相对路径。
2. 全仓库执行 `grep -rn "D:\\\\" .` 和 `grep -rn "C:\\\\Users" .`(排除 node_modules、.git),逐项处理;`defaults/` 知识库正文中的命中单独列出交用户人工复核,不擅自改内容文件。

**涉及文件**: AI-GUIDE.md 及 grep 命中文件
**验收标准**: 代码、脚本、四份核心文档中无机器特定绝对路径;defaults/ 命中清单(如有)已输出给用户。

### T0.5 README 杂项修缮

**背景**: README 架构代码块首行有一个游离的 `|` 字符;属顺手修复项。

**操作**: 删除该字符;通读 README 渲染效果,修正其他明显的排版残破。

**涉及文件**: README.md
**验收标准**: Markdown 渲染无残破字符、无断裂代码块。

### T0.6 归档 PRODUCT-PROPOSAL 并防误导

**背景**: 提案基于 v2.2.1: ① 把 75 项集成测试误称为「75 个单元测试」(现状是 83 集成/语法测试 + 51 单元);② 成熟度雷达中性能、可测试性、数据安全等评分已被 v2.3.x 部分解决(异步 IO、单元测试框架、密钥脱敏、本地鉴权、速率限制);③ 其 P0「一键安装包」的优先级基于「普通用户产品化」目标,与开源发布目标不符。原文若留在根目录,后续 agent 可能基于过时信息行动。

**操作**:
1. 移动至 `docs/archive/PRODUCT-PROPOSAL-v2.2.1.md`。
2. 文件头部插入声明块: 「⚠️ 本提案基于 v2.2.1,部分数据已过时,执行计划以《World Tree 开源发布执行计划书》为准,差异对照见其附录 A。」
3. 本计划书放入 `docs/` 目录(若用户提供了最终版)。

**涉及文件**: PRODUCT-PROPOSAL.md → docs/archive/
**验收标准**: 仓库根目录不再有未加声明的过时提案;归档文件首屏可见取代声明。

### T0.7 .gitignore 与敏感文件入库审查 ⚠️

**背景**: 开源即公开全部 git 历史。必须确认 secrets.json、含 key 的 config.json、`data/engine/`(用户世界、对话记录、记忆快照)从未入库或已被忽略。

**操作**:
1. 审查 `.gitignore` 是否覆盖: `secrets.json`、`config.json`(或拆分出不含 key 的 config 模板)、`data/engine/worlds/`、`data/engine/characters/`、`data/engine/global-memory/`、日志与临时产物。
2. 执行 `git ls-files | grep -E "secrets|config\.json|data/engine"` 检查是否曾被追踪。
3. ⚠️ 决策点 D3: 若敏感文件曾入库,提示用户需用 `git filter-repo` 清理历史(或以全新仓库首发,旧仓库保留私有),由用户选择。
4. 新增 `config.example.json`(不含 key 的模板)供新用户复制。

**涉及文件**: .gitignore, config.example.json(新增)
**验收标准**: ① `git ls-files` 无敏感文件;② 全新克隆 + 按 README 启动可正常生成本地 config;③ 忽略清单写入后续 CONTRIBUTING(T1.5)。

---

## Phase 1 — 开源就绪(发布硬前提,约 3-5 天)

### T1.1 选择并添加 LICENSE ⚠️

**背景**: 无 LICENSE 的公开仓库在法律上「保留所有权利」,他人无法合法使用、修改、分发——等于没开源。

**操作**: ⚠️ 决策点 D4,用户必须拍板:

| 选项 | 适合 | 代价 |
|---|---|---|
| MIT | 最大化采用与二次开发,生态友好 | 允许任何人闭源商用(含 SaaS 套壳) |
| Apache-2.0 | 同 MIT + 显式专利授权 | 文本较长,对个人项目差异不大 |
| AGPL-3.0 | 防止云厂商闭源套壳,修改必须开源 | 会吓退部分商业使用者与公司贡献者 |

建议: 目标是社区繁荣与最大化使用 → MIT;在意被商业化套壳 → AGPL-3.0。
确定后: 根目录添加 LICENSE 全文 + `package.json` 的 `license` 字段 + README 顶部徽章,三处一致。

**验收标准**: LICENSE / package.json / README 徽章三处一致。

### T1.2 捆绑内容版权自查 ⚠️

**背景**: `defaults/engine-knowledge/`(29 篇文档)、`defaults/cases/`(剧本杀案例「镜中人之死」)将随仓库公开分发。若其中含摘录或改编自受版权保护作品的内容(小说设定、规则书文本、他人剧本),开源即构成公开分发,风险由仓库所有者承担。

**操作**:
1. 生成 `defaults/` 下全部内容文件的清单(路径 + 首 200 字摘要)。
2. 输出给用户逐项标注来源: 原创 / 已获授权 / 来源不明需移除。**agent 不得自行判断版权归属。**(⚠️ 决策点 D5)
3. 按用户标注处理: 移除项从仓库删除;保留项的确认结果存档为 `docs/content-provenance.md`。

**验收标准**: 清单已交用户确认;docs/content-provenance.md 存档;待移除项已删除。

### T1.3 README 面向开源重写 ⚠️

**背景**: 当前 README 是开发者备忘风格,缺少开源首页必需的「30 秒说服力」要素: 一句话定位、截图、最短上手路径、license/CI 徽章。另: 项目名含「Desktop」但 v2.0 起已是纯 Web 架构,发布后改名成本陡增,改名窗口就在现在。

**操作**:
1. ⚠️ 决策点 D6: README 主语言。英文为主 + `README.zh-CN.md` 中文完整版(面向国际社区),或反之(面向中文社区)。两份内容保持同构。
2. ⚠️ 决策点 D11: 是否在发布前更名(如 `world-tree` / `world-tree-engine`),去掉已名不副实的「Desktop」。仅提示,不强求。
3. 新 README 结构(自上而下):
   - 一句话定位(沿用提案第 7 节: 本地优先的 AI 叙事引擎 = 个人 AI 说书人 + 角色扮演伙伴 + 世界观构建工具,数据全在本地)
   - 截图/GIF(T1.4 产出后回填,先留占位)
   - 徽章: license / CI / version
   - 5 分钟 Quickstart: 前置要求(Node ≥ 18)→ `git clone` → `npm install` → `node server.js` → 浏览器配置 API Key → 第一轮对话
   - 支持的 LLM: DeepSeek(默认 `deepseek-v4-flash`)、任意 OpenAI 兼容端点、**Ollama 本地模型**(补充示例 baseURL,如 `http://localhost:11434/v1`——呼应「本地优先」主张,否则「本地优先但必须连云端 LLM」会被社区质疑)
   - 架构图、三模式表、核心特性: 从现 README 精简迁移
   - 链接区: AI-GUIDE(贡献者/agent 入口)、CONTRIBUTING、SECURITY、CHANGELOG

**涉及文件**: README.md, README.zh-CN.md(或反向)
**验收标准**: agent 以全新目录按 README 实测一遍,确认仅凭 README 可在 5 分钟内跑通首次对话;所有链接有效。

### T1.4 截图与演示 GIF

**操作**: 本地启动服务 → 截取首页(模组列表)、叙事对话页、炼金台三张图,存入 `docs/assets/`;录制或逐帧拼接一段 ≤30 秒的「粘贴文档 → 创建模组 → 开始对话」流程 GIF。回填 T1.3 占位。

**验收标准**: README 中图片全部正常显示;GIF < 10MB(GitHub 渲染限制)。

### T1.5 CONTRIBUTING.md + Issue/PR 模板

**操作**:
1. `CONTRIBUTING.md` 内容: 环境搭建(指向 README Quickstart)、目录导读(链接 AI-GUIDE 文件地图)、修改规则(引用 AI-GUIDE 全部 13 条而非复制,单一事实来源)、提交前必须 `npm run preflight` 全绿、提交信息规范、敏感文件清单(来自 T0.7)。
2. `.github/ISSUE_TEMPLATE/`: bug 报告(含版本号、Node 版本、复现步骤、preflight 结果)+ 功能建议两模板。
3. `.github/PULL_REQUEST_TEMPLATE.md`: 含「已运行 preflight」「已按规则 12 同步版本号(如适用)」勾选项。

**验收标准**: 文件就位;与 AI-GUIDE 规则零冲突(不复制改写,只引用)。

### T1.6 死代码处置 ⚠️

**背景**: `context-engine.js`、context-router/indexer/assembler、`hermes.js` 已标 @deprecated 但仍在源码树中。开源第一印象里,死代码是负资产,也会让贡献者误投入。依赖 T0.3 的决策结果(若 D2 选了 B「仍在使用」,本任务跳过)。

**操作**: ⚠️ 决策点 D7,三选一:
- (A) 直接删除(推荐,git 历史可随时找回);
- (B) 移入 `legacy/` 目录并在目录 README 说明;
- (C) 保留原位。

若选 A: 删除文件 → 全仓库 grep 引用并清理悬空 import → `npm run preflight` → 同步 AI-GUIDE 文件地图与 README 模块表。

**验收标准**: preflight 全绿;`node --check` 全部通过;无悬空 import;文档同步。

### T1.7 Hermes 个人系统解耦

**背景**: `/api/characters` 的双来源之一是本机 Hermes `skills/creative/` 目录——这是开发者个人的外部系统,其他用户机器上不存在。v2.3.1 虽已把 `C:\Users\Lenovo` 改为 `os.homedir()`,但路径仍假定 Hermes 存在;新用户调用该 API 的行为未知(可能报错或扫描无关目录)。

**操作**:
1. Hermes 路径改为 config.json 可选项 `characterSkillsDir`(默认为空 = 跳过该来源)。
2. 目录不存在或未配置时**静默降级**为单来源(仅 `data/engine/characters/`),不报错、不打 warning 刷屏。
3. README / AI-GUIDE 注明这是可选的外部集成;`config.example.json` 含该字段及注释。
4. 补一条集成测试: 「characterSkillsDir 未配置时 /api/characters 正常返回炼金台来源」。

**涉及文件**: server.js, src/core/data/skill-parser.js, config.example.json, scripts/test.mjs
**验收标准**: 无 Hermes 环境(干净机器模拟)下 `/api/characters` 返回 200 且仅含炼金台来源;新增测试通过;preflight 全绿。

### T1.8 GitHub Actions CI

**背景**: 开源项目没有 CI 徽章 = 「PR 质量靠自觉」。项目自带的 preflight 是现成的 CI 脚本。另一个隐藏价值: 项目迄今在 Windows 上开发,`serveStatic` 的 `toLowerCase` 路径处理等逻辑从未在 Linux 大小写敏感文件系统上验证过——CI 矩阵正好覆盖。

**操作**:
1. `.github/workflows/ci.yml`: 矩阵 = Node 18 / 20 / 22 × ubuntu-latest / windows-latest;步骤 = `npm ci` → `npm run preflight`。
2. README 添加 CI 状态徽章。
3. 若 Linux 上失败(大概率是路径大小写或分隔符问题),修复后再合并——这本身就是本任务的价值。

**验收标准**: 全矩阵首次运行通过;徽章显示 passing。

### T1.9 安全模型文档化

**背景**: 现有安全机制(localhost-only 鉴权、速率限制、密钥脱敏、路径遍历防护)是扎实的,但边界必须讲清,否则用户把服务暴露公网后出事会归咎项目。同时,提案 6.2 的「API Key AES 加密」需要修正: 本地应用的解密密钥也只能存本地,加密仅防瞄屏不防同机恶意程序——与其做伪安全,不如诚实声明威胁模型。

**操作**: 新建 `docs/SECURITY.md`(或仓库根 SECURITY.md),内容:
1. 威胁模型 = 本机单用户工具;明确「不要绑定 0.0.0.0、不要反向代理到公网、不要在共享主机上运行」。
2. secrets.json 为明文存储 + 依赖文件系统权限保护;诚实说明本地加密的局限;给出 `chmod 600 secrets.json` 建议(Unix)。
3. Roadmap 位: OS keychain 集成(macOS Keychain / Windows Credential Manager)列为远期可选项。
4. 漏洞报告渠道(GitHub Security Advisories 或邮箱)。

**验收标准**: 文档存在;README 链接到它;表述与实际代码行为一致(逐条对照 server.js 核实)。

---

## Phase 2 — 首次体验(吸收提案建议 2/3/5,约 1 周)

> 开源后流量峰值在发布当天,新用户首次体验决定 star 转化率。本阶段对应提案 P0 的「向导 + 错误信息」与 P1 的「示例」,但调整了内部顺序: 示例先于向导,因为向导第二步依赖示例兜底。

### T2.1 内置示例内容(提案建议 5,提前执行)

**背景**: 新用户首次打开零内容,必须先经历炼金台或手动创建才能体验核心功能——大多数人在此流失。向导(T2.2)第二步「创建第一个模组」也需要模板兜底。

**操作**:
1. `defaults/examples/` 下创建:
   - 1 个微型示例世界: 1 名主角 + 2 个场景 + 6~10 条 worldbook 条目(全部原创内容,通过 `src/core/schemas/` 对应 schema 校验);
   - 2 张预置角色卡: `card.json` 用 VC-3 字段**手写完整人格画像**(欲望/恐惧/口癖/场景响应等),不依赖 LLM 生成,保证零配置可加载。建议形象: 「图书馆管理员」「神秘旅人」之类无版权风险的原型角色。
2. 首页新增「试试看」入口: 点击后将示例**复制**到用户数据区再加载(只读副本,避免用户对话污染 defaults/)。
3. 示例世界遵守 AI-GUIDE 规则 8: 复制出的实例正常持久化,defaults/ 原件永不写入。

**涉及文件**: defaults/examples/(新增), world-tree-console.js, server.js
**验收标准**: ① 全新安装、仅配置 API Key 后,点「试试看」→ 一轮对话成功;② 示例文件全部通过 schema 校验;③ defaults/examples/ 在对话后无任何文件变更(`git status` 验证)。

### T2.2 首次运行向导(提案建议 2)

**操作**: 按提案三步结构实现,补充以下落地细节:
1. 触发条件: config.json 不存在,或其 `firstRun !== false`。
2. Step 1(连接 LLM): 表单预填默认地址与模型;「下一步」前调用 `/api/llm/test`,失败时展示 T2.3 的人话错误而非裸报错;成功才放行。
3. Step 2(创建模组): 三选项 —「创建新世界」「用角色卡开始(列出 T2.1 预置卡)」「从文档创建(跳转炼金台)」。
4. Step 3(开始对话): 写入 `firstRun: false`,给出示例首句提示。
5. 向导可随时「跳过」;设置页提供「重新运行向导」入口。

**涉及文件**: world-tree-console.js, world-tree-console.css, server.js(config 增加 firstRun 字段)
**验收标准**: 删除 config.json 重启 → 向导出现 → 三步走通 → 刷新页面不再出现;跳过路径与重新触发路径均可用;preflight 全绿(注意 interface-audit 的 API 契约项: 新增返回字段必须被前端使用)。

### T2.3 错误信息人性化(提案建议 3,从散修升级为机制)

**背景**: 提案列了 5 条错误文案映射,正确但属于「打补丁」。应建立统一错误层,后续新错误自动获得「人话 + 技术细节」双轨。

**操作**:
1. server.js 新增统一构造器 `errorResponse(code, userMsg, detail)`: `userMsg` 面向用户(中文人话 + 解决建议),`detail` 含原始错误供排障。
2. 前端 toast 只展示 `userMsg`;`detail` 输出到浏览器 console.error。
3. 覆盖场景 = 提案表 5 条 + 三类常见上游错误: LLM 请求超时 / API Key 无效(上游 401)/ 配额或限流(上游 402/429)。
4. 顺带实现提案 6.3 的 `/api/health`: 返回版本、端口、LLM 配置状态(不含 key)、磁盘可写性,向导与排障共用。

**涉及文件**: server.js, world-tree-console.js
**验收标准**: 逐场景手测(断网 / 错 key / 占用端口 / 超时模拟),每个场景用户看到的是人话文案;不再有裸 `fetch failed` 抵达用户;`/api/health` 字段被前端使用(满足 interface-audit API 契约)。

### T2.4 对话导出为可读文本(从提案建议 6 拆出的低成本高感知项)

**操作**: 对话页新增「导出」按钮: `runtime/chat.jsonl` → Markdown 小说体(`### 第 N 轮` 分隔 + 角色名前缀 + 叙事正文),浏览器触发下载。搜索、分支、消息操作等重交互项留在 T4.1。

**涉及文件**: world-tree-console.js, server.js(新增导出端点或前端直转)
**验收标准**: 导出文件含轮次与角色名;中文无乱码(UTF-8 BOM 或明确 charset);空对话导出有友好提示。

---

## Phase 3 — 数据与分发(约 1 周)

### T3.1 模组导出/导入 .wtpack(提案建议 4 + 安全加固)

**操作**: 按提案实现(`world.json` + `shared/*` + `runtime/*` → ZIP,扩展名 .wtpack),**必须补充**:
1. 导入时逐文件做 schema 校验,非法结构整体拒绝;
2. 模组名冲突时自动追加后缀(`-1`, `-2`)而非覆盖;
3. **ZIP 路径穿越防护**: 解包前校验每个 entry 路径,含 `..` 或绝对路径的直接拒绝——.wtpack 将在社区流通,这是真实攻击面;
4. 导入来源标注: world.json 写入 `importedFrom` + 时间戳。

**涉及文件**: src/core/export.js(新增), server.js, world-tree-console.js
**验收标准**: ① 导出 → 删除 → 导入 round-trip 后目录 diff 一致;② 构造含 `../evil.txt` 的恶意 zip,导入被拒绝且有测试用例固化;③ preflight 全绿。

### T3.2 全量备份 + 对话归档(合并提案 6.3 日志轮转)

**操作**:
1. 设置页「一键备份」: 整个 `data/engine/` → 带时间戳 ZIP,提供下载;
2. `chat.jsonl` 超过 10MB 自动滚动归档为 `chat-<日期>.jsonl`,历史 API 读取逻辑兼容归档文件(继续满足 AI-GUIDE 规则 7 JSONL 一致性);
3. 设置页显示数据目录路径与当前占用空间。

**验收标准**: 备份 ZIP 可解压恢复;归档触发后「最近 50 轮历史」API 仍返回正确内容;interface-audit JSONL 项通过。

### T3.3 单命令分发(修正提案建议 1 的技术选型)⚠️

**背景(重要修正)**: 提案推荐的 vercel/pkg 已于 2024 年归档停止维护,**不要采用**。替代路线:
- 路线 1(推荐先做): **npx / 全局安装包** — `package.json` 加 `bin` 字段,发布 npm,用户 `npx world-tree` 一条命令启动,启动后按平台自动打开浏览器(`start` / `open` / `xdg-open`)。对开源受众(已有 Node 的开发者、技术爱好者)这是最自然的分发,成本约半天。
- 路线 2(后做): Node 20+ 官方 **SEA**(Single Executable Applications)打 exe/app。注意 SEA 对动态 `require` 和运行时读取 `defaults/` 资源有限制,需要评估资源打包方案(嵌入 or 首次运行解压)。

⚠️ 决策点 D8: 确认「先 npx 后 exe」的顺序,以及 npm 包名(受 D11 改名决策影响)。

**验收标准(路线 1)**: 干净机器 `npx <包名>` 一条命令 → 浏览器自动打开首页;Ctrl+C 优雅退出。

### T3.4 多 LLM 配置预设(提案建议 8)

**操作**: 按提案实现,内置三模板: DeepSeek / OpenAI / Ollama(本地);「按模组绑定配置」为模组级可选字段,未设置时回落全局;配置导出功能**剔除明文 key**(沿用规则 9 的掩码标准)。

**验收标准**: 切换预设后 `/api/llm/test` 即时生效;导出的配置文件 grep 不到真实 key;interface-audit 密钥安全项通过。

---

## Phase 4 — 品质(开源后持续迭代,按提案 P1/P2 调整)

> 本阶段每项独立成 PR,无严格顺序,以下为建议优先级排序与对提案的修正说明。

### T4.1 对话搜索 + 消息操作(提案建议 6 剩余项)
搜索高亮、消息复制/收藏/删除/引用。**对接提醒**: 提案中的「对话分支」功能,项目已有 `branch-system.js` 四态分支管理(v2.3.1 已全异步化)——必须复用它而不是在前端另起炉灶,否则出现两套分支真相。

### T4.2 状态面板图表化(提案建议 7)
四维情绪条形动画 + 近 N 轮折线。**约束**: 前端 js 已 59KB,图表用原生 canvas/SVG 手写小实现(几十行足够),不引入 chart 库。

### T4.3 主题系统(提案建议 10)
亮色变量集 + 强调色,偏好写入 config.json `theme` 字段。

### T4.4 响应式布局(提案建议 11)
`<768px` 单列断点。13 个标签页在窄屏改为下拉或抽屉。

### T4.5 i18n(提案建议 12,范围拆分)⚠️
UI 字符串先行(`locales/zh.json` + `en.json` + 轻量 `t()` 函数)。**引擎 prompt 双语版单独立项**: 六标记段协议、Director 分析、Guardian 校验词库(中文 2-gram 匹配!)全部深度绑定中文,英文版近似重写引擎语言层——⚠️ 决策点 D9: 视英文用户真实需求再启动,不随 UI i18n 捆绑。

### T4.6 性能(提案建议 13,顺序调整)
优先级: ① worldbook 倒排索引(大世界书是引擎核心路径,收益最大);② 虚拟滚动;③ 仪表盘懒加载。聊天截断归档已在 T3.2 完成。

### T4.7 PWA(提案建议 9,降级)
**修正**: 本地服务器架构下,Service Worker 离线缓存价值很低——server.js 不运行时,界面打得开也无 API 可用。仅做 `manifest.json` 实现「安装到桌面」的图标/独立窗口体验(成本半天),SW 不做。

### T4.8 版本更新提示(提案建议 14,修正)
**修正**: 「静默下载替换 exe」极易触发杀毒软件误报,且自更新程序本身是高风险代码。改为: 启动时 fetch GitHub Releases 最新 tag → 有新版仅在 UI 提示 + 跳转下载链接,不自动替换。检查失败静默忽略(离线环境不报错)。

### T4.9 代码质量基建(提案 6.1,渐进路线)⚠️
顺序: ① ESLint(1 天,统一风格);② JSDoc 类型注释 + 文件头 `// @ts-check` 渐进获得类型检查(零构建步骤,契合零依赖哲学);③ Playwright 冒烟测试 3 条路径(首次向导 / 创建模组对话 / 炼金台导入)。⚠️ 决策点 D10: **不建议**全量 TypeScript 迁移——项目「零外部依赖、node 直跑」的架构卖点会被构建链破坏,收益/成本比低,除非用户明确要求。

---

## 附录 A — 与 PRODUCT-PROPOSAL.md 的差异对照

| 提案项 | 处置 | 落点 | 原因 |
|---|---|---|---|
| 建议 1 一键安装包(pkg) | **修改** | T3.3 | vercel/pkg 已停维;开源首发 npx 更契合受众,exe 用 Node SEA 后做 |
| 建议 2 首次向导 | 保留 | T2.2 | 补充触发条件、校验、重入口等落地细节 |
| 建议 3 错误信息 | 保留+升级 | T2.3 | 从逐条文案改为统一错误层机制 |
| 建议 4 导出/备份 | 保留+加固 | T3.1/T3.2 | 增加 zip 路径穿越防护(.wtpack 会在社区流通) |
| 建议 5 内置示例 | 保留+提前 | T2.1 | 向导第二步依赖示例兜底;增加版权安全要求 |
| 建议 6 对话改进 | 拆分 | T2.4 + T4.1 | 导出先行;分支必须复用 branch-system.js |
| 建议 7 状态面板 | 保留 | T4.2 | 限制: 不引入图表库 |
| 建议 8 多配置 | 保留 | T3.4 | 增加导出剔除明文 key 要求 |
| 建议 9 PWA | **降级** | T4.7 | 本地服务器架构下 SW 离线价值低,仅做 manifest |
| 建议 10-13 | 保留 | T4.3-T4.6 | 性能项内部顺序调整: 倒排索引优先 |
| 建议 14 自动更新 | **修改** | T4.8 | 静默替换 exe 有杀软误报与安全风险,改提示式 |
| 6.1 TypeScript 迁移 | **调整** | T4.9 | 渐进 @ts-check 替代全量迁移,保住零依赖卖点 |
| 6.2 API Key AES 加密 | **替换** | T1.9 | 本地加密属伪安全;改为诚实的威胁模型文档 + keychain roadmap |
| 6.3 运维三项 | 合并 | T3.2(轮转)/ T2.3(health)/ T2.3(启动日志顺带) | — |
| 成熟度雷达 26/100 | 作废重估 | T0.6 归档 | 基于 v2.2.1;v2.3.x 已解决性能/单测/部分安全项 |
| 「75 个单元测试」 | 勘误 | T0.6 | 实为 83 集成/语法测试 + 51 单元(v2.3.1 起) |

**提案撰写后已被 v2.3.x 完成、无需重做的项**: branch-system 与 server JSONL 异步 IO、进程内状态持久化(state-persistence.js)、前端三文件拆分、单元测试框架(51 条)、密钥脱敏、本地访问鉴权、速率限制、端口错误提示。

**提案完全未覆盖、本计划补充的开源特有项**: LICENSE(T1.1)、捆绑内容版权自查(T1.2)、英文 README + 截图(T1.3/1.4)、CONTRIBUTING 与模板(T1.5)、死代码处置(T1.6)、Hermes 解耦(T1.7)、跨平台 CI(T1.8)、文档一致性修复(Phase 0 全部)。

---

## 附录 B — 决策点汇总(用户待办,agent 执行到对应任务时逐项确认)

| # | 决策内容 | 所在任务 | 建议 |
|---|---|---|---|
| D1 | v2.3.0 / v2.3.1 的真实发布日期 | T0.1 | 参考 git log 实际 commit 日期 |
| D2 | 上下文引擎: 确认废弃 or 恢复使用 | T0.3 | 废弃(架构已走 world-engine 直连) |
| D3 | 敏感文件若曾入库,是否清理 git 历史 | T0.7 | 曾入库则必须清理或新仓首发 |
| D4 | 开源 License | T1.1 | 社区优先 → MIT;防套壳 → AGPL-3.0 |
| D5 | defaults/ 各内容文件版权来源逐项确认 | T1.2 | 来源不明一律移除 |
| D6 | README 主语言(英主中辅 / 中主英辅) | T1.3 | 取决于目标社区 |
| D7 | 死代码: 删除 / 移 legacy / 保留 | T1.6 | 直接删除(git 可找回) |
| D8 | 分发顺序与 npm 包名 | T3.3 | 先 npx 后 SEA |
| D9 | 引擎 prompt 英文版是否立项 | T4.5 | 暂缓,视英文用户反馈 |
| D10 | 是否全量 TypeScript 迁移 | T4.9 | 不迁移,@ts-check 渐进 |
| D11 | 是否在发布前更名(去掉 Desktop) | T1.3 | 可选;若改,发布前是唯一低成本窗口 |

---

## 附录 C — 每任务收尾自查单(agent 逐条核对)

1. `node --check` 通过全部改动的 js 文件;
2. `npm run preflight` 全绿(audit + 83 集成/语法测试 + interface-audit 52 项);
3. `npm run test:unit` 51 条通过(改动引擎核心时);
4. 若改动 server.js / 前端 / 引擎: 单独确认 interface-audit 的 API 契约项——新增返回字段必须被前端使用;
5. 若升版本号: CHANGELOG.md + package.json + README.md + AI-GUIDE.md 四处同步(规则 12);
6. `git status` 无意外未跟踪文件,尤其 data/、secrets.json、config.json;
7. 提交信息为 `[T编号] 摘要` 格式;
8. 本任务的全部「验收标准」逐条核对并在提交说明中列出结果。
