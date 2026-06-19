# World Tree · CHANGELOG

> 审查记录。AI 无需阅读此文件。

## Unreleased — v0.3.0

### Fixed
- `interface-audit` 的 shared 文件 IO 校准会同时扫描 `server.js` 与 `src/server/module-service.js`，避免服务拆分后误报 `createModule` 写入但 `buildModuleModel` 不读取。

### Added
- 新增 `docs/v0.3.0-baseline-audit.md`，记录 v0.3.0 升级前的版本、测试、文件规模和已知风险基线。

### Changed
- README / README.en 明确当前升级目标统一收敛到 v0.3.0，但暂不修改公开 package version。

### Security
- 新增统一路径安全模块，覆盖 URL 编码路径、null byte、绝对路径、Windows 盘符/UNC、超长路径和混用分隔符等边界。
- 路由安全集成测试覆盖非本地 Origin、速率限制、请求体上限、非法 JSON、非对象 JSON、空 body 与导入路径穿越。
- `.worldtree` 导入增加前置 schema/files 校验和更完整预览，恶意路径、secrets/config 文件会在写入前被拒绝，冲突世界继续自动重命名。

### Deferred
- 插件系统暂不展开。
- 社区与生态暂不展开。
- 完整示例世界内容另行制作，不阻塞 v0.3.0。

## v0.2.2 — 安全硬化与测试补齐 (2026-06-18)

### Fixed
- **Dashboard telemetry 状态读取修复**：补齐 `moduleStatePath()`，`/api/dashboard/telemetry` 现在能读取真实 `runtime/state.json`，返回正确 `turnCount`、`lastScene` 和 `engineState`。
- **事件循环阻塞缓解**：聊天记录编辑路径改为异步读取；健康检查数据目录大小统计改为异步限时扫描；`buildModuleModel()` 增加短 TTL 缓存并在创建、删除、回合持久化后失效，减少 dashboard 连续 tab 请求重复读盘。
- **Guardian 评分去重**：mustInclude/mustNotInclude 的稳定检查与旧模糊检查结果会在评分前去重，避免同一问题双倍扣分并触发不必要的 LLM 自动修正。
- **旧版 LLM 入口超时**：`sendGameTurn()` 增加 `AbortSignal.timeout(config.llmTimeoutMs || 60000)`，与主 LLM 调用路径保持一致。
- **运行时内存清理与恢复**：回合持久化保存完整 `engineSnapshot`；加载模组时恢复快照；删除模组时清理对应 Director 预测缓存和 overlay pending 内存队列。
- **Overlay pending 可消费**：新增 `/api/overlay/pending` GET/POST，可列出 pending/manual 队列，并支持 adopt/reject/clear pending 项。
- **导入路径必须 reject**：`data-import-service.js` 不再静默清洗 `..` / `.` / 空段，而是直接 reject。绝对路径、Windows 盘符路径、非 `.json`/`.jsonl` 扩展名一律拒绝。多文件导入时只要一个 key 无效，整批不写。
- **未知 overlay 文件不能被 policy:auto 升级**：`classifyWriteLevel()` 先检查文件是否属于 overlay 白名单，未知文件永远归为 `MANUAL_ONLY`，即使 operation 声称 `policy:auto`。敏感文件（characters/worldbook/scene-chain）不能被 auto 自动升级，仍需 confirm。
- **Guardian overlay 检查更新**：旧的 `data/engine` overlay-only 检查已替换为 `runtime/overlay` 白名单检查。新增 `isApprovedOverlayTarget()` helper，只有白名单文件路径能通过。

### Added
- 集成测试：严格导入路径校验（`data-import-strict-path.test.js`）
- 单元测试：overlay 分类逻辑（`overlay-store.test.js`）
- 单元测试：Guardian overlay 白名单检查（`guardian-overlay.test.js`）
- 集成测试：module lifecycle（`module-lifecycle.test.js`）
- 集成测试：export/import roundtrip（`data-roundtrip.test.js`）
- 集成测试：dashboard telemetry state 回读（`dashboard-telemetry.test.js`）
- 集成测试：overlay pending API adopt 流程（`overlay-pending-api.test.js`）
- 单元测试：`sendGameTurn()` 超时（`llm.test.js`）
- 测试用服务器 helper（`tests/integration/helpers/server-process.js`）

