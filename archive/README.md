# archive/

本目录存放经 `scripts/reach.mjs` 判定为**产品不可达**的源码，按原路径保留（`archive/<原路径>`），用 `git mv` 移入，历史可追溯（`git log --follow`）。
这些文件不参与运行、构建或测试；产品主线不得 import 本目录（`node scripts/reach.mjs` 中 archive/ 下文件须全部为 unreachable）。

恢复方法：`git mv archive/<路径> <路径>`。

判定规则：从产品入口（server.js、bin/world-tree.js、HTML `<script>` 标签）出发，跟踪静态 import、require、字面量动态 import；
engine/ 主干一般不动；tabletop.js、prompt-hidden-sanitizer 绝对保留；`sim.js` 在 dc-4 迁出 `SIM_DM_INSTRUCTION` 后整体归档（PRD §3.3）；被测试/脚本以字符串或动态方式引用的文件保留。

| 原路径 | 理由 | 证据 |
|---|---|---|
| `src/core/character/character-v2-memory-consolidation.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/content/content-proposal-extensions.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md |
| `src/core/creation-wizard/wizard-stage-policy.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-contradiction-engine.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-evidence-board.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-hint-engine.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-hypothesis-board.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-interrogation-engine.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-location-investigation.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-testimony-board.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/detective/detective-timeline-board.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/macros/macro-safe-context.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：CHANGELOG.md docs/ASSET_MATURATION_REPORT.md |
| `src/core/observability/observability-bridge.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：CHANGELOG.md docs/ASSET_MATURATION_REPORT.md |
| `src/core/prompts/prompt-context-bridge.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：CHANGELOG.md docs/ASSET_MATURATION_REPORT.md |
| `src/core/review/review-adoption-policy.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：docs/ASSET_MATURATION_REPORT.md |
| `src/core/tabletop/tabletop-v2-inventory-resource.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/tabletop/tabletop-v2-npc-state.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：无 |
| `src/core/v2-ready/v2-ready-normalizer.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md docs/V2_READY_FOUNDATION_REPORT.md |
| `src/core/v2-ready/v2-ready-validator.js` | 产品/测试/脚本均无 import（静态、require、字面量动态 import 均无） | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md docs/V2_READY_FOUNDATION_REPORT.md |
| `src/core/v2-ready/relation-record.js` | 仅被同批归档的 v2-ready-normalizer 引用 | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md docs/V2_READY_FOUNDATION_REPORT.md |
| `src/core/v2-ready/time-binding.js` | 仅被同批归档的 v2-ready-normalizer 引用 | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md docs/V2_READY_FOUNDATION_REPORT.md |
| `src/core/strategy-sim/index.js` | V1 策略模拟入口；现行为 strategy-sim-mode-adapter（保留） | `node scripts/reach.mjs` → unreachable；文档提及：CHANGELOG.md ST-COMPARISON.md WORLD_TREE_P0_P2_KERNEL_IMPLEMENTATION_REPORT.md docs/AGENT_STATUS_HANDOFF.md docs/AI_AGENT_OPERATING_GUIDE.md docs/ARCH…（共 40 篇文档） |
| `src/core/strategy-sim/strategy-sim-state.js` | V1 状态，仅被 V1 index.js 引用 | `node scripts/reach.mjs` → unreachable；文档提及：docs/ARCHITECTURE_REALITY_CHECK.md |

| `src/core/engine/sim.js` | `SIM_DM_INSTRUCTION` 已迁至 `src/core/engine/sim-dm-instruction.js`；createResources/advanceResources/createCalendar 等机制函数无产品调用方（PRD §3.3 / 组长裁定）；`export * as sim` 已删除 | `node scripts/reach.mjs` → archive 下 unreachable；产品路径仅保留 sim-dm-instruction |

## 保留（不可达或仅测试可达，但未归档）

| 路径 | 原因 |
|---|---|
| `src/core/engine/world-manager.js` | engine/ 主干不动；scripts/test.mjs 与 module-manifest.js 以字符串引用 |
| `src/core/engine/runtime.js` | scripts/check.mjs import |
| `mode-runner.js` | 仅测试可达，但 scripts/check-docs.mjs 读取 |
| `src/core/grand-world/index.js` | mode-runner 动态 import |
| `strategy-sim-mode-adapter` | mode-runner 与 strategy 测试使用 |
| 各模块 `index.js` 汇总出口（character、creation-forge、murder-mystery、mystery-puzzle、system、tabletop、workflows、worldbook、worldbook-v2）及 `*-state.js`、`content-registry.js`、`worldbook-parser.js`、`creation-forge-module-integration.js` | 公共模块出口或被产品注册表/脚本/默认数据按名称引用，静态分析无法排除，保守保留 |
| `src/core/prompts/index.js`、`prompt-orchestrator.js` | 仅文档引用；与 prompt-hidden-sanitizer 同目录，本次保守保留，作为后续候选 |
