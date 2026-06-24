# V2 Ready Foundation Report

> Stage 4: Universal Mode V2-ready Foundation — Hermes execution
> Date: 2026-06-24
> Branch: `hermes/stage-4-universal-mode-v2-ready`
> Base: `main` at `0e18172` (Real Play Productization 0-3 merged)

## Result

Stage 4 收尾。8 个模式入口均获得 V2-ready 最小数据位 / 能力声明 / 边界声明 / normalizer / fixture / test。Strategy 固定面板保留，数值 / 概率底座预埋。**未实现任何完整 V2 系统。**

## Scope

本轮新增通用底座和全模式薄切片：

- universal metadata / visibility / lifecycle / capability contract
- quick-setting raw setting intake
- strategy numeric substrate (clamp / soft cap / maxDelta / drift detection)
- strategy probability substrate (exact / range / hint / hidden visibility)
- 8 个模式 v2-ready normalizer + test + fixture

## Universal Layers Added

### `src/core/v2-ready/`

| 文件 | 职责 |
|---|---|
| `universal-metadata.js` | 通用 metadata normalizer (12 fields, enum fallback to safe defaults) |
| `visibility-policy.js` | 可见性过滤 (player_visible / gm_only / hidden_truth / mode_private / system_only) |
| `lifecycle-state.js` | 生命周期 / canon gate (pending_review / rejected 阻断，shared_canon 需显式授权) |
| `mode-capability-contract.js` | 8 模式能力声明 (accepted types / writes / v2ReadyFields) |
| `relation-record.js` | 轻量关系记录 (不包含图算法) |
| `time-binding.js` | 轻量时间绑定 (不包含完整时间线引擎) |
| `v2-ready-normalizer.js` | 聚合 normalizer |
| `v2-ready-validator.js` | 安全校验 (hidden_truth 泄露 / canon 写越界 / mode 不兼容) |

## Mode Coverage

### quick-setting — Raw Setting Play Adapter

- `src/core/quick-setting/raw-setting-intake.js`：接受原始 DeepSeek 风格设定
- 识别开局问卷 / 命令词 / 常驻面板 / 安全标记 / 模式倾向
- 保留原文，不强行拆世界书，不强制大型表单
- 测试：`tests/unit/quick-setting-raw-setting-intake.test.js` (5 tests)

### character — Character V2-ready Slice

- `src/core/character/character-v2-ready.js`：关系状态 / 边界 / 记忆候选
- 默认陌生人，不默认熟人 / 恋爱 / 亲密
- 不做角色蒸馏
- 测试：`tests/unit/character-v2-ready.test.js` (3 tests)

### world-rpg / worldbook — World V2-ready Slice

- `src/core/worldbook/worldbook-v2-ready.js`：entity / location / event / time refs
- 世界变化默认 runtime/candidate
- hidden storyline 不进入玩家可见 prompt
- 测试：`tests/unit/worldbook-v2-ready.test.js` (2 tests)

### tabletop — Tabletop V2-ready Slice

- `src/core/tabletop/tabletop-v2-ready.js`：rule ref / check / clock / runtime truth
- 骰子结果是 runtime truth，LLM 不能改写
- 测试：`tests/unit/tabletop-v2-ready.test.js` (2 tests)

### mystery-puzzle — Mystery V2-ready Slice

- `src/core/mystery-puzzle/mystery-v2-ready.js`：clue / hypothesis / truth lock
- truthLock 默认 hidden_truth
- 测试：`tests/unit/mystery-v2-ready.test.js` (2 tests)

### strategy-sim — Strategy V2-ready Slice

- `src/core/strategy-sim/strategy-v2-ready.js`：display stats / variables / probability policy
- `src/core/strategy-sim/strategy-numeric-system.js`：clamp / soft cap / maxDelta / drift detection
- `src/core/strategy-sim/strategy-probability-system.js`：exact / range / hint / hidden 展示策略
- 测试：`tests/unit/strategy-v2-ready.test.js` (3 tests) + `tests/unit/strategy-numeric-system.test.js` (9 tests) + `tests/unit/strategy-probability-system.test.js` (9 tests)