### Changed
- 集成测试可通过 `WORLD_TREE_DATA_DIR` 环境变量使用临时数据目录，不污染真实本地数据。
- 版本检查可通过 `WORLD_TREE_DISABLE_UPDATE_CHECK=1` 禁用，避免测试时的网络依赖。
- `module-service.js` 新增 `createModuleService()` 工厂函数，`listModules`/`createModule`/`deleteModule`/`buildModuleModel`/`readOverlayData`/`moduleWorldDir` 已通过工厂函数注入依赖。`server.js` 中的对应函数改为 wrapper 调用。

## v0.2.1 — 稳定性重构版 (2026-06-18)

- **版本事实源统一**：前端不再硬编码控制台版本，改为从 `/api/health.version` 读取；HTML 初始状态显示 `unknown`，服务可用后自动更新。
- **Overlay 写入收口**：`overlay-store` 改为 `{world}/runtime/overlay/` 白名单文件和 `AUTO / CONFIRM / MANUAL_ONLY` 策略；服务端执行时不再根据任意 path basename 落盘。
- **待确认/手动队列落盘**：自动写入直接应用，确认类写入进入 `pending.jsonl`，未知或手动类写入进入 `manual.jsonl`。
- **导入校验原子化**：`/api/data/import` 在创建目标目录前完整校验所有 `.json` / `.jsonl` 内容，JSONL 错误返回文件路径和行号。
- **低风险服务拆分**：新增 `src/server/module-service.js`、`src/server/persistence-service.js`、`src/server/data-import-service.js`，保留现有 HTTP 路由行为。
- **Guardian 稳定性补强**：新增中英文约束项精确检查、英文回应标记和过短输出检查；单测覆盖 mustInclude、mustNotInclude、玩家问题回应、空输出和正常输出。
- **集成门禁补强**：新增 `tests/integration/data-import.test.js` 和 `tests/integration/overlay-persistence.test.js`，`preflight` 纳入 `npm run test:integration`。
- **版本同步**：`package.json`、`package-lock.json`、README、README.en、AI-GUIDE、manifest 同步到 `0.2.1`。

## v0.2.0 — 运行时一致性版 (2026-06-18)

- **世界书运行时统一**：新增 `src/core/runtime/worldbook-runtime.js`，让 `/api/worldbook/test`、`/api/llm/chat` 和 turn-debug 共用同一套匹配、扫描深度、场景触发、向量阈值和预算裁剪逻辑。
- **预算从条数升级到上下文字符预算**：`context-budget` 新增 `worldbookChars` / `maxContextChars`，世界书注入会同时按条数和字符预算裁剪，并记录被裁掉的条目与原因。
- **叙事黑盒可解释性增强**：每轮 debug 保存 `worldbookRuntime`，包含 selected、droppedByBudget、misses、activeEntryCount、candidateCount、usedChars 等诊断信息。
- **命中原因标准化**：世界书命中条目新增 `reason`、`matchedKeys`、`semanticScore`、`vectorScore`，原因统一为 `persistent`、`exact:key`、`semantic:score`、`vector:score`、`sceneChanged`。
- **中英文向量匹配修复**：`buildVectorIndex` 改用词频对象余弦相似度，中文连续文本会生成 2-gram token；外部数组 embedding 需要同维 query vector，避免隐性错配。
- **测试门禁补强**：新增 `tests/unit/worldbook-runtime.test.js`，覆盖公共运行时诊断和中文向量匹配；`test:unit` 纳入该测试。
- **字段保真尾巴修复**：`/api/worldbook` 的 replace/upsert/append 保存路径保留 `matchMode`、`triggerType`、`depth`、`probability`、`layer` 等高级字段。
- **Preflight 门禁补齐**：`npm run preflight` 现在会执行 `npm run test:unit`；炼金台单测改为原生 `node:test`，异步断言会被正确 await。
- **版本同步**：`package.json`、`package-lock.json`、README、README.en、AI-GUIDE、HTML、manifest 同步到 `0.2.0`。
## v0.1.10 — P0/P1 安全与运行时一致性修复 (2026-06-17)

