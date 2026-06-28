# World Tree · CHANGELOG
## v0.4.1-v2-entry-closure.0

V2 Entry Closure — 四个 V2 入口已完成闭环：Tabletop V2、Detective V2、Character V2 长期系统、单人剧本杀 V2。

### Documentation Truth-Source Alignment

- Aligned current documentation around `v0.4.1-v2-entry-closure.0`.
- Clarified that V2 Entry Closure is engineering/service closure, not Full V2 or product-wide playable closure.
- Updated stale Pre-V2 play-mode wording in current-facing docs (PLAY_MODE_GUIDE, FEATURES, USER_QUICKSTART, README, etc.).
- Recorded current gaps (Worldbook V2, Strategy V2, built-in examples, Browser QA) without defining future feature direction.
- Updated mode statuses to reflect current implementation: usable / experimental / minimal slice / producer tool.


> 面向维护者、用户和 AI agent 的变更记录。
> 当前能力以最新 Unreleased / V1 里程碑为准。

## 0.4.0-pre-v2-closure.1 / Pre-V2 Blocker Repair

### Fixed
- **P0 userData isolation**: server now reads `WORLD_TREE_USER_DATA_DIR`; test helper auto-creates temp userData dir. Integration suite no longer pollutes real `userData/`.
- **P1 request-body contract**: oversized/streaming body returns 413 JSON (no socket destroy); malformed JSON → 400 INVALID_JSON; non-object JSON → 400 INVALID_JSON_BODY.
- **P1 creation-forge authority**: `/api/modules/create` rejects `mode=creation-forge` with `MODE_PROJECT_CREATION_DISABLED`.
- **P1 version/release truth**: unified `package.json` / `app-manifest.json` / `README` / `AI-GUIDE` to `0.4.0-pre-v2-closure.1`.
- **P2 truth/gates**: docs links, route inventory, stale QA report version, asset classification TODO.

### Notes
- Old tag `v0.4.0-pre-v2-closure` exists and was NOT moved or deleted.
- It is audit-invalidated as a trusted final seal — see `docs/RELEASE_SEAL_AUDIT_INVALIDATION_NOTE.md`.
- No new tag was created. Full V2 was NOT implemented.

## 0.3.1 / Real Play Productization 0-3

### Added
- **Real Play Productization 0-3**：离线 scenario runner、Workflow visible mount、等待阶段 UI、Tabletop `/roll`、Mystery 线索/假设板、Strategy 资源板、叙事化 proposal、fallback recap、goal tracker 与 rhythm tags。
- 新增 `npm run real-play:smoke`、real-play unit/integration tests 与当前 API route inventory。
- Workflow server adapter 在 `llmConfig + apiKey` 存在时真实注入 LLM；无 key 保持安全 fallback，响应不泄露 key。
- Proposal persistence 审计证明主链由 engine snapshot 与 JSONL 队列持久化，并新增 snapshot roundtrip 回归测试。
- **Prompt Orchestration Layer v1**（略，详见上次提交）
- **Asset Inventory**（略，详见上次提交）
- **Legacy Mechanism Expansion P3 — M1-M11**：
  - M1 Creation Wizard v2（6 文件 + 8 test）
  - M2 Alchemy Digest Candidate Flow（1 文件 + integration test）
  - M3 Material Learning Warehouse（1 文件 + integration test）
  - M4 Character Kernel v2（1 文件 + integration test）
  - M5 Character Cognition Matrix（1 文件 + integration test）
  - M6 Organization / Faction Graph（1 文件 + integration test）
  - M7 World Rules Engine（1 文件 + integration test）
  - M8 Narrative Consistency Radar（1 文件 + integration test）
  - M9 Random Event Pool + Scene Direction（1 文件 + integration test）
  - M10 Macro System（1 文件 + integration test）
  - M11 Observability Terminal（1 文件 + integration test）
- 新增 `npm run test:legacy-mechanisms`（22 tests）

### Asset Maturation (Stages 0-3)
- **Stage 0**: ASSET_STATUS_MATRIX, asset-status-registry, validate-asset-inventory script, test:assets (7 tests), asset:check
- **Stage 1**: unified authority policy (7 actions), candidate schema (10 kinds), candidate normalizer, review-adoption wrapper, test:authority (10 tests)
- **Stage 2**: legacy-modernization-registry, P3 merge-map (7 mappings), test:legacy-modernization (6 tests)
- **Stage 3**: workflow-context-envelope, P3 context builder, prompt-context-bridge, macro-safe-context, observability-bridge, test:workflow-readiness (5 tests)
- preflight now covers all maturation tests (18 stages total)

### Final Documentation Closure

- README kept as human user entrypoint
- docs/INDEX updated as audience-based document router
- Added CURRENT_PROJECT_STATE as current truth source
- Added ROADMAP_CANDIDATES from UX/engineering review docs
- Added WORKFLOW_SERVICE_DEEPENING_REPORT
- Updated stale workflow report references (historical limitations marked resolved)
- Updated API reference with workflow endpoints
- Updated AI-GUIDE current milestone and directory map
- Updated PROJECT_OVERVIEW architecture flow
- Updated FEATURES with workflow capabilities
- Updated DOCUMENTATION_STATUS with new files