### murder-mystery — Murder Mystery V2-ready Slice

- `src/core/murder-mystery/murder-v2-ready.js`：case / suspect / testimony / truth lock
- truthVisibility 默认 hidden_truth
- 测试：`tests/unit/murder-v2-ready.test.js` (2 tests)

### creation-forge — Creation Forge V2-ready Slice

- `src/core/creation-forge/creation-v2-ready.js`：source / artifact / extraction trace
- 只生成候选资产，不能自动写 shared canon
- 测试：`tests/unit/creation-v2-ready.test.js` (2 tests)

## Strategy Numeric / Probability Notes

- 固定面板保留（`createDefaultDisplayStats`），但使用抽象 slot（material/stability/capacity/relation/risk），不依赖硬编码资源名
- 数值系统：clamp / soft cap (70% 收益递减) / maxDelta 限制 / NaN/nil safe
- 概率系统：4 级可见策略 (exact → "65%" / range → "大约 50-70%" / hint → "成功率较高" / hidden → ??)
- 概率与 seed 可复现，不同 seed 有随机性
- 所有策略变量不直接写 shared canon

## Safety Boundary

- `visibility-policy.js`：hidden_truth / system_only / gm_only 不进玩家 UI
- `lifecycle-state.js`：pending_review / rejected 阻断 shared canon 写入
- `mode-capability-contract.js`：所有 8 模式 writsCanon = false
- `v2-ready-validator.js`：blocker 级违规 (hidden_truth 泄露、非法 canon 写)

## Tests

| 组 | 数量 | 状态 |
|---|---|---|
| universal metadata | 5 | PASS |
| visibility policy | 8 | PASS |
| lifecycle state | 8 | PASS |
| mode capability | 8 | PASS |
| **P0 subtotal** | **29** | **PASS** |
| quick-setting raw intake | 5 | PASS |
| strategy numeric system | 9 | PASS |
| strategy probability system | 8 | PASS |
| character v2-ready | 3 | PASS |
| worldbook v2-ready | 2 | PASS |
| tabletop v2-ready | 2 | PASS |
| mystery v2-ready | 2 | PASS |
| strategy v2-ready | 3 | PASS |
| murder v2-ready | 2 | PASS |
| creation v2-ready | 2 | PASS |
| **Total new tests** | **67** | **PASS** |

Existing test suites:
- `npm run test:workflows` — 63/63 PASS
- `npm run real-play:smoke` — 6/6 PASS

## Out of Scope

- 完整 Worldbook V2 / Character V2
- 角色蒸馏 / OOC 评分 / 长期记忆自动化
- 完整 DND / 推理引擎 / 剧本杀引擎 / 4X 完整策略游戏
- embedding / vector retrieval / SQLite / TypeScript 迁移
- server.js 大拆分 / 前端框架迁移
- 图算法 / 自动关系推理 / 完整时间线引擎

## Known Limitations

- quick-setting openingPrompt 保留原文（含潜在危险内容），safety flag 需在下游 prompt builder 消费
- strategy 数值底座是抽象 substrate，不等同完整策略游戏
- 概率系统不包含贝叶斯更新 / 蒙特卡洛 / 对手 AI 决策
- UI 轻量预览未在本轮实现（console 已简化，新增 v2-ready summary panel 留待后续）
- Prompt 安全接入只做了 validator，未接入主 prompt builder pipeline

## Next Candidate Work

见 `docs/ROADMAP_CANDIDATES.md`：
- Chapter recap 真实 LLM summary
- Tabletop fail-forward / scene clock
- Strategy 完整外交 / 回合结算 / AI 对手
- Character creation 灵魂问题
- Prompt builder 接入 v2-ready context
- Console v2-ready summary panel UI