### P0 安全与稳定性
- **本地访问边界强化**：`isLocalRequest` 新增 Host header 检查、`isLoopbackAddress` 严格 IP 校验、`parseOriginHost` 辅助；CORS 禁止反射非本地 Origin，非法 Origin 直接 403。
- **请求体安全**：新增 `HttpError` 类、`readBody` 增加 `Content-Length` 预检查、JSON 解析失败返回 `INVALID_JSON`（不再静默 `{}`）、非 object JSON 返回 `INVALID_JSON_BODY`、超限时 `destroy req`。
- **LLM 调用超时**：`DEFAULT_CONFIG` 与 `config.example.json` 新增 `llmTimeoutMs`（默认 60000）；`callLLMByRole` 所有 `fetch` 增加 `AbortSignal.timeout`；炼金台人格提炼 fetch 复用同一 timeout 策略；超时捕获为 `LLM_TIMEOUT` 可恢复错误。

### P0.5 残留修复（同日补丁）
- **世界书高级字段保真**：`normalizeWorldbookEntries` 改为 `...entry` 展开 + 显式规范化 `matchMode`/`logic`/`triggerType`/`depth`/`scanDepth`/`probability`/`triggerProb`/`layer`，确保 semantic/vector/scene/depth/probability 能力在运行时可用。
- **炼金台协议修复**：`buildAlchemyLlmCall` 返回内容字符串而非 `{parsed, raw}` 对象，匹配 `classifier`/`extractor` 的 `String()` 解析协议，避免 `[object Object]` 问题。
- **版本事实源统一**：同步 `package-lock.json`、`world-tree-console.html`、`AI-GUIDE.md`、`README.md` 版本到 v0.1.10；audit 新增 lockfile/AI-GUIDE/HTML 版本漂移检查。
- **IPv6 Host 解析**：新增 `parseHostHeader` 函数处理 `[::1]:3000` 格式，替换 `split(":")[0]`。
- **静态资源安全**：`createServer` 入口对所有请求（含静态文件）统一执行 `isLocalRequest`，阻止误绑 `0.0.0.0` 时暴露 UI。
- **测试门禁**：新增 `tests/unit/worldbook.test.js`（24 项，覆盖 normalize/语义/向量/场景/深度/概率）；`test:unit` 和 `CORE_FILES` 扩展覆盖 worldbook/alchemy。

### P1 运行时一致性
- **统一世界书匹配器**：`handleLlmChat` 改用 `matchEntries` + `buildVectorIndex`（来自 `src/core/data/worldbook.js`）替代简单 `injectionPreview`，支持语义匹配、向量匹配、场景变化触发、扫描深度等完整世界书功能。
- **向量匹配修复**：实现 `tokenFreq` + `cosineSparse` 稀疏向量余弦相似度；`buildVectorIndex` 输出的词频对象与 `_vectorMatch` 现在一致；保留 `Array.isArray` 外部 embedding 扩展入口。
- **炼金台真实 LLM**：新增 `buildAlchemyLlmCall` 适配器，复用 OpenAI-compatible API；`handleAlchemyImport` 和 `handleAlchemyDigest` 在配置 LLM 时使用真实深度解析，未配置时自动降级 JS-only；返回 `stats.mode` / `alchemyMode` 标注当前模式。
- **Fallback 矩阵修复**：`callLLMByRole` 从同 index 配对改为 `endpoint × model` 笛卡尔积遍历，记录 `attempts` 数组；修复废弃的 `i` 变量引用。

## v0.1.9 — 本地安全边界加固 (2026-06-15)

- **本地访问边界**：Web 服务默认绑定 `127.0.0.1`，API 请求会校验本地 remote address、Origin 和 Referer。
- **路径遍历防护**：收紧静态文件、角色卡、世界包、旧数据导入、插件入口、Dashboard 数据读取等路径解析，统一限制在项目数据目录内。
- **导入安全**：旧 `/api/data/import` 和 `.worldtree` 导入会过滤越界路径、绝对路径、空路径和非 JSON/JSONL 文件，并避免失败导入留下半成品目录。
- **请求体限制**：API JSON 请求体默认限制为 20MB，可通过 `WORLD_TREE_MAX_BODY_BYTES` 调整，超限返回可读错误。
- **版本同步**：`package.json`、`package-lock.json`、README、README.en、AI-GUIDE、manifest 同步到 `0.1.9`。

