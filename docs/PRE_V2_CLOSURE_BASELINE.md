# Pre-V2 Closure Baseline

> Stage 5A Inventory: 当前 main 分支的真实基线快照。
> 本文件只记录事实，不包含计划、清理承诺或未来路线。
> 所有 Pre-V2 Closure 阶段必须遵守 `docs/PRE_V2_CLOSURE_GATES.md`。

## Baseline Commit

| Item | Value |
|---|---|
| Branch | `hermes/pre-v2-closure-stage-5a-inventory` |
| Base | `main` at `3076b2f` |
| Date/Time | 2026-06-24 |
| Latest merged PRs | Stage 4: Universal Mode V2-ready Foundation (`3076b2f`) |
| Previous | Stage 0-3: Real Play Productization (`0e18172`) |

## Project Version

| Item | Value |
|---|---|
| Name | `world-tree` |
| Version | `0.3.1` |
| Node engine | `>=18.0.0` (actual: v22.22.3) |
| npm | 10.9.8 |
| Main entry | `server.js` (ESM) |
| Type | `module` |

## Current Milestone Summary

World Tree 已完成 kernel、prompt、asset、workflow、service-deepening、Real Play Productization 0-3 与 Universal Mode V2-ready Foundation（阶段 4）。

明确限制：

- **不是完整 V2。** V2-ready foundation 是 thin slice：universal metadata/visibility/lifecycle/capability contracts + 8 模式 normalizer + fixture + test（67 项）。未实现任何完整 V2 系统（UI preview、prompt builder context integration 等均未做）。
- strategy numeric/probability substrate 存在但不是完整策略游戏。
- Tabletop 不是完整 DND、Mystery 不是完整推理引擎、Strategy 不是完整 4X。
- Chapter recap 基线仍是 deterministic fallback，LLM summary 为候选能力。

## Current Entry Points

| Entry | File | Purpose |
|---|---|---|
| CLI / start | `npm start` → `server.js` | Web 服务器，端口 3000 |
| Web console | `world-tree-console.html` + `.js` + `.css` | 浏览器 UI 控制台 |
| Server entry | `server.js` (3209 lines) | 单体 HTTP 服务器 + 所有 API 路由 |
| Docs entry | `docs/CURRENT_PROJECT_STATE.md` | AI agent 优先阅读入口 |
| Agent guide | `AI-GUIDE.md` | AI agent 工作手册 |

## Current Mode Entrances (8 modes)

| modeId | Product Name | Type | V2-ready Normalizer | Status |
|---|---|---|---|---|
| `quick-setting` | 快速设定 | consumer | `raw-setting-intake.js` | active |
| `character` | 人物卡 | consumer | `character-v2-ready.js` | active |
| `world-rpg` | 世界书大世界 | consumer | `worldbook-v2-ready.js` | active |
| `tabletop` | 桌面叙事 | consumer | `tabletop-v2-ready.js` | active |
| `mystery-puzzle` | 解谜调查 | consumer | `mystery-v2-ready.js` | active |
| `strategy-sim` | 策略模拟 | consumer | `strategy-v2-ready.js` | active |
| `murder-mystery` | 单人剧本杀 | consumer | `murder-v2-ready.js` | active |
| `creation-forge` | 炼金台 | producer | `creation-v2-ready.js` | active (conservative UI) |

All 8 modes have V2-ready normalizer, fixture, and test. 7 are consumer modes (visible, persistable); creation-forge is producer mode (not visible in mode picker, not persistable directly).

## Current Test Baseline

All commands run on branch `hermes/pre-v2-closure-stage-5a-inventory`:

| Command | Status | Details |
|---|---|---|
| `npm run check` | ✅ PASS | WORLD_TREE_DESKTOP_CHECK PASS |
| `npm run docs:check` | ✅ PASS | 24/24 |
| `npm run asset:check` | ✅ PASS | 0 errors, 11 pre-existing warnings (P3 M1-M11 inventory references) |
| `npm run test:unit` | ✅ PASS | 416/416 |
| `npm run test:integration` | ✅ PASS | 116/116 |
| `npm run test:workflows` | ✅ PASS | 63/63 |
| `npm run workflow:check` | ✅ PASS | 0 errors, 0 warnings |
| `npm run real-play:smoke` | ✅ PASS | 6/6 scenarios |
| `npm run interface-audit` | ✅ PASS | 141 passes, 8 pre-existing warnings (shared/*.json write-not-read) |
| `git diff --check` | ✅ PASS | Clean, no whitespace issues |
| `npm run preflight` | NOT RUN | Equivalent coverage verified by individual commands above |

Total tests: 595 passed, 0 failed (unit 416 + integration 116 + workflows 63).

## Warning Debt

| Source | Count | Nature | Pre-existing? |
|---|---|---|---|
| `asset:check` | 11 | P3 M1-M11 inventory missing references | Yes |
| `interface-audit` | 8 | shared/*.json createModule writes but buildModuleModel doesn't read | Yes |

All warnings are pre-existing and non-blocking (exit code 0).

## Known Current Limitations

- **UI v2-ready preview not implemented。** 仅数据层和测试层完成。
- **Prompt builder v2-ready context not integrated。** mode prompt builder 不消费 v2-ready metadata。
- **Current modes are not full V2。** v2-ready normalizer 是薄切片。
- **Strategy substrate is not full strategy game。** 仅 numeric/probability 底座。
- **Tabletop is not complete DND；Mystery is not complete inference engine。**
- **Chapter recap LLM summary not verified。** Only deterministic fallback is tested.
- **server.js 未拆分。** 3209 行单体文件，包含所有路由和中间件。
- **frontend not ES module split。** `world-tree-console.js` 2360 行单体文件。

## Do Not Break

以下边界在后续任何清理/重构中不得破坏：

- runtime / candidate / proposal / shared canon 分层边界
- hidden_truth visibility boundary（GM only，不进入 player visible context）
- raw setting `preserveOriginal` 行为（quick-setting 保留原文不强行拆世界书）
- strategy numeric/probability deterministic behavior（clamp / soft cap / maxDelta / exact / range / hint / hidden）
- local-first security/path boundaries（path-security + persistence-service）
- existing saves backward compatibility（.worldtree 格式）
- AI agent 修改规则：proposal gate, creation-forge 不是普通玩法入口
- workflow default candidate-only（不直接写 shared canon）
