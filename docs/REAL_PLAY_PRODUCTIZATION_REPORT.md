# Real Play Productization 0-3 Report

> Version: v0.3.1
> Branch: `codex/real-play-productization-0-3`
> Date: 2026-06-24

## Result

Real Play Productization 阶段 0-3 已完成为一组有界薄切片。真实游玩链路现在可离线回归、可在 UI 中观察，并继续遵守 runtime / candidate / proposal / shared canon 边界。

## Stage 0 — Baseline

- 从干净、与 `origin/main` 对齐的 `cce3509` 建立执行分支。
- 修改前 `check`、unit、integration、workflow check 通过。
- 修改前 `test:workflows` 有 1 个既有失败：murder-mystery 真相问句未稳定路由到 truth-protected workflow；本轮已修复并纳入回归。
- 仓库内执行入口：`docs/WORLD_TREE_REAL_PLAY_PRODUCTIZATION_0_3_EXECUTION.md`。

## Stage 1 — Engineering Baseline

### Workflow real LLM wiring

- `server-workflow-adapter` 在 `llmConfig + apiKey` 同时存在时注入真实 LLM adapter。
- 无 key 时继续使用离线 fallback。
- 新测试证明响应不包含 API key，且结果仍为 candidate-only。

### Workflow panel visible mount

- Panel 已挂载到真实 chat surface，并显示 layer、8 services、workflow types 与 last run。
- `interface-audit` 新增静态门禁。
- 浏览器验证：`http://127.0.0.1:3000`，默认 1280×720 与 390×844；加载对话后面板可见，页面非空且无 framework overlay。

### Proposal persistence audit

当前仓库并非只有一个未持久化 `PROPOSAL_STORE`：

- engine proposal 内存队列随 `engineSnapshot` 写入 runtime state，并在模块加载时恢复；新增 roundtrip test。
- kernel proposals、processing proposals、review pending/manual/log 与 overlay queues 使用 JSONL。
- 因此未凭空新增第二套 proposal store。

### Observability and routes

- 对安全、低风险的 operational empty catch 补充模块化非致命 warning；解析 fallback 保持静默。
- 当前路由表：`docs/API_ROUTE_INVENTORY.md`。

## Stage 2 — Playable Slices

### Offline scenario runner

`npm run real-play:smoke` 当前覆盖：

1. workflow-health
2. creation-alchemy-play-loop
3. play-turn-offline
4. character-first-chat
5. mystery-minimal-loop
6. strategy-minimal-loop

CLI 支持 `--scenario <name>` 与 `--json`。

### Waiting progress

- UI 显示 Director analysis → direction → writer → Guardian → complete 阶段。
- 后端已有 `_progress` 时记录真实完成耗时；pending 阶段是保守 UI，不宣称 SSE 或 streaming。

### Mode slices

- Tabletop：`/roll NdS±M`，含合法范围、d20 大成功/大失败、确定性测试与 prompt 注入。骰子结果是 runtime truth，Writer/Guardian 不得改写。
- Mystery：玩家可见 clue/hypothesis board；`revealsTruth`、`hiddenTruth` 与 hidden visibility 在进入 prompt 前剔除。
- Strategy：粮草、军力、民心、外交与四个有界决策；数值限制在 `0..max`，变化只进 runtime/candidate。

## Stage 3 — Narrative Experience

- Proposal UI 使用叙事文案，accept 复用 approve，delay 保持 pending，reject 走真实 reject API；reject integration test 证明 shared 文件不变。
- Chapter recap 提供最多 12 条 tail 输入与 deterministic fallback，不扫描完整 chat.jsonl。
- Goal tracker 只公开 public goals；未 reveal 的 hidden storyline 不进入玩家上下文。
- `rhythmTag` 是现有 pacing/pressure 的辅助字段，非法 tag fallback 为 `breath`。

## Validation

- `npm run check` — PASS
- `npm run test:unit` — PASS
- `npm run test:integration` — PASS (115 tests)
- `npm run test:workflows` — PASS (62 tests)
- `npm run workflow:check` — PASS (0 errors, 0 warnings)
- `npm run test:prompts` — PASS (42 tests)
- `npm run test:kernel` — PASS
- `npm run real-play:smoke` — PASS (6 scenarios)
- `npm run interface-audit` — PASS (141 checks, 0 errors, 8 pre-existing file-read warnings)
- `npm run preflight` — PASS
- Browser QA — PASS at desktop 1280×720 and mobile 390×844

Asset validation continues to report 11 pre-existing inventory naming warnings; interface audit continues to report 8 existing shared-file read-path warnings. Both commands exit PASS, and this pass does not rewrite those unrelated systems.

## Out of Scope

- Full Worldbook V2 / Character Capsule V2
- embedding / vector retrieval / SQLite / TypeScript migration
- full map/state-machine/causality/long-term-memory systems
- full DND, full inference engine, full 4X, quest engine, group chat
- SSE/streaming, frontend framework migration, server.js large split

## Known Limitations

- Chapter recap 的已验证基线是 deterministic fallback；真实 LLM summary 仍是候选能力。
- Dice、clue board、resource panel 和 goals 是产品化薄切片，不等同完整子系统。
- Browser QA 未向真实第三方 LLM 发送测试输入；真实 LLM 接线由隔离 mock integration test 证明。