## v0.1.8 — 创作者工作台升级 (2026-06-14)

- **工作台 UI**：新增三栏式创作者工作台页面，覆盖角色库、世界书、连接档案、审核队列、世界包、本地插件和叙事黑盒。
- **角色库**：新增 `/api/characters/import`，支持 ST v2/v3 JSON，并尝试解析 PNG `chara` 元数据；导入写入 `data/engine/characters/`。
- **角色库增强**：支持批量导入 JSON/PNG，并可在 UI 中编辑角色显示名、说明和标签。
- **世界书编辑器**：新增 `/api/worldbook` 与 `/api/worldbook/test`，支持条目 CRUD、启停、关键词、分组、批量导入导出和优先级触发测试。
- **连接档案**：新增 `/api/connections`，提供 DeepSeek、OpenAI-compatible、OpenRouter、Ollama、Claude-compatible 模板，密钥仍写本地 secrets，并可记录 temperature、max tokens、top_p。
- **聊天操作**：新增 `/api/chat/message`，支持复制、编辑、删除、收藏、候选回复 swipe；世界和角色卡运行目录均可持久化消息。
- **聊天分支索引**：对话右侧上下文新增收藏、候选版本和轻量分支摘要。
- **叙事黑盒**：新增 `/api/turn/debug`，保存每轮世界书命中、角色状态、记忆快照、Direction Packet 和 Guardian 结果，并在 UI 中提供可读时间线。
- **炼金台审核**：`/api/alchemy/import` 默认把提取结果加入审核队列；新增 `/api/alchemy/review`，支持确认、忽略和字段级合并后再写入正式世界数据。
- **世界包**：新增 `/api/world-pack/export` 与 `/api/world-pack/import`，默认排除 secrets、私密 runtime 和未确认素材；UI 支持导出范围选择与导入冲突预览。
- **插件接口 v0**：新增 `/api/plugins`，只识别本地 importer / reviewer manifest，不加载远程脚本；支持本地 JSON 入口 dry-run。
- **版本同步**：`package.json`、`package-lock.json`、README、README.en、AI-GUIDE、manifest 同步到 `0.1.8`。

## v0.1.0 — 开源初版 + 状态持久化 + 前端拆分 + 单元测试 (2026-06-12)

### 🧭 开源准备修复（2026-06-12）
- **文档一致性**：同步 README / AI-GUIDE 的前端拆分、角色卡单来源、上下文引擎实际调用状态。
- **仓库卫生**：归档过时产品化提案，新增敏感数据忽略、配置模板、贡献指南和安全说明。
- **审计增强**：新增版本日期单调性、本机绝对路径、敏感忽略项、上下文引擎状态检查。
- **Hermes 解耦**：`listSkillFiles()` 未显式传入外部目录时静默返回空数组，避免默认扫描个人 Hermes 安装。
- **开源决策落地**：项目名改为 `world-tree`，许可证改为 MIT，新增英文 README 和 npx 启动入口。
- **诊断与错误层**：`/api/health` 增加 LLM 配置状态、API Key 状态、数据目录可写性；HTTP 错误新增 `code/userMsg/detail`，前端优先展示人话错误。
- **素材发布边界**：移除来源未确认的默认知识库/案例；不内置故事或角色卡素材，仅保留空 `defaults/examples/manifest.json` 和后续素材导入接口。
- **首次启动体验**：前端增加导入素材 / 新建世界 / 环境体检引导，不依赖任何内置剧情素材。
- **死路径收口**：移除服务端和前端残留的 `defaults/cases` 案例分支，`path-catalog` 改为只指向当前真实目录。
- **检查门禁**：`npm run preflight` 新增 `npm run check`，避免旧 Electron 入口或悬空核心导入再次混入。