Notes: No runtime code changes. No new gameplay features. Roadmap candidates are not active features.
- 三层安全防线：Global Executor Identity → Mode-Specific Blocks → Final Guard（每次生成前最后检查）。
- 8 模式 profile：quick-setting / world-rpg / character / tabletop / mystery-puzzle / murder-mystery / strategy-sim / creation-forge，每个配专属禁止事项与边界。
- 9 任务 contract：writer / director / guardian / proposal-extractor / scene-summary / worldbook-candidate / processing-extractor / emotional-inertia / telemetry-explanation，内部 JSON 任务有明确 schema。
- 接入：mode-runner (`buildModePromptResult`) 和 llm.js (`callLLMByRole` → `orchestrationPrefix`) 自动注入编排块。
- 新增 `npm run test:prompts` (42 tests) 覆盖所有模式/任务/安全边界。
- 向后兼容：旧 `buildModePrompt` / `buildModePromptResult` API 不变。
- Hidden truth 过滤：`deepFilterHiddenFields()` 递归移除所有 hiddenTruth/answerLock/truthLock/_private。

### Safety / Boundaries
- 不重写 LLM 调用链，不重写 proposal-bus，不重写 P0-P2 Kernel。
- Final Guard 确保不泄露 hidden truth，不把 candidate 当 canon。
- Creation-forge 专属反自动创建 block，不输出"已创建项目"。
- Murder-mystery 最高优先级真相锁，嫌疑人只知自己视角。

## Unreleased / Kernel P0-P2

### Added
- Living World Kernel P0：Proximity Scope、Tracking、Scene Summary Chain、proposal-gated Dynamic World State、bounded Ripple、Worldbook Trigger、Living World Packet。
- Experience Stability Kernel P1：bounded Context Engine、plan-only Director、Impact Gate 与 Stop-loss Window、Worldbook Growth Tree、runtime-first Emotional Inertia。
- Long Play Kernel P2：registered-only World Profile Overlay、branch-local Timeline Save Tree、read-only Telemetry、one-beat Auto-light、candidate-only Processing Engine。
- 三阶段聚焦测试与跨层集成测试；P2 包含执行文件要求的 40 项聚焦覆盖。
- P0-P2 completion pass：统一 Kernel Turn Context 已接入真实 LLM turn 与 mode-runner；活动分支持久化、Kernel APIs、最小控制台面板和端到端测试已补齐。
- 新增 branch/telemetry/Auto-light/critical approval/stop-loss reverse/processing candidate 用户工作流；所有接口继续受 local-only 与 path-security 保护。

### Safety / Boundaries
- 仅新增最小 Kernel UI，不含 branch merge、复杂 redesign 或自动连播；未替换 `mode-module-map.js` 或重写 proposal/save 架构。
- canonical shared 写入继续经 proposal/approval；critical 变更要求二次确认，major/critical 支持反向 proposal stop-loss。
- Telemetry 只读 canon；Auto-light 不审批 proposal；Processing/Growth Tree 不直接写 canonical worldbook。

## 0.3.0 / V1 Closure

**最新提交**: 0ed95c9

### Added
- V1 完整闭环系统: route index, prompt registry, mode input/output packets, isolation policy, proposal bus, save system, mode runner (src/core/system/, src/core/prompts/)
- 系统闭环测试 31 项 (tests/unit/system-closure.test.js)
- 炼金台 V1 (creation-forge): 输入理解/目标检测/追问/蓝图/资产契约/校验/实例化/导出
- 四入口 V1: tabletop, mystery-puzzle, strategy-sim, murder-mystery (各 3 files + 集成测试)
- 大世界模式 V1 完成与加固: Grand World adapter, turn planner, state, objectives
- 世界书基础层 V1: schema/normalizer/validator/context-activator/packet/proposal (10 files)
- 旧资产盘点与翻新合并计划: 44 模块 5 分类
- Character Capsule V1: parser/profile/prompt/lore/persona/module-integration/OOC/adapter/exporter
- Pre-Feature Architecture Completion: factory wiring, P2-A wrappers, reclassification
- Core Architecture: Mode Runtime Core, Module Runtime Orchestrator, State Schema, Project Factory

### Changed
- World Tree 从旧本地 AI 叙事控制台重定义为本地优先多模式叙事与创作工作台
- package version = 0.3.0, 功能里程碑 = V1 完整闭环
- creation-forge: producer/factory 模式，非普通玩法入口
- world-rpg: 世界书大世界模式，非传统 RPG
- 文档体系重写: README, CHANGELOG, AI-GUIDE, 14+ docs/ 文件

### Safety / Boundaries
- shared 文件是项目真相源，AI 生成变更必须走 proposal gate
- hidden facts (truthLock, answerLock) 不得进入玩家可见上下文
- 跨模式缓存写隔离: 每个模式只能写自己的 runtime/cache
- creation-forge 实例化必须用户确认

### Known Limits
- V1 本地优先、单人用户导向
- 不做多人房间、市场、插件生态、向量检索、高级可视化编辑器
- 不做 V2 深玩法 (完整 DND、4X、多角色群聊、长期记忆等)