### 🧹 硬编码集中化
- **新建 `src/core/engine/constants.js`**（~200行）：集中管理所有引擎可调参数
  - `EMOTION_SIGNAL_PATTERNS` / `EMOTION_SIGNAL_LENGTHS` — 情绪信号检测正则与阈值
  - `EMOTION_DELTAS` / `EMOTION_RANGE` — 四维情绪增/减量、衰减率、钳制范围
  - `EMOTION_PROFILE_THRESHOLDS` — 画像高低阈值
  - `EVENT_SCORE` — 事件评分 18 项常数（评分权重/冷却/环境事件/决策阈值）
  - `PACING_THRESHOLDS` — 节奏分析 10 项阈值（过紧/过松/疲劳/最佳窗口/冷却）
  - `PREDICTION_CACHE` — 预测缓存配置（大小/分数范围/等待加成）
  - `POSITIVE_RELATION_WORDS` / `NEGATIVE_RELATION_WORDS` / `RELATION_TYPE_KEYWORDS` — 关系提取词库（共 26 组）
  - `DEGRADATION` — 退化检测阈值
- **影响文件**：`emotion-state.js`、`director.js`、`lifecycle.js` 全部改用常量引用

### ⚡ 性能优化（异步 I/O）
- **`branch-system.js`**：全部 8 个导出函数改为 `async`，`readFileSync`/`writeFileSync`/`existsSync`/`mkdirSync`/`cpSync`/`readdirSync`/`statSync` → `fs/promises` 异步版本
- **`server.js`**：速率限制定期清理定时器（`setInterval` 120s + `unref`），替代此前按需清理的不可靠逻辑

### 💾 进程内状态持久化
- **新建 `src/core/engine/state-persistence.js`**：统一导出/导入入口，覆盖记忆层、关系网、提案队列、预测缓存、情绪状态
- **`memory-layers.js`**：新增 `importMemorySnapshot()` 从持久化恢复
- **`relations.js`**：新增 `importRelationsSnapshot()` 完全恢复（替代此前仅追加的 `importRelations`）
- **`proposal-system.js`**：新增 `importProposalSnapshot()`（含计数器恢复）
- **`director.js`**：新增 `exportPredictionStores()` / `importPredictionStores()` 预测缓存序列化
- **`lifecycle.js`**：`completeTurn` 末尾自动调用 `exportEngineState()`，每轮写入 `overlayPatch._engineState`

### 🔗 消除代码重复
- **`world-engine.js`**：`moduleContext()` 和 `renderKnowledgeCards()` 标记为 `export`
- **`llm.js`**：删除内联 `moduleContext()` 函数（~16行），改为从 `world-engine.js` 导入

### 📂 前端拆分
- **`world-tree-console.html`**：从 68KB 单文件拆为 HTML 结构文件（1.5KB）
- **`world-tree-console.css`**：独立 CSS 样式表（14KB）
- **`world-tree-console.js`**：独立 JS 脚本（59KB）
- HTML 通过 `<link>` 和 `<script src>` 引用外部文件

### 🧪 单元测试
- **新建 `tests/unit/`** 目录 + 4 个测试文件（共 51 条测试）：
  - `emotion-state.test.js`（14 条）— 情绪状态机
  - `direction-packet.test.js`（10 条）— 方向包创建/校验/规范化
  - `output-parser.test.js`（14 条）— 标记段解析/叙事提取
  - `guardian.test.js`（13 条）— 路径校验/守门人/叙事校验
- **`package.json`**：新增 `test:unit` 脚本（`node --test tests/unit/`）
- 全部使用 Node 18+ 内置 test runner，零外部依赖

### 🔧 杂项修葺
- **`skill-parser.js`**：硬编码本机用户目录 → `os.homedir()` 动态获取用户目录
- **`server.js`**：端口检测增加 `EACCES` 错误提示（低于 1024 端口需管理员权限）
- **`server.js`**：非 EADDRINUSE/EACCES 错误增加 `console.error` 日志

### 🧪 质量验证
- `npm test` → **84/84 全部通过**
- `npm run test:unit` → **51/51 全部通过**
- **合计：134/134，零回归**

---

## v2.3.0 — 安全加固 + 管线恢复 + 引擎隔离 + 质量增强 (2026-06-08)

### 🔒 安全加固（server.js）
- **本地访问鉴权**：新增 `isLocalRequest()` 检查 Origin/Referer，仅允许 localhost 来源
- **CORS 限制**：`Access-Control-Allow-Origin` 从 `*` 改为动态 localhost 反射
- **速率限制**：简易令牌桶（静态 300/min + API 120/min），60 秒窗口
- **密钥脱敏**：`/api/secrets/llm-value` 只返回掩码值，不再泄露明文 API Key
- **`testLlmConnection`**：不再信任前端传递的明文 Key，改为从 secrets.json 内部读取
- **`maskSecret`**：修复 ≤4/≤8 字符边界情况
- **`saveLlmSecret`**：掩码检测从 `/^\*{6,}/` 增强为 `\*{4,}` + 全星号检测
- **静态服务加固**：路径遍历防护改用 `resolve + toLowerCase`（Windows 兼容）+ 速率限制
- **MIME 补全**：`.gif` / `.webp` / `.woff` / `.ttf`

### 🚀 性能优化（server.js）
- **JSONL 异步化**：`appendJsonl` 从 `appendFileSync` 改为 `await appendFile`（非阻塞）
- **`readJsonlTail` 流式反向读取**：大文件 (>10MB) 从末尾反向读 64KB chunk，避免 OOM
- **无用 import 清理**：移除 `appendFileSync` / `createWriteStream`

### 🛡️ 异常处理加固（server.js）
- **`readJsonlTail`**：不再静默吞错，改为 `console.warn` 日志 + 降级返回 `[]`
- **`createModule` 中文截断**：`String.slice(0,48)` → `Array.from().slice(0,48).join('')` 安全截断

### 🎯 双段式管线恢复（server.js → llm.js）
- **混合模式启用**：`handleLlmChat` 中 `useLlmAnalysis: true` + `skipGuardian: false`
- **Director 轻量 LLM 分析**：每次对话 150-250 token 分析输入语义/情绪弦外音
- **Guardian JS 校验 + 自动修正**：叙事输出自动检查，评分 <50 时 LLM 修正
- **影响**：此前 Director 和 Guardian 在 Web 控制台中从未执行，现已激活

### 🧩 引擎多世界隔离（director.js）
- **`PREDICTION_CACHE` → `PREDICTION_STORES` Map**：每个世界独立事件预测缓存
- **所有缓存函数**（`cacheEventPrediction` / `checkEventCache` / `pruneEventCache` / `getEventCache` / `resetPredictionCache`）均接受 `worldName` 参数

### ✅ Guardian JS 校验增强
- **`chineseAwareMatch`**：中文 2-gram 模糊匹配（≥60% 命中即通过），替代纯 `includes`
- **响应标记扩展**：`checkPlayerResponse` 从 7 个标记扩展至 20 个
- **评分权重化**：mustInclude -18 / mustNotInclude -22 / 空输出 -50（替代等权 -15）

### 🔬 炼金台修复
- **classifier.js**：`extractBalancedJSONArray` 平衡括号匹配替代贪婪正则 `\[[\s\S]*\]`
- **deduplicator.js**：短名（≤3字符）编辑距离兜底 + 2-gram/3-gram 组合取最大值

### ✨ 内容增强
- **skill-generator.js**：场景响应从 10 种扩展到 14 种（新增：被忽视冷落/被误会冤枉/看到他人受伤/久别重逢）
- **worldbook.js `_semanticMatch`**：中文 2-gram 分词 + 多 token 命中阈值
- **character-card.js**：`RELATION_TYPE_MAP` 12 类中文关系标准化映射 + `normalizeRelationType` 函数

### 📝 版本与脚本
- **modules.js `ENGINE_VERSION`**：从硬编码改为动态读取 `package.json`
- **audit.mjs**：CHANGELOG 正则精确化（`^##\s+v?`）+ ENGINE_VERSION 动态读取验证
- **适配器状态标记**：`hermes.js` 添加 `@deprecated v2.3.0` 注释；`context-engine.js` 仍由 `world-engine.js` 调用
- **`src/adapters/llm.js`**：修复 `data.archives.length` → `(data.archives||[]).length` 运行时错误

### 🧪 质量验证
- `npm run audit` → **0 错误**
- `npm test` → **75/75 全部通过**
- 全部 11 个修改文件通过 `node --check` 语法检查

---

## v2.2.1 — 首页整合 + 删除修复 + Toast 修复 + 默认模型更新 (2026-06-08)

### 首页重构
- **角色卡删除**：移除首页独立「角色卡」面板，角色卡合并到「已有模组」列表
- **模组类型区分**：在模块网格中所有类型统一展示，通过标签区分「📖 世界书/🃏 角色卡/🎲 预设」
- **选择处理器统一**：`select-module` 事件根据 `dataMode` 自动走角色卡/模组逻辑
- **删除处理器统一**：`delete-module` 事件支持角色卡/案例/模组三种删除路径
- **`refreshModules()`**：合并加载 `API.loadModules()` + `API.loadCharacters()` 到 `AS.modules`
- **`init()`**：移除双重加载，统一走 `refreshModules()`

### 删除功能增强
- **案例模块**：`moduleCard()` 加入 `type==="case"`，案例也有「选择+删除」按钮
- **服务端 `deleteModule()`**：新增案例模块删除支持（`defaults/cases/` 路径）
- **确认对话框**：区分「角色卡」「案例」「模组」三种删除确认文案

### 默认模型修复
- **`DEFAULT_CONFIG`**：`llmModel` 改为 `deepseek-v4-flash`（之前为 `deepseek-chat`）
- **HTML 表单**：placeholder 和保存兜底值全部同步为 `deepseek-v4-flash`
- **`README.md`**：默认模型说明同步

### Toast 修复
- **叠加问题**：旧 toast 的 `setTimeout` 被 `clearTimeout` 清掉后永不消失
- **修复**：引入 `currentToast` 引用，新建前先移除旧的；超时后清理引用

### 快速开始
- **`world-tree-console.html:902`**：移除 `.slice(0, 3000)` 截断限制，完整粘贴内容直送 LLM

### 审计修复（v2.2.0 延续）
- **版本号动态化**：`server.js:831` 从硬编码 `"1.0.1"` 改为 `PKG_VERSION` 动态读取
- **`app-manifest.json`**：同步到 v2.2.0
- **`RELEASE.md`**：重写（去 Electron 引用，对齐 Web 架构）
- **`AI-GUIDE.md`**：v2.1 → v2.2，路径修正
- **`test.mjs`**：版本文件一致性测试修复（适配 `_version` 字段）
- **`server.js`**：启动时 `ensureDir` 补上 `data/engine/characters/`
- **路径遍历防护**：`serveStatic` 加 `startsWith(ROOT)` 白名单
- **Git 清理**：删除 381 个旧 Electron/Codex 文件，3 个文档文件入仓

## v2.2.0 — 炼金台 → 角色卡生成管线 + VC-3 人格提炼 + 角色卡双来源 (2026-06-08)

### 新功能
- **炼金台→角色卡生成**：粘贴角色文本 → 点「🃏 创建角色卡」→ 自动走 LLM VC-3 人格提炼 → 输出 `card.json` → 创建角色卡 → 自动跳转对话
- **VC-3 人格提炼引擎**（`skill-generator.js`）：完整覆盖创生 skill 方法论——人格底盘(欲望/恐惧/执念/情绪默认态/爆发点)、表达DNA(口癖/句式/语气词/称呼/签名动作)、场景响应(10核心场景×3字段)、关系网络、知识边界
- **角色卡来源管理（历史）**：当时曾支持 Hermes skills/creative/ 与 `data/engine/characters/` 双来源；2026-06-12 开源准备中已解耦为本地 `data/engine/characters/` 单来源。
- **SKILL.md → JSON 解析桥**（`skill-parser.js`）：8个导出函数，解析 frontmatter/人格表格/场景表格/关系网络/知识边界
- **人称规则修正**：`character-card.js` 硬编码规则改为「叙事用第三人称，对话用第一人称」+ 明确示例
- **创建角色卡 UI 重写**：`world-tree-console.html:787-812`，调用 digest API + 自动选中新卡 + 跳转对话

### API 变更

| 端点 | 变更 |
|:----|:-----|
| `POST /api/alchemy/digest` | 新增 `dataMode: "character_card"` 分支 → LLM 人格提炼 + 写 `card.json` |
| `POST /api/llm/chat` | 角色卡模式走 `buildEnginePacket` → `buildCharacterCardPacket`，不再走通用 `buildWriterPacket` |
| `GET /api/characters` | 当前实现：仅扫描 `data/engine/characters/` |
| `POST /api/characters/load` | 当前实现：加载本地 `card.json` |
| `POST /api/characters/delete` | 当前实现：删除本地角色卡目录 |
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
